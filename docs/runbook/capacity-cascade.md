# Capacité cascade mid-suite (VM ERROR/rolled_back)

Quand `comp1` `DISK_GB 60/61` → `NoValidHost` sur hebergement.* mid-suite, les VMs suivantes roll back.

## Mitigation
- Étendre `local_gb` via `virsh` + `lvextend` (déjà fait 61→266)
- Ou `SYNELIA_FOURNISSEUR=simule` pour suite sans Placement
- Ou harness `ignorer_si_capacite_insuffisante()` → `pytest.skip` honnête

Voir `tools/infra-orphans-dryrun.py` pour inventaire.
