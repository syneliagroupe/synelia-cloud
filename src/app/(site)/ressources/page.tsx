'use client'

import { useMemo, useState } from 'react'
import { BookOpen, Download, FileText, PlayCircle, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RESSOURCES } from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, SearchInput } from '@/components/ui/field'
import { Modal } from '@/components/ui/overlay'
import { Card, CardHeader, Callout } from '@/components/composition/card'
import { EmptyState } from '@/components/composition/states'
import { Container, HeroCourt, SiteSection } from '@/components/site/blocs'

const ICONES: Record<string, React.ReactNode> = {
  'Livre blanc': <BookOpen size={16} />,
  Guide: <FileText size={16} />,
  Webinaire: <PlayCircle size={16} />,
  Étude: <Table2 size={16} />,
  Modèle: <Table2 size={16} />,
}

export default function Ressources() {
  const [q, setQ] = useState('')
  const [type, setType] = useState<string>('tous')
  const [theme, setTheme] = useState<string>('tous')
  const [demande, setDemande] = useState<(typeof RESSOURCES)[number] | null>(null)
  const [courriel, setCourriel] = useState('')
  const [envoye, setEnvoye] = useState(false)

  const types = useMemo(() => Array.from(new Set(RESSOURCES.map((r) => r.type))), [])
  const themes = useMemo(() => Array.from(new Set(RESSOURCES.map((r) => r.theme))), [])

  const resultats = useMemo(
    () =>
      RESSOURCES.filter((r) => {
        if (type !== 'tous' && r.type !== type) return false
        if (theme !== 'tous' && r.theme !== theme) return false
        if (!q.trim()) return true
        const n = q.trim().toLowerCase()
        return r.titre.toLowerCase().includes(n) || r.extrait.toLowerCase().includes(n)
      }),
    [q, type, theme],
  )

  return (
    <>
      <HeroCourt
        surtitre="Ressources"
        titre="Ce que nous avons appris, mis à disposition"
        chapeau="Livres blancs, guides méthodologiques, retours d’expérience chiffrés et modèles réutilisables. Écrits par les équipes qui exploitent la plateforme, pas par un service marketing."
      />

      <SiteSection>
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              placeholder="Rechercher une ressource…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full sm:w-72"
            />
            <p className="tnum text-[13px] text-g-500">
              {resultats.length} ressource{resultats.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="mt-4 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <MicroLabel className="mr-1">Type</MicroLabel>
              <Puce actif={type === 'tous'} onClick={() => setType('tous')}>
                Tous
              </Puce>
              {types.map((t) => (
                <Puce key={t} actif={type === t} onClick={() => setType(t)}>
                  {t}
                </Puce>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <MicroLabel className="mr-1">Thème</MicroLabel>
              <Puce actif={theme === 'tous'} onClick={() => setTheme('tous')}>
                Tous
              </Puce>
              {themes.map((t) => (
                <Puce key={t} actif={theme === t} onClick={() => setTheme(t)}>
                  {t}
                </Puce>
              ))}
            </div>
          </div>

          {resultats.length === 0 ? (
            <EmptyState
              className="mt-8"
              titre="Aucune ressource ne correspond"
              phrase="Élargissez les critères, ou dites-nous quel sujet vous aimeriez voir traité — nous publions en priorité ce que nos clients nous demandent."
              action={{ libelle: 'Suggérer un sujet', href: '/entreprises#contact' }}
            />
          ) : (
            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resultats.map((r) => (
                <Card key={r.titre} className="flex flex-col" hover>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-p-100 text-p-700">
                      {ICONES[r.type] ?? <FileText size={16} />}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone="violet" size="sm">
                        {r.type}
                      </Badge>
                      <span className="text-[11px] text-g-500">{r.duree}</span>
                    </div>
                  </div>
                  <h3 className="mt-3.5 text-[15px] font-bold leading-snug [font-family:var(--font-display)] text-ink">
                    {r.titre}
                  </h3>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-g-700">{r.extrait}</p>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-g-100 pt-3.5">
                    <Badge tone="neutral" size="sm">
                      {r.theme}
                    </Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      iconBefore={
                        r.type === 'Webinaire' ? <PlayCircle size={13} /> : <Download size={13} />
                      }
                      onClick={() => {
                        setEnvoye(false)
                        setDemande(r)
                      }}
                    >
                      {r.type === 'Webinaire' ? 'Regarder' : 'Télécharger'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Container>
      </SiteSection>

      <SiteSection fond="clair">
        <Container taille="md">
          <Card>
            <CardHeader
              titre="Lettre technique mensuelle"
              sousTitre="Un envoi par mois, écrit par l’équipe d’exploitation. Retours d’incident, arbitrages d’architecture, nouveautés de la plateforme."
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                placeholder="prenom.nom@organisation.ci"
                className="flex-1"
                aria-label="Adresse e-mail"
                disabled
              />
              <Button disabled title="Inscription par e-mail pas encore disponible">
                S’abonner
              </Button>
            </div>
            <p className="mt-1.5 text-[11.5px] text-g-500">
              Pas encore disponible : la lettre existe, mais rien n’enregistre encore d’adresse
              depuis cette page.
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-g-500">
              Pas de relance commerciale, pas de transmission à des tiers, désabonnement en un clic.
              Nous publions y compris nos post-mortems d’incident — c’est la partie que nos lecteurs
              nous disent trouver la plus utile.
            </p>
          </Card>
        </Container>
      </SiteSection>

      <Modal
        open={demande !== null}
        onClose={() => setDemande(null)}
        title={demande ? demande.titre : ''}
        description={
          demande?.type === 'Webinaire'
            ? 'Le lien de visionnage vous est envoyé par courriel. Aucune inscription à une liste de diffusion : une seule adresse, un seul envoi.'
            : 'Le document vous est envoyé par courriel, en PDF. Aucune inscription à une liste de diffusion : une seule adresse, un seul envoi.'
        }
        size="sm"
        footer={
          envoye ? (
            <Button onClick={() => setDemande(null)}>Fermer</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setDemande(null)}>
                Annuler
              </Button>
              <Button
                disabled={!/.+@.+\..+/.test(courriel)}
                onClick={() => setEnvoye(true)}
                iconBefore={<Download size={13} />}
              >
                {demande?.type === 'Webinaire' ? 'Recevoir le lien' : 'Recevoir le document'}
              </Button>
            </>
          )
        }
      >
        {demande && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="violet" size="sm">
                {demande.type}
              </Badge>
              <Badge tone="neutral" size="sm">
                {demande.theme}
              </Badge>
              <Badge tone="neutral" size="sm">
                {demande.duree}
              </Badge>
            </div>
            <p className="text-[13px] leading-relaxed text-g-700">{demande.extrait}</p>
            {envoye ? (
              <Callout ton="ok" titre="Demande enregistrée">
                Le {demande.type === 'Webinaire' ? 'lien de visionnage' : 'document'} part vers{' '}
                <span className="font-semibold">{courriel}</span>. Cette maquette n’envoie aucun
                courriel : il n’y a pas de serveur derrière la démonstration, et rien ne quitte votre
                navigateur.
              </Callout>
            ) : (
              <Field
                label="Adresse professionnelle"
                hint="utilisée pour cet envoi seulement, transmise à aucun tiers"
                required
              >
                <Input
                  type="email"
                  placeholder="prenom.nom@organisation.ci"
                  value={courriel}
                  onChange={(e) => setCourriel(e.target.value)}
                />
              </Field>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

function Puce({
  actif,
  onClick,
  children,
}: {
  actif: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors',
        actif
          ? 'border-p-700 bg-p-700 text-white'
          : 'border-g-300 bg-white text-g-700 hover:border-p-400',
      )}
    >
      {children}
    </button>
  )
}
