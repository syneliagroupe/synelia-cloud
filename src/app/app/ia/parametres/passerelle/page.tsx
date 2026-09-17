'use client'

import { useState } from 'react'
import { Ban, Lock, Plus, RotateCw } from 'lucide-react'
import { MAINTENANT, dateCourte, jetons, money, num, relatif } from '@/lib/format'
import { CLASSE_DONNEES_LABEL, type ClasseDonnees, type CleIA } from '@/lib/types'
import { CLES_IA, COFFRE_CLES_FOURNISSEURS, MODELES_IA, PASSERELLE_IA } from '@/lib/mock'
import type { ModeleIA } from '@/lib/types'
import { creerRessource, estActif } from '@/lib/api/client'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { CodeBlock, CopyField, GatedAction } from '@/components/ui/display'
import { Checkbox } from '@/components/ui/field'
import { ConfirmDialog } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { DataTable, type Colonne } from '@/components/composition/data-table'
import { QuotaBar, StatTile } from '@/components/composition/metrics'
import { LogPeek } from '@/components/business/observabilite'
import { JOURNAL_PASSERELLE } from '@/lib/mock/ia'
import { useApp, useEspace, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonFormulaire, useOperation } from '@/components/app/actions'

const TON_STATUT = { active: 'ok', suspendue: 'warn', revoquee: 'neutral' } as const
const LIBELLE_STATUT = { active: 'Active', suspendue: 'Suspendue', revoquee: 'Révoquée' } as const

export default function Passerelle() {
  const maintenant = useMaintenant()
  const espace = useEspace()
  const { autorise, refus, pousser } = useApp()
  const executer = useOperation()
  const [aRevoquer, setARevoquer] = useState<CleIA | null>(null)
  const [creationOuverte, setCreationOuverte] = useState(false)
  /** Secret renvoyé une seule fois à la création d’une clé IA. */
  const [secretCree, setSecretCree] = useState<{ prefixe: string; secret: string } | null>(null)
  const [modelesChoisis, setModelesChoisis] = useState<Set<string>>(new Set())

  const clesCol = useCollection<CleIA>('cles-ia', CLES_IA)
  const modelesCol = useCollection<ModeleIA>('modeles-ia', MODELES_IA)
  const modeles = modelesCol.items
  const cles = clesCol.items.filter((c) => c.espaceId === espace.id)
  const actives = cles.filter((c) => c.statut === 'active')
  const jetonsConsommes = actives.reduce((a, c) => a + c.jetonsConsommes, 0)
  const budget = actives.reduce((a, c) => a + c.budgetMensuel, 0)
  const depense = actives.reduce((a, c) => a + c.budgetConsomme, 0)
  // Vérifié en direct sur la passerelle LiteLLM (`/v1/models` + un appel réel
  // par modèle) : les huit modèles du catalogue OpenRouter répondent tous.
  // `invocable` distingue ceux réellement appelables des entrées catalogue
  // (embedding, reranker…) qui n'ont pas d'équivalent chat sur cette route.
  const modelesInvocables = modeles.filter((m) => m.invocable)
  // Le backend réel ne renvoie jamais la chaîne nue `'tous'` : `modelesAutorises`
  // est toujours un tableau, valant `['tous']` par défaut. La maquette, elle,
  // utilise encore le sentinel nu dans `mock/ia.ts` — les deux formes comptent.
  const estTous = (m: CleIA['modelesAutorises']) => (Array.isArray(m) ? m.includes('tous') : true)

  const colonnes: Array<Colonne<CleIA>> = [
    {
      id: 'nom',
      entete: 'Clé',
      cle: (c) => c.nom,
      rendu: (c) => (
        <span className="block">
          <span className="block text-[12.5px] font-semibold text-ink">{c.nom}</span>
          <span className="block font-mono text-[11px] text-g-500">{c.prefixe}…</span>
        </span>
      ),
    },
    {
      id: 'usage',
      entete: 'Usage déclaré',
      masquable: true,
      cle: (c) => c.usage,
      rendu: (c) => <span className="text-[12px] text-g-700">{c.usage}</span>,
    },
    {
      id: 'modeles',
      entete: 'Modèles autorisés',
      cle: (c) => (estTous(c.modelesAutorises) ? 'tous' : c.modelesAutorises.length),
      rendu: (c) =>
        estTous(c.modelesAutorises) ? (
          <Badge tone="warn" size="sm">
            Tout le catalogue
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            {c.modelesAutorises.length} modèle{c.modelesAutorises.length > 1 ? 's' : ''}
          </Badge>
        ),
    },
    {
      id: 'quota',
      entete: 'Quota de jetons',
      largeur: 'w-52',
      cle: (c) => c.jetonsConsommes / c.quotaJetonsMois,
      rendu: (c) => (
        <QuotaBar
          utilise={c.jetonsConsommes}
          total={c.quotaJetonsMois}
          compact
          seuil={90}
          formateur={(v) => jetons(v)}
        />
      ),
    },
    {
      id: 'budget',
      entete: 'Dépense du mois',
      aligne: 'right',
      cle: (c) => c.budgetConsomme,
      rendu: (c) => (
        <span className="block">
          <span className="tnum block text-[12.5px] font-semibold text-ink">
            {money(c.budgetConsomme)}
          </span>
          <span className="tnum block text-[11px] text-g-500">plafond {money(c.budgetMensuel)}</span>
        </span>
      ),
    },
    {
      id: 'residence',
      entete: 'Classe maximale',
      masquable: true,
      cle: (c) => c.residenceMax,
      rendu: (c) => (
        <Badge tone={c.residenceMax === 'reglementee' ? 'violet' : 'neutral'} size="sm">
          {CLASSE_DONNEES_LABEL[c.residenceMax]}
        </Badge>
      ),
    },
    {
      id: 'utilisation',
      entete: 'Dernier appel',
      masquable: true,
      cle: (c) => c.derniereUtilisation ?? '',
      rendu: (c) => (
        <span className="text-[12px] text-g-500">
          {c.derniereUtilisation ? relatif(c.derniereUtilisation, maintenant) : 'Jamais'}
        </span>
      ),
    },
    {
      id: 'statut',
      entete: 'État',
      cle: (c) => c.statut,
      rendu: (c) => (
        <Badge tone={TON_STATUT[c.statut]} dot size="sm">
          {LIBELLE_STATUT[c.statut]}
        </Badge>
      ),
    },
    {
      id: 'actions',
      entete: '',
      aligne: 'right',
      rendu: (c) => (
        <span className="flex justify-end gap-1">
          <GatedAction autorise={autorise('ia.key.manage')} message={refus('ia.key.manage')}>
            <IconButton
              label={`Faire tourner la clé ${c.nom}`}
              variant="ghost"
              size="sm"
              disabled={c.statut !== 'active'}
              onClick={() =>
                executer({
                  action: 'ia.key.manage',
                  titre: `Clé ${c.nom} tournée`,
                  detail:
                    'L’ancien secret cesse de fonctionner immédiatement — copiez le nouveau dans vos applications.',
                  appel: () =>
                    creerRessource(`/ia/cles/${c.id}/rotation`, {}).then((reponse) => {
                      const r = reponse as { cle?: { prefixe?: string }; secret?: string } | null
                      if (r?.secret) {
                        setSecretCree({ prefixe: String(r.cle?.prefixe ?? c.prefixe), secret: r.secret })
                      }
                      return reponse
                    }),
                  effet: () =>
                    setSecretCree({
                      prefixe: c.prefixe,
                      secret: `${c.prefixe}.${clesCol.identifiant('tournee')}`,
                    }),
                  effetFinal: () => clesCol.recharger(),
                })
              }
            >
              <RotateCw size={13} />
            </IconButton>
          </GatedAction>
          <GatedAction autorise={autorise('ia.key.manage')} message={refus('ia.key.manage')}>
            <IconButton
              label={`Révoquer la clé ${c.nom}`}
              variant="ghost"
              size="sm"
              onClick={() => setARevoquer(c)}
              disabled={c.statut === 'revoquee'}
            >
              <Ban size={13} />
            </IconButton>
          </GatedAction>
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Paramètres', href: '/app/ia/parametres' },
          { label: 'Passerelle & clés' },
        ]}
        titre="Passerelle & clés d’accès"
        sousTitre="Une seule URL pour tous les modèles, une clé par application. Le quota, le plafond de dépense et la classe de données maximale se règlent sur la clé, pas dans votre code — vous pouvez donc les changer sans redéployer."
        actions={
          <BoutonFormulaire
            libelle="Créer une clé"
            variant="primary"
            icone={<Plus size={14} />}
            action="ia.key.manage"
            titre="Créer une clé d’accès"
            description="Le secret complet n’est affiché qu’une fois, à la création. Nous ne le stockons pas en clair et ne pouvons pas vous le redonner."
            ouvert={creationOuverte}
            onOuvertChange={setCreationOuverte}
            champs={[
              {
                id: 'nom',
                label: 'Nom',
                hint: 'Application et environnement, par exemple app-metier · production',
                placeholder: 'facturation · production',
                obligatoire: true,
              },
              {
                id: 'usage',
                label: 'Usage déclaré',
                hint: 'Sert au showback et à l’audit ; visible par les administrateurs',
                placeholder: 'Résumés de dossiers dans le back-office',
              },
              {
                id: 'quotaMillions',
                label: 'Quota mensuel',
                type: 'nombre',
                demi: true,
                hint: 'En millions de jetons',
                min: 1,
              },
              {
                id: 'budgetMensuel',
                label: 'Plafond de dépense',
                type: 'nombre',
                demi: true,
                hint: 'En FCFA hors taxes, 0 = aucun plafond',
                min: 0,
              },
              {
                id: 'residenceMax',
                label: 'Classe de données maximale',
                type: 'select',
                options: [
                  { value: 'publique', label: 'Publique — sortie de territoire autorisée' },
                  { value: 'interne', label: 'Interne — sortie vers l’Union européenne' },
                  { value: 'personnelle', label: 'À caractère personnel — territoire uniquement' },
                  { value: 'reglementee', label: 'Réglementée — territoire uniquement, trace cinq ans' },
                ],
              },
            ]}
            valeursDepart={{ quotaMillions: 100, budgetMensuel: 60000, residenceMax: 'interne' }}
            libelleValider="Créer la clé"
            complement={() => (
              <div>
                <MicroLabel className="mb-2">Modèles autorisés</MicroLabel>
                <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-[6px] border border-g-300 p-2.5">
                  {modeles
                    .filter((m) => m.statut !== 'retire')
                    .map((m) => (
                      <Checkbox
                        key={m.id}
                        checked={modelesChoisis.has(m.slug)}
                        onChange={(e) =>
                          setModelesChoisis((prev) => {
                            const suivant = new Set(prev)
                            if (e.target.checked) suivant.add(m.slug)
                            else suivant.delete(m.slug)
                            return suivant
                          })
                        }
                        label={`${m.nom} — ${m.hebergement === 'souverain' ? 'territoire' : m.residence}${
                          m.invocable ? '' : ' · non appelable actuellement'
                        }`}
                      />
                    ))}
                </div>
                <p className="mt-1.5 text-[11.5px] text-g-500">
                  Aucune sélection = tous les modèles du catalogue autorisés. Restreindre la liste
                  vaut mieux que tout ouvrir : une clé qui ne peut appeler que deux modèles ne peut
                  pas dériver vers le plus cher du catalogue.
                </p>
              </div>
            )}
            operation={(v) => {
              const nom = String(v.nom)
              const modelesAutorises = Array.from(modelesChoisis)
              const quotaJetonsMois = Math.round(Number(v.quotaMillions || 100) * 1_000_000)
              const budgetMensuel = Math.round(Number(v.budgetMensuel || 0))
              const residenceMax = String(v.residenceMax || 'interne') as ClasseDonnees
              return {
                titre: `Clé ${nom} créée`,
                detail: 'Le secret est affiché une seule fois — copiez-le dans votre coffre.',
                appel: () =>
                  creerRessource('/ia/cles', {
                    nom,
                    espaceId: espace.id,
                    usage: v.usage ? String(v.usage) : undefined,
                    modelesAutorises,
                    quotaJetonsMois,
                    budgetMensuel,
                    residenceMax,
                  }).then((reponse) => {
                    const r = reponse as { cle?: { prefixe?: string }; secret?: string } | null
                    if (r?.secret) setSecretCree({ prefixe: String(r.cle?.prefixe ?? ''), secret: r.secret })
                    return reponse
                  }),
                effet: () =>
                  clesCol.creer({
                    id: clesCol.identifiant('cia'),
                    nom,
                    prefixe: 'cia_demo',
                    espaceId: espace.id,
                    usage: v.usage ? String(v.usage) : '',
                    modelesAutorises: modelesAutorises.length > 0 ? modelesAutorises : ['tous'],
                    quotaJetonsMois,
                    jetonsConsommes: 0,
                    debitMaxParMinute: 60,
                    budgetMensuel,
                    budgetConsomme: 0,
                    auDepassement: 'bloquer',
                    residenceMax,
                    statut: 'active',
                    creeeLe: MAINTENANT,
                    creeePar: 'moi',
                  }),
                effetFinal: () => {
                  clesCol.recharger()
                  setModelesChoisis(new Set())
                },
              }
            }}
          />
        }
      />

      {secretCree && (
        <div className="rounded-[8px] border border-err/40 bg-err-bg px-3.5 py-3">
          <p className="text-[12.5px] font-bold text-ink">
            Copiez ce secret maintenant — il ne sera plus jamais affiché
          </p>
          <p className="mt-1 font-mono text-[12px] break-all text-ink">{secretCree.secret}</p>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setSecretCree(null)}>
            Je l’ai copié, masquer
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            titre="Point d’entrée"
            sousTitre="Compatible avec l’API OpenAI : les bibliothèques officielles fonctionnent sans adaptation."
          />
          <div className="space-y-3">
            <CopyField label="URL de base" value={PASSERELLE_IA.base} />
            <CopyField label="Région" value={PASSERELLE_IA.region} />
            <CopyField
              label="En-tête d’authentification"
              masque
              value="Authorization: Bearer sk-syn-a7f2••••••••••••••••••••"
            />
          </div>
          <div className="mt-4 border-t border-g-100 pt-4">
            <MicroLabel className="mb-2">Points d’API servis</MicroLabel>
            <p className="font-mono text-[11.5px] leading-relaxed text-g-700">
              {PASSERELLE_IA.compatible}
            </p>
          </div>
          <Callout ton="info" className="mt-4" titre="Ce que la passerelle n’expose pas">
            <ul className="mt-1 space-y-1">
              {PASSERELLE_IA.nonSupporte.map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-info" />
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Un appel sur l’une de ces routes répond 501 avec un message qui le dit, plutôt qu’un
              404 qui laisserait croire à une faute de frappe.
            </p>
          </Callout>
          {estActif() && (
            <Callout ton="ok" className="mt-4" titre="Passerelle LiteLLM active, en amont d’OpenRouter">
              {modelesInvocables.length} modèle{modelesInvocables.length > 1 ? 's' : ''} du catalogue
              répond{modelesInvocables.length > 1 ? 'ent' : ''} réellement à un appel de complétion —
              pas une liste déclarée, une vérification faite modèle par modèle contre la passerelle.
              Les autres entrées du catalogue (embedding, reranker…) passent par un autre point d’API
              et ne sont pas comptées ici.
            </Callout>
          )}
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile libelle="Clés actives" valeur={actives.length} detail={`sur ${cles.length} créées`} />
            <StatTile libelle="Jetons consommés" valeur={jetons(jetonsConsommes)} detail="Mois en cours" />
            <StatTile
              libelle="Dépense du mois"
              valeur={money(depense)}
              detail={`sur ${money(budget)} de plafonds cumulés`}
              ton={depense / Math.max(budget, 1) > 0.85 ? 'warn' : undefined}
            />
            <StatTile
              libelle="Latence médiane"
              valeur={`${num(PASSERELLE_IA.latenceP50Ms)} ms`}
              detail={`Erreurs ${PASSERELLE_IA.tauxErreurPct} %`}
              ton="ok"
            />
          </div>
          <Card>
            <CardHeader
              titre="Premier appel"
              sousTitre="Trois lignes suffisent à vérifier qu’une clé fonctionne."
            />
            <CodeBlock
              langue="bash"
              code={`export SYNELIA_IA_KEY="sk-syn-…"

curl ${PASSERELLE_IA.base}/models \\
  -H "Authorization: Bearer $SYNELIA_IA_KEY"`}
            />
          </Card>
        </div>
      </div>

      <Card padding={false}>
        <div className="border-b border-g-100 px-4 py-3">
          <CardHeader
            titre={`Clés de l’espace ${espace.code}`}
            sousTitre="Une clé par application et par environnement : une fuite se révoque alors sans arrêter le reste."
            className="mb-0"
          />
        </div>
        <DataTable
          lignes={cles}
          colonnes={colonnes}
          recherche
          placeholderRecherche="Rechercher une clé, un usage…"
          filtres={[
            {
              id: 'statut',
              libelle: 'État',
              options: [
                { value: 'active', label: 'Actives' },
                { value: 'suspendue', label: 'Suspendues' },
                { value: 'revoquee', label: 'Révoquées' },
              ],
            },
          ]}
          selection={(c, _id, valeur) => c.statut === valeur}
          vide={{
            titre: 'Aucune clé sur cet espace',
            phrase:
              'Une clé porte le quota, le plafond de dépense et la liste des modèles autorisés. Tant qu’il n’en existe pas, la passerelle refuse tous les appels de cet espace.',
            action: { libelle: 'Créer une clé', onClick: () => setCreationOuverte(true) },
          }}
          parPage={10}
        />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            titre="Comportement au dépassement"
            sousTitre="Réglé par clé, parce qu’une coupure n’a pas le même coût sur une recette et sur la production."
          />
          <KeyValueList
            colonnes={1}
            items={actives.map((c) => ({
              cle: c.nom,
              valeur:
                c.auDepassement === 'bloquer'
                  ? 'Coupure au plafond — les appels reçoivent un 402'
                  : 'Alerte seule — les appels passent, la facture suit',
            }))}
          />
          <Callout ton="warn" className="mt-4" titre="Le mode « alerte seule » n’a pas de filet">
            Sur la clé d’exploration, une boucle mal écrite peut dépasser le plafond en une nuit sans
            que rien ne l’arrête. C’est un choix assumé pour ne pas interrompre une analyse en cours
            — pas une protection.
          </Callout>
        </Card>

        <Card>
          <CardHeader
            titre="Journal de la passerelle"
            sousTitre="Vingt dernières lignes. L’historique complet est dans VictoriaLogs."
          />
          <LogPeek lignes={JOURNAL_PASSERELLE} max={20} titre="Appels et décisions" />
        </Card>
      </div>


      <ConfirmDialog
        open={aRevoquer !== null}
        onClose={() => setARevoquer(null)}
        onConfirm={() => {
          if (aRevoquer) clesCol.supprimer(aRevoquer.id, aRevoquer.nom)
          pousser({
            ton: 'warn',
            titre: 'Clé révoquée',
            detail: `${aRevoquer?.nom} — les appels en cours reçoivent un 401 dans les trente secondes.`,
          })
          setARevoquer(null)
        }}
        titre="Révoquer cette clé d’accès"
        ressource={aRevoquer?.nom ?? ''}
        libelleAction="Révoquer"
        pertes={[
          'Tous les appels portant cette clé reçoivent un 401 sous trente secondes',
          'L’application qui l’utilise cesse de répondre tant qu’une nouvelle clé n’est pas déployée',
          `Consommation du mois conservée pour la facturation : ${money(aRevoquer?.budgetConsomme ?? 0)}`,
          'La révocation est immédiate et définitive — une clé ne se réactive pas',
        ]}
      />

      <Callout ton="violet" titre="Où ranger le secret">
        Une clé d’API dans un dépôt git est une fuite qui attend son heure. Référencez le coffre de
        secrets de votre espace —{' '}
        <span className="font-mono text-[12px]">{`{{ vault:org-dba/ia/${espace.code.toLowerCase()}#key }}`}</span>{' '}
        — et faites-la tourner tous les quatre-vingt-dix jours. La rotation crée la nouvelle clé
        avant de retirer l’ancienne, sans interruption. Dernière rotation :{' '}
        {dateCourte('2026-06-09')}.
      </Callout>
    </div>
  )
}
