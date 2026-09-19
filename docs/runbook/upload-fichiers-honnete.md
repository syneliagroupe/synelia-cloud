# Upload fichiers site — honnête stub (TODO 194)

Aucun `POST /web/sites/{id}/fichiers` n'existe.

**Frontend:** bouton Upload → `sansApi: "Indisponible : l'upload direct n'est pas encore exposé par l'API (utiliser SFTP ecrire_octets via l'hébergement, ou installer via catalogue Docker)."`
**Backend idée:** `POST /web/sites/{id}/fichiers` multipart → `ecrire_octets` SFTP dans racine site.

Ne pas afficher un toast succès sans appel.
