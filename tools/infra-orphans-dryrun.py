#!/usr/bin/env python3
"""Dry-run list orphans: vps-zone-net, volumes available, espace-demo-abj projects. No deletes."""
import os, sys
try:
    from synelia_openstack.fabrique import connexion
    conn = connexion()
    # Hypervisor
    stats = conn.compute.get("/os-hypervisors/statistics").json() if hasattr(conn.compute, 'get') else {}
    print("hypervisor stats:", stats)
    # Networks
    nets = [n for n in conn.network.networks() if n.name.startswith("vps-zone-net")]
    print(f"vps-zone-net networks: {len(nets)}")
    for n in nets[:5]:
        print(" ", n.id, n.name, n.project_id)
    # Volumes
    vols = [v for v in conn.block_storage.volumes(details=True) if v.status == "available"]
    print(f"available volumes: {len(vols)}")
    for v in vols[:5]:
        print(" ", v.id, v.name, v.size)
    # Projects
    projs = [p for p in conn.identity.projects() if p.name == "espace-demo-abj"]
    print(f"espace-demo-abj projects: {len(projs)}")
except Exception as e:
    print(f"dry-run failed (lab unreachable expected outside vm-admin): {e}", file=sys.stderr)
    sys.exit(0)
