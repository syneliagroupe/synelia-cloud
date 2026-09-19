# Projets Keystone 8 dupliqués `espace-demo-abj`

Vides (0 VM/réseau/user) mais `delete_project` bloqué classifier (toujours). Coquilles, `openstack project list` bruit.

## Cause
`assurer_secrets_openstack_espace` crée 1 projet/réseau par DB éphémère `pytest` (1/test).

Ne pas marteler `delete_project` — runbook seulement.
