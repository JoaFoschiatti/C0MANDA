# Politica de retencion S3

El pack `ops/ec2` versiona una politica base de lifecycle en [`../../ops/ec2/s3-lifecycle-policy.json`](../../ops/ec2/s3-lifecycle-policy.json).

## Baseline

- `backups/`: expiracion a 30 dias y versiones no actuales a 90 dias.
- `uploads/`: expiracion a 90 dias y versiones no actuales a 180 dias.
- `AbortIncompleteMultipartUpload`: 7 dias para ambos prefijos.

## Aplicacion

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket <tu-bucket> \
  --lifecycle-configuration file:///opt/comanda/ops/ec2/s3-lifecycle-policy.json
```

## Notas operativas

- La expiracion de versiones no actuales requiere versionado activo en el bucket.
- Si el negocio necesita retencion mayor por cumplimiento, ajusta el JSON versionado y documenta el cambio en el mismo PR.
- La politica cubre el prefijo de dumps de base y el de respaldo de `uploads`; no reemplaza un restore drill periodico.
