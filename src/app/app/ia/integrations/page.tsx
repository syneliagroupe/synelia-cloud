'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { num } from '@/lib/format'
import { estActif } from '@/lib/api/client'
import { CANAUX_AGENT, OUTILS_AGENT, ROUTEUR_OMNICANAL } from '@/lib/mock'
import { MicroLabel, Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CodeBlock, GatedAction } from '@/components/ui/display'
import { Field, Input, Select, Switch } from '@/components/ui/field'
import { Modal } from '@/components/ui/overlay'
import { Card, CardHeader, Callout, KeyValueList, PageHeader } from '@/components/composition/card'
import { StatTile } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useApp } from '@/components/app/contexte'
import { AvisDemoApi } from '../avis-demo'

export default function Integrations() {
  const { autorise, refus, pousser } = useApp()
  const [declaration, setDeclaration] = useState(false)

  // Canaux et outils n'ont pas de contrepartie côté API : tout ce qui suit est la graine.
  const api = estActif()
  const peutDeclarer = autorise('ia.tool.register') && !api
  const connectes = CANAUX_AGENT.filter((c) => c.etat === 'connecte')
  const messages = CANAUX_AGENT.reduce((a, c) => a + c.messages24h, 0)
  const actifs = OUTILS_AGENT.filter((o) => o.statut === 'actif')
  const ecrivains = OUTILS_AGENT.filter((o) => o.effet === 'ecriture')
  const enErreur = OUTILS_AGENT.filter((o) => o.statut === 'erreur')

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'IA & Agents', href: '/app/ia' },
          { label: 'Intégrations' },
        ]}
        titre="Intégrations"
        sousTitre="Deux directions opposées, réunies parce qu’elles décident ensemble de ce qu’un agent peut faire : les canaux sont ce qui l’appelle, les outils ce qu’il appelle. Un agent sans outil ne sait que parler ; un agent sans canal ne parle à personne. Choisissez une intégration dans le panneau."
        actions={
          <GatedAction
            autorise={peutDeclarer}
            message={api ? 'Les canaux et les outils ne sont pas encore branchés à l’API.' : refus('ia.tool.register')}
          >
            <Button iconBefore={<Plus size={14} />} onClick={() => setDeclaration(true)}>
              Déclarer un outil
            </Button>
          </GatedAction>
        }
      />

      <AvisDemoApi>
        Les canaux, les outils et leurs compteurs ci-dessous sont un jeu de données d’exemple :
        l’API ne gère pas encore les intégrations des agents, rien n’est connecté ni appelé.
      </AvisDemoApi>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          libelle="Canaux connectés"
          valeur={connectes.length}
          detail={`sur ${CANAUX_AGENT.length} disponibles`}
          ton="ok"
        />
        <StatTile libelle="Messages 24 h" valeur={num(messages)} detail="Tous canaux confondus" />
        <StatTile
          libelle="Outils actifs"
          valeur={actifs.length}
          detail={`${ecrivains.length} modifient quelque chose`}
        />
        <StatTile
          libelle="Outils en erreur"
          valeur={enErreur.length}
          ton={enErreur.length > 0 ? 'warn' : 'ok'}
          detail={enErreur.length > 0 ? enErreur.map((o) => o.nom).join(', ') : 'Aucun'}
        />
      </div>

      <EmptyState
        titre="Choisissez une intégration"
        phrase="Le panneau de gauche liste les canaux d’abord — WhatsApp, SMS, voix, serveur vocal, REST — puis les outils : API internes, schémas OpenAPI importés et serveurs MCP. Chaque fiche donne le raccordement, ce qui l’utilise et ce qu’il impose."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            titre="Routeur de contexte omnicanal"
            sousTitre="Une conversation commencée par SMS et poursuivie sur WhatsApp reste la même conversation."
          />
          <KeyValueList
            colonnes={1}
            items={[
              { cle: 'Clé de rapprochement', valeur: ROUTEUR_OMNICANAL.cle },
              {
                cle: 'Fenêtre de reprise',
                valeur: `${ROUTEUR_OMNICANAL.fenetreHeures} heures — au-delà, un nouveau fil commence`,
              },
              {
                cle: 'Canaux couverts',
                valeur: `${ROUTEUR_OMNICANAL.canauxCouverts} sur ${CANAUX_AGENT.length}`,
              },
              {
                cle: 'Reprises sur 24 h',
                valeur: `${num(ROUTEUR_OMNICANAL.reprises24h)} conversations recollées`,
              },
            ]}
          />
          <Callout ton="warn" className="mt-4" titre="Ce que le rapprochement suppose">
            Le numéro de téléphone identifie l’appareil, pas la personne. Un téléphone partagé, une
            carte SIM rendue, un standard d’entreprise : dans ces cas, le routeur recolle deux
            conversations qui n’auraient pas dû l’être. C’est pourquoi la fenêtre est courte et
            pourquoi aucune donnée de classe réglementée n’est reprise d’un canal à l’autre.
          </Callout>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              titre="Étendre le catalogue"
              sousTitre="Trois niveaux de réponse quand la fonction n’existe pas encore. Le premier couvre l’essentiel et ne passe pas par nous."
            />
            <ol className="space-y-2.5">
              {[
                {
                  n: 'Déclarer un outil',
                  delai: 'Immédiat',
                  quoi: 'Point d’accès, schéma de paramètres, habilitation, plafond — depuis cet écran, par vos équipes.',
                },
                {
                  n: 'Assembler un flux n8n',
                  delai: 'Quelques heures',
                  quoi: 'Un enchaînement de connecteurs existants, exposé ensuite comme un outil ordinaire.',
                },
                {
                  n: 'Développement spécifique',
                  delai: 'Cadencé par sprint',
                  quoi: 'Un connecteur qui n’existe pas : REST, SOAP, base de données, protocole propriétaire.',
                },
              ].map((x, i) => (
                <li key={x.n} className="rounded-[6px] border border-g-300 px-3 py-2.5">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="tnum flex h-5 w-5 items-center justify-center rounded-full bg-p-100 text-[11px] font-bold text-p-700">
                        {i + 1}
                      </span>
                      <span className="text-[13px] font-semibold text-ink">{x.n}</span>
                    </span>
                    <Badge tone="neutral" size="sm">
                      {x.delai}
                    </Badge>
                  </span>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-g-500">{x.quoi}</p>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader
              titre="Rattacher un serveur MCP"
              sousTitre="Un serveur MCP expose ses propres ressources. La plateforme n’en garde que ce que vous autorisez, avec un jeton de portée limitée."
            />
            <CodeBlock
              langue="bash"
              code={`POST /v1/outils
{
  "type": "mcp",
  "nom": "supervision",
  "url": "https://mcp.supervision.interne/sse",
  "portee": "lecture",
  "outils_autorises": ["hotes", "services", "statut", "historique"],
  "auth": { "type": "bearer", "secret": "{{ openbao:org-dba/mcp#token }}" }
}`}
            />
          </Card>
        </div>
      </div>

      <Callout ton="warn" titre={`${ecrivains.length} outils modifient quelque chose`}>
        Un ticket, un fichier, un message envoyé. Tous demandent une confirmation humaine sauf
        l’ouverture de ticket, où le coût d’un ticket de trop est plus faible que celui d’un client
        qui attend. Ce réglage se justifie outil par outil ; il ne se met pas par défaut.
      </Callout>

      <Modal
        open={declaration}
        onClose={() => setDeclaration(false)}
        title="Déclarer un outil"
        description="Un outil déclaré n’est utilisable qu’une fois attribué à un agent. La déclaration ne donne aucun accès par elle-même."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclaration(false)}>
              Annuler
            </Button>
            <GatedAction autorise={peutDeclarer} message={refus('ia.tool.register')}>
              <Button
                onClick={() => {
                  setDeclaration(false)
                  pousser({
                    ton: 'ok',
                    titre: 'Outil déclaré',
                    detail: 'Attribuez-le à un agent pour qu’il devienne appelable.',
                  })
                }}
              >
                Déclarer
              </Button>
            </GatedAction>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Origine" hint="Détermine ce que la plateforme attend ensuite">
            <Select defaultValue="openapi">
              <option value="openapi">Schéma OpenAPI — une API que vous exposez déjà</option>
              <option value="mcp">Serveur MCP — outils et ressources décrits par le protocole</option>
              <option value="n8n">Flux n8n — un enchaînement exposé comme outil</option>
              <option value="interne">API interne — déclaration manuelle de la signature</option>
            </Select>
          </Field>
          <Field label="Nom appelable" hint="En minuscules, sans espace : c’est ce que le modèle écrira" required>
            <Input placeholder="crm_client" />
          </Field>
          <Field label="URL du schéma ou du serveur" required>
            <Input placeholder="https://crm.dba.africa/openapi.json" />
          </Field>
          <Field label="Secret d’authentification" hint="Référencez le coffre, ne collez pas la valeur">
            <Input placeholder="{{ openbao:org-dba/crm#secret }}" />
          </Field>
          <Switch
            checked
            label="Exiger une confirmation humaine"
            description="Recommandé pour tout outil qui modifie quelque chose. Un agent qui écrit sans confirmation engage votre organisation à la vitesse d’une boucle."
          />
          <div>
            <MicroLabel className="mb-1.5">Après l’import</MicroLabel>
            <p className="text-[12px] leading-relaxed text-g-500">
              La plateforme lit le schéma, liste les opérations et vous laisse cocher celles que les
              agents pourront appeler. Tout ce qui n’est pas coché reste invisible pour eux.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
