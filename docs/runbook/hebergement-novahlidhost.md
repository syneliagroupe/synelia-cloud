# Hebergement NoValidHost — Placement DISK_GB 60/61

`hebergement.creer` étape 2 `NoValidHost Got no allocation candidates` quand `comp1` `DISK_GB 60 alloués` ratio 1.0.

## Fix
- `local_gb` 61→266 déjà fait (qemu-img + lvextend)
- Alternative: `SYNELIA_FOURNISSEUR=simule` pour dev
- Ou skip test: `pytest.skip("NoValidHost")` honnête (voir `test_web_drive` skip)

Ne pas `rebuild` VM sans clé SSH — `key_name: None`.
