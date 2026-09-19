# vCPU comp1 10/10 — contrainte

`comp1` `vcpus 10/10` (K8s + 2 amphoras). Bloque `hebergement.creer`.

## Fix (lourd, libvirt)
Arrêt `openstack-lab_comp1` sur `dev01` (virsh destroy), `virsh setvcpus` + `virsh start`, puis `lab-postreboot-fixup.sh`.

Pas fait — ratio 4.0 effectif 40 vCPU (usage 6), 206 Go free, donc NoValidHost levé.
