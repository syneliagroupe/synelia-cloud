# Site files upload — UI honest (TODO 194)

`POST /web/sites/{id}/fichiers` n'existe pas.

Implémentation honnête: bouton Upload → `sansApi: "Upload direct non exposé — utiliser SFTP (ecrire_octets) ou catalogue Docker"`

Pattern: `src/components/app/actions.tsx` `sansApi` + `desactive={api}` + Callout.
