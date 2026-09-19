# Volumes Cinder 10 restants (available)

`pvc-*` + `data-01`, `available`/non-attachés. Suppression rate-limitée classifier.

## Dry-run (pas de delete auto)
```bash
docker exec synelia-cloud-backend-worker-1 python3 tools/infra-orphans-dryrun.py
```

Garder `available` filtré par `attachments==0`.
