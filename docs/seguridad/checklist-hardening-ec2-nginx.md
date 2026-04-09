# Checklist de validacion de hardening para EC2 y Nginx

Usar esta checklist sobre la instancia real. La idea es validar si el borde publico acompana lo que el codigo espera y cerrar riesgos de fraude operativo externo.

## 1. Puertos y exposicion de red

- [ ] Confirmar que desde internet solo responden `80/tcp` y `443/tcp`.
- [ ] Confirmar que `3001/tcp` y `5432/tcp` no son accesibles desde internet.
- [ ] Confirmar que el backend escucha solo en loopback o queda protegido por SG/firewall.

Comandos sugeridos en EC2:

```bash
sudo ss -ltnp | egrep ':80|:443|:3001|:5432'
sudo ufw status verbose || true
sudo iptables -S || sudo nft list ruleset
```

Validacion externa desde otra maquina:

```bash
nc -vz tu-dominio.com 80
nc -vz tu-dominio.com 443
nc -vz tu-dominio.com 3001
nc -vz tu-dominio.com 5432
```

Resultado esperado:

- `80` y `443` abiertos.
- `3001` y `5432` cerrados o filtrados.

## 2. Nginx como unico borde publico

- [ ] Confirmar que el backend no queda expuesto por direccion IP publica + `:3001`.
- [ ] Confirmar que `/api/`, `/api/eventos` y `/uploads/` salen solo por Nginx.
- [ ] Confirmar que el `server_name` ya no usa el placeholder.

Comandos:

```bash
sudo nginx -t
sudo cat /etc/nginx/sites-available/comanda.conf
curl -I https://tu-dominio.com/
curl -I https://tu-dominio.com/api/health
```

## 3. Rate limiting y protecciones de borde

- [ ] Confirmar si Nginx tiene `limit_req_zone`, `limit_req` y `limit_conn`.
- [ ] Si no existen, marcar como gap para:
  - `/api/auth/login`
  - `/api/publico/pedido`
  - `/api/publico/pedido/*/pagar`
  - `/api/pagos/webhook/mercadopago`
  - `/api/impresion/jobs/*`

Busqueda rapida:

```bash
sudo grep -R "limit_req\|limit_conn" -n /etc/nginx
```

Resultado esperado:

- Reglas presentes o gap documentado para remediacion inmediata.

## 4. Endpoints sensibles

- [ ] Verificar que `/api/ready` no este expuesto publicamente.
- [ ] Verificar si `/api/impresion/jobs/*` tiene alguna restriccion adicional de red.
- [ ] Verificar si `/uploads/` expone mas de lo necesario.

Comandos:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://tu-dominio.com/api/ready
curl -s http://127.0.0.1:3001/api/ready
curl -I https://tu-dominio.com/uploads/archivo-inexistente
```

Resultado esperado:

- `/api/ready` deberia devolver `403` o equivalente en el borde publico.
- `/api/ready` debe responder correctamente por loopback.
- `/api/impresion/jobs/*` idealmente deberia quedar filtrado por borde.
- `/uploads/` no debe listar directorios ni devolver tipos inseguros.

## 5. TLS y headers

- [ ] Confirmar certificado valido y renovacion activa.
- [ ] Confirmar HSTS, `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.

Comandos:

```bash
openssl s_client -connect tu-dominio.com:443 -servername tu-dominio.com </dev/null
curl -Ik https://tu-dominio.com/
systemctl status certbot.timer || true
```

## 6. Secretos y permisos locales

- [ ] Confirmar permisos de `/opt/comanda/backend/.env`.
- [ ] Confirmar propietario y permisos de `/opt/comanda/uploads`.
- [ ] Confirmar que `BRIDGE_TOKEN`, `JWT_SECRET`, `PUBLIC_ORDER_JWT_SECRET` y `MERCADOPAGO_WEBHOOK_SECRET` son reales y no placeholders.

Comandos:

```bash
sudo stat -c "%a %U:%G %n" /opt/comanda/backend/.env
sudo stat -c "%a %U:%G %n" /opt/comanda/uploads
sudo systemctl cat comanda-backend
sudo grep -E "JWT_SECRET|PUBLIC_ORDER_JWT_SECRET|MERCADOPAGO_WEBHOOK_SECRET|BRIDGE_TOKEN" /opt/comanda/backend/.env
```

Resultado esperado:

- `.env` legible solo por cuentas operativas necesarias.
- Sin placeholders ni secretos cortos.

## 7. Bridge de impresion

- [ ] Confirmar desde que IP(s) sale el bridge real.
- [ ] Confirmar que el bridge usa un token rotado y no uno historico.
- [ ] Confirmar que la PC Windows no expone el token en wrappers o logs.

Verificaciones sugeridas:

```bash
sudo journalctl -u comanda-backend -n 200 --no-pager | grep -i bridge
```

En Windows:

- [ ] Revisar variables de entorno del servicio NSSM/PM2.
- [ ] Revisar logs locales del bridge.
- [ ] Confirmar que `BRIDGE_API_URL` usa HTTPS.

## 8. Evidencia a guardar

- [ ] Salida de `ss -ltnp`
- [ ] Captura de security groups de EC2
- [ ] `nginx -t`
- [ ] `curl -Ik` de `/` y `/api/health`
- [ ] validacion publica y por loopback de `/api/ready`
- [ ] `stat` de `.env` y `/opt/comanda/uploads`
- [ ] Estado de `certbot.timer`

## 9. Criterio de aprobacion

La instancia solo deberia considerarse endurecida para esta fase si:

- `3001` y `5432` no son accesibles desde internet;
- Nginx es el unico borde publico;
- existe mitigacion de rate limiting en edge o un plan inmediato para agregarla;
- `/api/impresion/jobs/*` no queda expuesto a cualquier IP;
- los secretos operativos son fuertes y no placeholders;
- `/api/ready` no queda expuesto publicamente y solo se valida por loopback.
