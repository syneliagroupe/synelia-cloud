'use client'

import { useState } from 'react'
import { cn, seededSeries } from '@/lib/utils'
import { dateCourte, jetons, money, num } from '@/lib/format'
import { FAMILLE_MODELE_LABEL, type FamilleModele, type ModeleIA } from '@/lib/types'
import { MODELES_IA, PASSERELLE_IA } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { CodeBlock, Tabs } from '@/components/ui/display'
import { SegmentedControl } from '@/components/ui/field'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { GrilleSparkCharts } from '@/components/business/observabilite'
import { useCollection } from '@/components/app/atelier'

const ONGLETS = [
  { id: 'fiche', label: 'Fiche' },
  { id: 'tarifs', label: 'Tarif' },
  { id: 'performance', label: 'Performance' },
  { id: 'appel', label: 'Comment l’appeler' },
]

type Filtre = 'tous' | 'souverain' | 'externe'

const FILTRES: Array<{ value: Filtre; label: string }> = [
  { value: 'tous', label: 'Tous' },
  { value: 'souverain', label: 'Souverains' },
  { value: 'externe', label: 'Externes' },
]

/** Requête de référence pour comparer les tarifs : 2 000 jetons entrent, 400 sortent. */
const REFERENCE = { entree: 2_000, sortie: 400, requetes: 1_000 }

function coutReference(m: ModeleIA): number {
  if (m.unite === 'minute') return Math.round(m.prixEntree * 60)
  const entree = (REFERENCE.entree * REFERENCE.requetes * m.prixEntree) / 1_000_000
  const sortie = (REFERENCE.sortie * REFERENCE.requetes * m.prixSortie) / 1_000_000
  return Math.round(entree + sortie)
}

const TON_STATUT = {
  disponible: 'ok',
  apercu: 'info',
  degrade: 'warn',
  retire: 'neutral',
} as const

const LIBELLE_STATUT = {
  disponible: 'Disponible',
  apercu: 'Aperçu',
  degrade: 'Dégradé',
  retire: 'Retiré',
} as const

export function VueModele({ modeleId }: { modeleId: string }) {
  const [onglet, setOnglet] = useState('fiche')
  const modelesCol = useCollection<ModeleIA>('modeles-ia', MODELES_IA)
  const modeles = modelesCol.items
  const modele = modeles.find((m) => m.id === modeleId)

  // Garde après les crochets : la vue dit ce qu'elle ne trouve pas.
  if (!modele) {
    return (
      <EmptyState
        titre="Modèle introuvable"
        phrase="Ce modèle n’est pas au catalogue de votre organisation. Le panneau de gauche liste ceux que vous pouvez appeler."
        action={{ libelle: 'Voir le catalogue', href: '/app/ia/modeles' }}
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Modèles', href: '/app/ia/modeles' },
          { label: modele.nom },
        ]}
        titre={modele.nom}
        sousTitre={modele.description}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={modele.hebergement === 'souverain' ? 'ok' : 'warn'} size="sm">
              {modele.residence}
            </Badge>
            <Badge tone="neutral" size="sm">
              {FAMILLE_MODELE_LABEL[modele.famille]}
            </Badge>
            <Badge tone={TON_STATUT[modele.statut]} size="sm" dot={modele.statut !== 'disponible'}>
              {LIBELLE_STATUT[modele.statut]}
            </Badge>
          </span>
        }
      />

      {modele && (
        <>
          <Tabs tabs={ONGLETS} active={onglet} onChange={setOnglet} />

          {onglet === 'fiche' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader titre={modele.nom} sousTitre={modele.description} />
                <KeyValueList
                  colonnes={1}
                  items={[
                    { cle: 'Identifiant d’appel', valeur: <span className="font-mono text-[12px]">{modele.slug}</span> },
                    { cle: 'Éditeur', valeur: modele.editeur },
                    { cle: 'Famille', valeur: FAMILLE_MODELE_LABEL[modele.famille] },
                    { cle: 'Taille', valeur: modele.parametres ?? '—' },
                    { cle: 'Licence', valeur: modele.licence },
                    {
                      cle: 'Fenêtre de contexte',
                      valeur: modele.contexteJetons > 0 ? `${num(modele.contexteJetons)} jetons` : 'Sans objet',
                    },
                    { cle: 'Résidence du calcul', valeur: modele.residence },
                  ]}
                />
              </Card>
              <div className="space-y-4">
                <Card>
                  <CardHeader titre="Ce à quoi il sert" />
                  <ul className="space-y-1.5">
                    {modele.usages.map((u) => (
                      <li key={u} className="flex items-start gap-2 text-[13px] text-ink">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-p-600" />
                        {u}
                      </li>
                    ))}
                  </ul>
                </Card>
                {modele.hebergement === 'externe' ? (
                  <Callout ton="warn" titre="Ce modèle fait sortir vos données du territoire">
                    Chaque appel part vers cette juridiction — {modele.residence}. La classe de données
                    « réglementée » y est refusée par la politique de résidence, et chaque sortie est
                    comptée dans le journal d’audit. Le contrat cadre Synelia interdit au fournisseur
                    de réutiliser vos requêtes pour l’entraînement, mais il ne les rapatrie pas pour
                    autant.
                  </Callout>
                ) : (
                  <Callout ton="ok" titre="Le calcul a lieu en Côte d’Ivoire">
                    La requête entre et sort de {modele.site === 'ABJ' ? 'Abidjan' : 'Grand-Bassam'} :
                    aucune donnée ne franchit la frontière, aucun sous-traitant étranger n’intervient,
                    et la latence n’inclut pas d’aller-retour transatlantique.
                  </Callout>
                )}
                {modele.statut === 'degrade' && (
                  <Callout ton="warn" titre="Service dégradé, retrait programmé">
                    {modele.remplacePar && (
                      <>
                        Successeur annoncé : <span className="font-mono text-[12px]">{modele.remplacePar}</span>.{' '}
                      </>
                    )}
                    {modele.finDeVie && <>Retrait du catalogue le {dateCourte(modele.finDeVie)}. </>}
                    Les règles de routage qui pointent encore vers ce modèle basculeront
                    automatiquement sur leur repli déclaré.
                  </Callout>
                )}
                {modele.statut === 'apercu' && (
                  <Callout ton="info" titre="En aperçu — aucun engagement de disponibilité">
                    Un modèle en aperçu tourne sur un nœud unique, peut être redémarré sans préavis
                    et ne compte pas dans le calcul du SLA. Utilisez-le pour éprouver un usage, pas
                    pour le mettre en production.
                  </Callout>
                )}
              </div>
            </div>
          )}

          {onglet === 'tarifs' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatTile
                  libelle={modele.unite === 'minute' ? 'Par minute d’audio' : 'Jetons d’entrée'}
                  valeur={money(modele.prixEntree)}
                  detail={modele.unite === 'minute' ? 'Facturé à la seconde près' : 'Par million de jetons'}
                />
                <StatTile
                  libelle="Jetons de sortie"
                  valeur={modele.prixSortie > 0 ? money(modele.prixSortie) : 'Sans objet'}
                  detail={modele.prixSortie > 0 ? 'Par million de jetons' : 'Ce modèle ne génère pas de texte'}
                />
                <StatTile
                  libelle="Requête de référence"
                  valeur={money(coutReference(modele))}
                  detail={
                    modele.unite === 'minute'
                      ? 'Pour 60 minutes d’audio'
                      : '1 000 requêtes de 2 000 jetons entrants et 400 sortants'
                  }
                />
              </div>

              <Card>
                <CardHeader
                  titre="Comparaison sur la même charge"
                  sousTitre="Mille requêtes de 2 000 jetons entrants et 400 jetons sortants, tarif public en FCFA hors taxes."
                />
                <div className="space-y-1.5">
                  {[...modeles]
                    .filter((m) => m.famille === modele.famille && m.unite === modele.unite)
                    .sort((a, b) => coutReference(a) - coutReference(b))
                    .map((m) => {
                      const max = Math.max(
                        ...modeles.filter((x) => x.famille === modele.famille).map(coutReference),
                      )
                      const largeur = max > 0 ? (coutReference(m) / max) * 100 : 0
                      return (
                        <div key={m.id} className="flex flex-wrap items-center gap-3">
                          <span className="w-full min-w-0 truncate text-[13px] text-ink sm:w-52">
                            {m.nom}
                          </span>
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-g-100">
                              <span
                                className={cn(
                                  'block h-full rounded-full',
                                  m.hebergement === 'souverain' ? 'bg-p-600' : 'bg-warn',
                                )}
                                style={{ width: `${Math.max(largeur, 2)}%` }}
                              />
                            </span>
                            <span className="tnum w-24 shrink-0 text-right text-[12px] font-semibold text-ink">
                              {money(coutReference(m))}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                </div>
                <Callout ton="info" className="mt-4" titre="Le prix n’est pas le seul critère">
                  Un modèle deux fois moins cher qui demande deux essais pour donner la bonne réponse
                  coûte davantage. Mesurez sur votre propre charge avant d’arbitrer : la clé
                  d’exploration existe pour cela, et sa dépense est plafonnée.
                </Callout>
              </Card>
            </div>
          )}

          {onglet === 'performance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile libelle="Latence du premier jeton" valeur={`${num(modele.latenceP50Ms)} ms`} ton={modele.latenceP50Ms < 500 ? 'ok' : 'warn'} detail="Médiane sur 24 h" />
                <StatTile
                  libelle="Débit"
                  valeur={modele.debitJetonsSec > 0 ? `${num(modele.debitJetonsSec)} jet/s` : '—'}
                  detail={modele.debitJetonsSec > 0 ? 'Par flux, à charge nominale' : 'Sans objet pour ce modèle'}
                />
                <StatTile
                  libelle="Disponibilité 30 j"
                  valeur={modele.statut === 'apercu' ? 'Non mesurée' : modele.statut === 'degrade' ? '97,2 %' : '99,95 %'}
                  ton={modele.statut === 'disponible' ? 'ok' : 'warn'}
                />
                <StatTile
                  libelle="Distance réseau"
                  valeur={modele.hebergement === 'souverain' ? '< 5 ms' : '180 à 240 ms'}
                  detail={modele.hebergement === 'souverain' ? 'Depuis vos VM d’Abidjan' : 'Aller-retour vers le fournisseur'}
                />
              </div>
              <Card>
                <CardHeader
                  titre="Vingt-quatre dernières heures"
                  sousTitre="Mesures relevées à la sortie de la passerelle, telles que vos applications les subissent."
                />
                <GrilleSparkCharts
                  seed={`ia-${modele.id}`}
                  metriques={[
                    { titre: 'Latence du premier jeton', unite: 'ms', min: modele.latenceP50Ms * 0.7, max: modele.latenceP50Ms * 2.4, seuil: modele.latenceP50Ms * 2 },
                    { titre: 'Requêtes par minute', unite: 'req/min', min: 12, max: 148 },
                    { titre: 'Jetons par seconde', unite: 'jet/s', min: Math.max(modele.debitJetonsSec * 0.6, 10), max: Math.max(modele.debitJetonsSec * 1.3, 40) },
                    { titre: 'Taux d’erreur', unite: '%', min: 0, max: modele.statut === 'degrade' ? 6 : 1.2, seuil: 1, couleur: 'var(--color-warn)' },
                  ]}
                  degrade={modele.statut === 'degrade'}
                />
              </Card>
              <Card>
                <CardHeader titre="File d’attente" sousTitre="Temps passé en file avant le début du traitement, hors génération." />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <StatTile libelle="Médiane" valeur="18 ms" ton="ok" serie={seededSeries(`${modele.id}-q50`, 24, 8, 40)} />
                  <StatTile libelle="p95" valeur="240 ms" serie={seededSeries(`${modele.id}-q95`, 24, 120, 480)} />
                  <StatTile libelle="Requêtes mises en file" valeur="2,4 %" />
                </div>
              </Card>
            </div>
          )}

          {onglet === 'appel' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  titre="En ligne de commande"
                  sousTitre="La passerelle parle le dialecte OpenAI : seuls l’URL de base et la clé changent."
                />
                <CodeBlock
                  langue="bash"
                  code={
                    modele.famille === 'embedding' || modele.famille === 'reranker'
                      ? `curl ${PASSERELLE_IA.base}/embeddings \\
  -H "Authorization: Bearer $SYNELIA_IA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modele.slug}",
    "input": ["Facture impayée depuis 70 jours"]
  }'`
                      : modele.famille === 'transcription'
                        ? `curl ${PASSERELLE_IA.base}/audio/transcriptions \\
  -H "Authorization: Bearer $SYNELIA_IA_KEY" \\
  -F model="${modele.slug}" \\
  -F language=fr \\
  -F file=@appel-2026-08-19.mp3`
                        : `curl ${PASSERELLE_IA.base}/chat/completions \\
  -H "Authorization: Bearer $SYNELIA_IA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modele.slug}",
    "messages": [
      {"role": "user", "content": "Résume ce dossier en cinq lignes."}
    ]
  }'`
                  }
                />
              </Card>
              <div className="space-y-4">
                <Card>
                  <CardHeader
                    titre="Depuis Python"
                    sousTitre="La bibliothèque officielle openai fonctionne telle quelle."
                  />
                  <CodeBlock
                    langue="python"
                    code={`from openai import OpenAI

client = OpenAI(
    base_url="${PASSERELLE_IA.base}",
    api_key=os.environ["SYNELIA_IA_KEY"],
)

reponse = client.chat.completions.create(
    model="${modele.slug}",
    messages=[{"role": "user", "content": "Bonjour"}],
    extra_headers={"x-synelia-classe": "interne"},
)`}
                  />
                </Card>
                <Callout ton="violet" titre="L’en-tête qui compte">
                  <span className="font-mono text-[12px]">x-synelia-classe</span> déclare la
                  sensibilité du contenu envoyé. C’est lui qui décide si la requête a le droit de
                  sortir du territoire, quel garde-fou s’applique et quelle durée de conservation
                  vaut pour la trace. Sans cet en-tête, la passerelle retient la classe la plus
                  contraignante autorisée par la clé.
                </Callout>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
