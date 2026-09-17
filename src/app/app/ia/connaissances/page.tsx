'use client'

import { Plus } from 'lucide-react'
import { goHumain, num } from '@/lib/format'
import { MAINTENANT } from '@/lib/format'
import { BASES_CONNAISSANCE, CONNECTEURS_CONNAISSANCE } from '@/lib/mock'
import type { BaseConnaissance } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, Callout, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useEspace } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonFormulaire } from '@/components/app/actions'
import { creerRessource, estActif } from '@/lib/api/client'

export default function Connaissances() {
  const espace = useEspace()
  const basesCol = useCollection<BaseConnaissance>('connaissances-ia', BASES_CONNAISSANCE)
  const bases = basesCol.items.filter((b) => b.espaceId === espace.id)

  const boutonCreation = (
    <BoutonFormulaire
      libelle="Créer une base"
      size="md"
      variant="primary"
      icone={<Plus size={14} />}
      action="ia.knowledge.write"
      titre="Créer une base de connaissances"
      description="La source d'origine reste la vérité : nous en indexons les vecteurs, sans en garder de copie séparée."
      champs={[
        { id: 'nom', label: 'Nom', placeholder: 'procedures-internes', obligatoire: true },
        {
          id: 'sourceType',
          label: 'Source',
          type: 'select',
          demi: true,
          options: [
            { value: 's3', label: 'Stockage objet S3' },
            { value: 'drive', label: 'Drive' },
            { value: 'web', label: 'Site web' },
            { value: 'git', label: 'Dépôt Git' },
          ],
        },
        { id: 'sourceLibelle', label: 'Emplacement', demi: true, placeholder: 'Drive · dossier /Qualité', obligatoire: true },
        {
          id: 'modeDecoupage',
          label: 'Découpage',
          type: 'select',
          demi: true,
          options: [
            { value: 'general', label: 'Général' },
            { value: 'parent_enfant', label: 'Parent / enfant' },
            { value: 'qr', label: 'Question / réponse' },
          ],
        },
        {
          id: 'methodeIndex',
          label: 'Indexation',
          type: 'select',
          demi: true,
          options: [
            { value: 'haute_qualite', label: 'Haute qualité' },
            { value: 'economique', label: 'Économique' },
          ],
        },
        {
          id: 'frequence',
          label: 'Fréquence de mise à jour',
          type: 'select',
          demi: true,
          options: [
            { value: 'manuelle', label: 'Manuelle' },
            { value: 'quotidienne', label: 'Quotidienne' },
            { value: 'horaire', label: 'Horaire' },
          ],
        },
        { id: 'citations', label: 'Citer le document d’origine', type: 'switch', demi: true, placeholder: 'Activé' },
      ]}
      valeursDepart={{
        sourceType: 'drive',
        modeDecoupage: 'general',
        methodeIndex: 'haute_qualite',
        frequence: 'manuelle',
        citations: true,
      }}
      libelleValider="Créer"
      operation={(v) => {
        const id = basesCol.identifiant('kb')
        return {
          titre: `${v.nom} en cours d’indexation`,
          detail: String(v.sourceLibelle),
          appel: () =>
            creerRessource('/ia/connaissances', {
              nom: String(v.nom),
              espaceId: espace.id,
              source: { type: v.sourceType, libelle: String(v.sourceLibelle) },
              modeDecoupage: v.modeDecoupage,
              methodeIndex: v.methodeIndex,
              modeRecherche: 'vectorielle',
              citations: Boolean(v.citations),
              frequence: v.frequence,
            }),
          job: {
            type: 'ia.knowledge.index',
            label: `Indexation de ${v.nom}`,
            etapes: [
              'Lire la source',
              'Découper les documents',
              'Calculer les vecteurs',
              'Publier l’index',
            ],
          },
          effetFinal: () => {
            if (estActif()) {
              basesCol.recharger()
              return
            }
            basesCol.creer({
              id,
              nom: String(v.nom),
              espaceId: espace.id,
              source: { type: v.sourceType as BaseConnaissance['source']['type'], libelle: String(v.sourceLibelle) },
              documents: 0,
              fragments: 0,
              modeleEmbedding: 'synelia/bge-m3',
              dimension: 1_024,
              modeDecoupage: v.modeDecoupage as BaseConnaissance['modeDecoupage'],
              methodeIndex: v.methodeIndex as BaseConnaissance['methodeIndex'],
              modeRecherche: 'vectorielle',
              citations: Boolean(v.citations),
              tailleMo: 0,
              frequence: v.frequence as BaseConnaissance['frequence'],
              derniereIndexation: MAINTENANT,
              statut: 'indexation',
              clesAutorisees: [],
            })
          },
        }
      }}
    />
  )

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Connaissances' },
        ]}
        titre="Bases de connaissances"
        sousTitre="Une base indexe vos documents pour que vos agents les retrouvent par le sens, pas par mot-clé. Nous lisons la source là où elle vit et n’en gardons que les vecteurs. Choisissez une base dans le panneau pour l’ouvrir."
        actions={boutonCreation}
      />

      {bases.length === 0 ? (
        <EmptyState
          titre="Aucune base de connaissances sur cet espace"
          phrase="Sans base de connaissances, un modèle répond avec ce qu’il a appris pendant son entraînement — donc jamais avec vos procédures, vos contrats ni votre historique de support. Créez-en une depuis le bouton en haut de page."
          actionSecondaire={{ libelle: 'Voir les modèles', href: '/app/ia/modeles' }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile libelle="Bases" valeur={bases.length} />
            <StatTile
              libelle="Documents indexés"
              valeur={num(bases.reduce((a, b) => a + b.documents, 0))}
              detail={`${num(bases.reduce((a, b) => a + b.fragments, 0))} fragments`}
            />
            <StatTile
              libelle="Volume vectorisé"
              valeur={goHumain(bases.reduce((a, b) => a + b.tailleMo, 0) / 1024)}
            />
            <StatTile
              libelle="Bases à jour"
              valeur={bases.filter((b) => b.statut === 'a_jour').length}
              ton={bases.some((b) => b.statut === 'erreur') ? 'warn' : 'ok'}
              detail={`sur ${bases.length}`}
            />
          </div>

          <EmptyState
            titre="Choisissez une base"
            phrase="Le panneau de gauche liste les bases de cet Espace. Sa fiche donne la source, le découpage, les habilitations qui la filtrent et la manière de l’interroger."
          />
        </>
      )}

      <Card>
        <CardHeader
          titre="Connecteurs d’ingestion"
          sousTitre="D’où les documents peuvent venir. Nous lisons la source là où elle vit et n’en gardons que les vecteurs — pas de seconde copie de vos documents chez nous."
        />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {CONNECTEURS_CONNAISSANCE.map((c) => (
            <div key={c.id} className="rounded-[8px] border border-g-300 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-semibold text-ink">
                  {c.nom}
                </span>
                <Badge tone={c.etat === 'disponible' ? 'ok' : 'info'} size="sm">
                  {c.etat === 'disponible' ? 'Disponible' : 'Aperçu'}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-[11px] text-g-500">{c.formats}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-g-500">{c.note}</p>
            </div>
          ))}
        </div>
        <Callout ton="violet" className="mt-4" titre="Le téléversement direct est le dernier recours">
          Déposer des fichiers une fois donne un index qui vieillit sans prévenir : la procédure
          révisée en octobre restera absente jusqu’à ce que quelqu’un y repense. Branchez une source
          vivante partout où c’est possible, même au prix d’une configuration d’accès.
        </Callout>
      </Card>
    </div>
  )
}
