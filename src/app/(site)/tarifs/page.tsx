'use client'

import { useMemo, useState } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { money, TVA_PCT } from '@/lib/format'
import { FAMILLES_TARIFS } from '@/lib/mock'
import { usePublic } from '@/lib/api/public'
import { famillesDepuisTarifs, type TarifsPublics } from '@/lib/api/vitrine'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/field'
import { Tabs } from '@/components/ui/display'
import {
  Accordeon,
  AppelFinal,
  Container,
  HeroCourt,
  LienFleche,
  SiteSection,
} from '@/components/site/blocs'

const FAQ_TARIFS = [
  {
    question: 'Comment fonctionne le prorata en cours de mois ?',
    reponse:
      'Toute ressource créée ou supprimée en cours de mois est facturée au prorata journalier, à la journée entamée. Créer un Espace Cloud Pro le 19 d’un mois de 31 jours vous facture 13 jours sur 31, soit environ 35 650 FCFA au lieu de 85 000. La facturation pleine démarre au 1er du mois suivant.',
  },
  {
    question: 'Puis-je changer d’offre en cours de mois ?',
    reponse:
      'Oui, et sans interruption de service. Le changement s’applique immédiatement, l’ancienne offre est facturée au prorata jusqu’à la date de bascule, la nouvelle à partir de cette date. Une réduction de palier peut nécessiter une fenêtre de maintenance si votre consommation dépasse la capacité du palier cible — nous vous le signalons avant validation.',
  },
  {
    question: 'Le trafic sortant est-il facturé ?',
    reponse:
      'Un quota est inclus : 1 To par To stocké en classe chaude sur le stockage objet, 200 Go en classe froide. Au-delà, le trafic sortant est facturé à 850 FCFA par Go. Le trafic entrant est gratuit, ainsi que le trafic entre vos ressources d’un même Espace Cloud et le trafic entre nos deux sites pour la réplication de sauvegarde.',
  },
  {
    question: 'Existe-t-il des remises de volume ?',
    reponse:
      'Oui, à partir de dix souscriptions d’une même offre, ou d’un engagement annuel. La remise annuelle est de 15 % et s’applique en libre-service ; les remises de volume sont négociées et matérialisées dans un devis.',
  },
  {
    question: 'Le mobile money est-il vraiment accepté ?',
    reponse:
      'Oui, au même niveau que la carte bancaire et le virement : Orange Money, MTN MoMo et Wave. Le règlement est rapproché automatiquement de la facture concernée, et un porte-monnaie prépayé est disponible pour les organisations qui préfèrent provisionner à l’avance. Ce n’est pas une option reléguée en bas de liste — c’est le moyen de paiement le plus utilisé par nos clients.',
  },
]

export default function Tarifs() {
  const [periode, setPeriode] = useState<'mensuel' | 'annuel'>('mensuel')
  // En mode API, la grille vient de `GET /public/tarifs` (une colonne par
  // offre publiée) ; sans API ou en cas d’échec, la grille locale reste.
  const distant = usePublic<TarifsPublics>('/public/tarifs')
  const familles = useMemo(
    () => famillesDepuisTarifs(distant.donnees) ?? FAMILLES_TARIFS,
    [distant.donnees],
  )
  const [famille, setFamille] = useState(FAMILLES_TARIFS[0].id)
  // La famille choisie peut ne pas exister dans la grille distante : on
  // retombe sur la première plutôt que d’afficher un tableau vide.
  const active = familles.find((f) => f.id === famille) ?? familles[0]
  const remise = periode === 'annuel' ? 0.85 : 1

  return (
    <>
      <HeroCourt
        surtitre="Tarifs"
        titre={
          <>
            Des prix publics, en FCFA,
            <br />
            avec les hypothèses affichées.
          </>
        }
        chapeau="Tous les montants sont hors taxes. La TVA au taux en vigueur de 18 % s’ajoute à la facturation. La facturation est mensuelle, à terme échu, avec prorata journalier sur toute création ou suppression en cours de mois."
        actions={
          <>
            <ButtonLink href="/simulateur" size="lg" variant="primary">
              Estimer mon budget
            </ButtonLink>
            <ButtonLink
              href="/entreprises#contact"
              size="lg"
              variant="secondary"
            >
              Demander un devis
            </ButtonLink>
          </>
        }
      />

      <SiteSection>
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <SegmentedControl
                value={periode}
                onChange={setPeriode}
                options={[
                  { value: 'mensuel', label: 'Mensuel' },
                  { value: 'annuel', label: 'Annuel (−15 %)' },
                ]}
              />
              {periode === 'annuel' && (
                <Badge tone="ok">15 % d’économie · engagement de douze mois</Badge>
              )}
            </div>
            <p className="text-[13px] text-g-500">
              Prix hors taxes · TVA {TVA_PCT} % · facturation au prorata journalier
            </p>
          </div>

          <Tabs
            className="mt-6"
            tabs={familles.map((f) => ({ id: f.id, label: f.nom }))}
            active={active.id}
            onChange={setFamille}
          />

          {active.note && (
            <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-g-700">{active.note}</p>
          )}

          <div className="mt-5 overflow-x-auto rounded-[10px] border border-g-300 bg-white shadow-[0_1px_2px_rgba(43,27,77,.06)]">
            <table className="w-full min-w-max border-collapse">
              <thead>
                <tr className="border-b border-g-300 bg-g-050">
                  <th className="type-micro sticky left-0 z-10 min-w-52 bg-g-050 px-4 py-3 text-left text-g-500">
                    Caractéristique
                  </th>
                  {active.colonnes.map((c) => (
                    <th
                      key={c.nom}
                      className={cn(
                        'min-w-40 px-4 py-3 text-center align-bottom',
                        c.recommande && 'border-x-2 border-t-2 border-p-700 bg-p-050',
                      )}
                    >
                      {c.recommande && (
                        <Badge tone="violet" size="sm" className="mb-1.5">
                          Recommandé
                        </Badge>
                      )}
                      <span className="block text-[14px] font-bold [font-family:var(--font-display)] text-ink">
                        {c.nom}
                      </span>
                      <span className="tnum mt-1.5 block text-[17px] font-bold [font-family:var(--font-display)] text-p-700">
                        {c.surDevis ? (
                          <span className="text-[14px]">Sur devis</span>
                        ) : (
                          <>
                            {money(Math.round((c.prix ?? 0) * remise))}
                            <span className="block text-[11px] font-semibold text-g-500">
                              {c.unite}
                            </span>
                          </>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.lignes.map((l, li) => (
                  <tr
                    key={l.caracteristique}
                    className={cn('border-b border-g-100 last:border-0', li % 2 === 1 && 'bg-g-050/60')}
                  >
                    <th
                      className={cn(
                        'sticky left-0 z-10 px-4 py-2.5 text-left text-[13px] font-medium text-g-700',
                        li % 2 === 1 ? 'bg-[#FBFBFD]' : 'bg-white',
                      )}
                    >
                      {l.caracteristique}
                    </th>
                    {l.valeurs.map((v, i) => (
                      <td
                        key={i}
                        className={cn(
                          'px-4 py-2.5 text-center text-[13px]',
                          active.colonnes[i]?.recommande && 'border-x-2 border-p-700 bg-p-050',
                        )}
                      >
                        {typeof v === 'boolean' ? (
                          v ? (
                            <Check size={15} className="mx-auto text-ok" />
                          ) : (
                            <Minus size={15} className="mx-auto text-g-300" />
                          )
                        ) : (
                          <span className="tnum text-ink">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-g-300 bg-g-050">
                  <th className="sticky left-0 z-10 bg-g-050 px-4 py-3" />
                  {active.colonnes.map((c) => (
                    <td
                      key={c.nom}
                      className={cn(
                        'px-4 py-3 text-center',
                        c.recommande && 'border-x-2 border-b-2 border-p-700 bg-p-050',
                      )}
                    >
                      <ButtonLink
                        href={c.surDevis ? '/entreprises#contact' : '/signup'}
                        size="sm"
                        variant={c.recommande ? 'primary' : 'secondary'}
                      >
                        {c.surDevis ? 'Demander un devis' : 'Souscrire'}
                      </ButtonLink>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-g-300 bg-g-050 px-4 py-3.5">
            <div>
              <MicroLabel>À retenir</MicroLabel>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-g-700">
                Les colonnes « Sur devis » correspondent aux configurations dimensionnées sur mesure,
                avec hôtes dédiés possibles et SLA renforcé. Le devis est établi après un atelier de
                cadrage d’une demi-journée, sans frais.
              </p>
            </div>
            <LienFleche href="/simulateur">Ouvrir le simulateur</LienFleche>
          </div>
        </Container>
      </SiteSection>

      <SiteSection fond="clair">
        <Container taille="md">
          <h2 className="type-h2 text-center">Questions tarifaires</h2>
          <Accordeon items={FAQ_TARIFS} className="mt-6" />
        </Container>
      </SiteSection>

      <AppelFinal
        titre="Un doute sur le dimensionnement ?"
        chapeau="Le simulateur vous donne un ordre de grandeur en trois minutes. Pour une configuration réelle, un architecte reprend vos charges existantes et vous propose un dimensionnement chiffré."
        primaire={{ libelle: 'Ouvrir le simulateur', href: '/simulateur' }}
        secondaire={{ libelle: 'Parler à un architecte', href: '/entreprises#contact' }}
      />
    </>
  )
}
