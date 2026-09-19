# Applications universe — deploiements vs applications orphelin

`modules/applications/` supprimé PR #15/#17. Source de vérité: `modules/deploiements` + `modules/projets`.

- `POST /environnements` (tag Déploiements) remplace `/applications/{id}/environnements`
- Tests: `uv run pytest apps/synelia/synelia/modules/deploiements -q` 5 passed
- Ne pas utiliser `fix/registre` ancien tag "Applications"

Voir `PLAN-API §3`, `BRANCHEMENT-API.md` (x-etat).
