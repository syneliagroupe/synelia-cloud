import { redirect } from 'next/navigation'

/** Doublon retiré : l'assistant de création de projet vit à `/app/applications/nouveau`. */
export default function NouveauProjet() {
  redirect('/app/applications/nouveau')
}
