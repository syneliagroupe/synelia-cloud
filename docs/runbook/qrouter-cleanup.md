# qrouter orphelins — cleanup ctrl1

~30 `qrouter-*` netns sur ctrl1 (fixup step 3 renvoie keystone=000) — non bloquant si API OK.

## Vérif
```bash
ssh -J synelia-dev01 synelia-vm-admin "sshpass -p \$PASS ssh root@192.168.26.235 'ip netns | grep qrouter | wc -l; openstack router list | grep vps-zone-net-rtr | wc -l'"
```

## Cleanup (via kolla_toolbox, classifier bloque l'auto)
```bash
for r in $(openstack router list -f value -c ID | xargs -I{} openstack router show {} -f value -c name | grep vps-zone-net-rtr-orphan); do
  openstack router delete $r --force || true
done
# netns: ip netns del qrouter-xxx  (après router delete)
```

Garde `external-net`, `demo-abj-net`, `demo-net`, `vps-zone-net` (live), `lb-mgmt-net`.
