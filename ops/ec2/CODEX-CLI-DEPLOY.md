# Codex CLI en EC2 para desplegar Comanda

Guia precisa para entrar por SSH a la instancia EC2, instalar Codex CLI y pedirle que ejecute el deploy usando **solo** el repo local y el pack `ops/ec2`.

## Prerrequisitos

- Ubuntu 22.04 en EC2.
- Acceso SSH a la instancia.
- Usuario con permisos de `sudo`.
- Repo presente en `/opt/comanda` o permiso para clonarlo ahi.
- Secretos reales listos para `/opt/comanda/backend/.env`.
- Dominio real apuntando a la instancia.

## Archivos que Codex debe usar

- [ops/ec2/README.md](/C:/Programacion/Comanda/ops/ec2/README.md)
- [DEPLOY.md](/C:/Programacion/Comanda/DEPLOY.md)
- [backend/.env.example](/C:/Programacion/Comanda/backend/.env.example)
- [ops/ec2/scripts/bootstrap-host.sh](/C:/Programacion/Comanda/ops/ec2/scripts/bootstrap-host.sh)
- [ops/ec2/scripts/deploy-app.sh](/C:/Programacion/Comanda/ops/ec2/scripts/deploy-app.sh)
- [ops/ec2/scripts/post-deploy-smoke.sh](/C:/Programacion/Comanda/ops/ec2/scripts/post-deploy-smoke.sh)
- [ops/ec2/nginx/comanda.conf](/C:/Programacion/Comanda/ops/ec2/nginx/comanda.conf)
- [ops/ec2/systemd/comanda-backend.service](/C:/Programacion/Comanda/ops/ec2/systemd/comanda-backend.service)

## Instalar Codex CLI en la EC2

Codex CLI se instala con npm y corre oficialmente en Linux. Referencias oficiales:

- [Codex CLI](https://developers.openai.com/codex/cli)
- [Codex CLI and Sign in with ChatGPT](https://help.openai.com/en/articles/11381614-codex-cli-and-sign-in-withgpt)

Desde la EC2:

```bash
cd /opt/comanda
sudo npm i -g @openai/codex@latest
codex
```

La primera vez, Codex te va a pedir iniciar sesion con tu cuenta de ChatGPT o con API key.

## Preparar el servidor antes de pedir el deploy

1. Entrar por SSH.
2. Ubicarse en `/opt/comanda`.
3. Confirmar que el repo esta actualizado o que Codex puede clonarlo ahi.
4. Confirmar que el dominio real ya resuelve a la IP publica.
5. Tener listos los valores reales para `/opt/comanda/backend/.env`.

Si todavia no existe `.env`, copiar:

```bash
cp /opt/comanda/backend/.env.example /opt/comanda/backend/.env
```

## Prompt recomendado para Codex

Abrir `codex` dentro de `/opt/comanda` y pegar este prompt completo:

```text
Quiero que prepares y ejecutes el deploy de produccion de Comanda en esta EC2 usando solo el repo local y los archivos de ops/ec2.

Trabaja desde /opt/comanda.

Objetivo:
- dejar nginx, systemd y la app funcionando en produccion;
- servir el frontend estatico;
- dejar el backend respondiendo en /api/health y /api/ready;
- servir /uploads desde /opt/comanda/uploads;
- emitir o validar TLS con Let's Encrypt para el dominio configurado;
- ejecutar el deploy con ops/ec2/scripts/deploy-app.sh;
- correr el smoke post deploy;
- reportar al final exactamente que validaste.

Archivos canonicos:
- ops/ec2/README.md
- DEPLOY.md
- backend/.env.example
- ops/ec2/nginx/comanda.conf
- ops/ec2/systemd/comanda-backend.service
- ops/ec2/scripts/bootstrap-host.sh
- ops/ec2/scripts/deploy-app.sh
- ops/ec2/scripts/post-deploy-smoke.sh

Guardrails:
- no borres ni modifiques los seeds de prueba;
- no uses valores demo en produccion;
- no resetees la base de datos;
- no inventes secretos ni dominios: si faltan, detente y pedimelos;
- no cambies el flujo de deploy por uno distinto al del repo;
- no dejes TLS pendiente;
- valida nginx -t antes de recargar;
- valida systemctl status comanda-backend;
- valida /api/health, /api/ready y /menu;
- deja un resumen final corto con pasos ejecutados, checks y cualquier riesgo pendiente real.
```

## Checklist de salida que debe cumplir Codex

Al terminar, Codex tiene que haber confirmado todo esto:

- `nginx -t` OK
- `systemctl status comanda-backend` OK
- `systemctl status comanda-backup.timer` OK
- `systemctl status comanda-maintenance.timer` OK
- `https://tu-dominio.com/api/health` responde
- `https://tu-dominio.com/api/ready` responde
- `https://tu-dominio.com/menu` responde
- frontend build completado
- migraciones Prisma aplicadas
- bootstrap ejecutado
- `UPLOADS_DIR` apuntando a `/opt/comanda/uploads`

## Guardrails humanos

Antes de dejar que Codex siga solo, verifica manualmente:

- que `/opt/comanda/backend/.env` tenga secretos reales;
- que el dominio real este configurado en `ops/ec2/nginx/comanda.conf`;
- que la config de nginx ya tenga el dominio correcto antes de correr `certbot --nginx`;
- que Certbot pueda emitir certificados para ese dominio;
- que no estes trabajando contra una base equivocada.

## Cuando conviene frenar y responderle a Codex

Detenelo o respondé antes de que siga si:

- te pide secretos faltantes;
- detecta que el dominio no resuelve;
- detecta certificados inexistentes o invalidos;
- ve una inconsistencia entre la instancia y el repo;
- encuentra que la base de datos apunta a un entorno que no queres tocar.

## Verificacion final manual

Cuando Codex termine:

```bash
curl -fsS https://tu-dominio.com/api/health
curl -fsS https://tu-dominio.com/api/ready
curl -fsS https://tu-dominio.com/menu >/dev/null
systemctl --no-pager --full status comanda-backend
```

Si todo responde bien, el deploy quedo listo desde la propia EC2 siguiendo el pack oficial del repo.
