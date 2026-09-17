import type { Metadata } from 'next'
import { Check, ShieldCheck } from 'lucide-react'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/field'
import { FormulaireContact } from './formulaire-contact'
import { Card } from '@/components/composition/card'
import {
  AppelFinal,
  ChiffreCle,
  Container,
  HeroCourt,
  SectionTitle,
  SiteSection,
} from '@/components/site/blocs'
import {
  BANDEAU_CONFIANCE,
  OFFRES_ENTREPRISE,
  PAYS,
  SECTEURS,
  TAILLES_ORG,
} from '@/lib/mock'

export const metadata: Metadata = {
  title: 'Entreprises et grands comptes',
  description:
    'Datacenter virtuel dédié, plan de reprise exercé, migration et sortie de VMware, infogérance. Atelier de cadrage sans frais, équipe basée à Abidjan.',
}

const ARGUMENTS = [
  {
    titre: 'Une souveraineté attestée, pas revendiquée',
    texte:
      'Nous générons sur demande une attestation de résidence des données, ressource par ressource, avec l’identifiant du site. Nous documentons aussi ce qui n’est pas encore atteint : la capacité VMware et Hyper-V héritée de reprises de parcs clients est marquée « en sortie », avec une date cible de migration. Un évaluateur technique préfère une trajectoire honnête à une affirmation invérifiable.',
  },
  {
    titre: 'Un PRA exercé, pas seulement contractualisé',
    texte:
      'Un RTO annoncé mais jamais mesuré ne vaut rien le jour du sinistre. Nous exerçons votre plan trimestriellement, en réseau isolé et sans impact sur la production, puis nous vous remettons le rapport avec le temps de reprise réellement constaté et les incidents relevés. Cible et constaté sont affichés côte à côte, en permanence, dans votre portail.',
  },
  {
    titre: 'Une réversibilité testée',
    texte:
      'Chaque service publie son format d’export et son délai — cinq jours pour un Drive, sept pour une messagerie, dix pour une GED. Nous vérifions périodiquement que ces exports se réimportent effectivement dans une instance vierge. Partir doit être possible pour que rester soit un choix.',
  },
]

export default function Entreprises() {
  return (
    <>
      <HeroCourt
        surtitre="Entreprises & grands comptes"
        titre={
          <>
            Pour les DSI qui doivent
            <br />
            <span className="text-m-600">prouver, pas promettre.</span>
          </>
        }
        chapeau="Appels d’offres, audits, comités de sécurité : à un moment, il faut produire des preuves. Attestations de résidence, rapports d’exercice PRA avec RTO constaté, matrice de rôles publiée, journal d’audit qui enregistre aussi les refus. C’est ce que nous construisons."
      />

      <SiteSection>
        <Container>
          <SectionTitle
            surtitre="Nos engagements sur mesure"
            titre="Quatre chantiers que nous menons pour les grands comptes"
          />
          {/*
            L'atelier de cadrage est cité partout sur le site sans jamais être
            montré. Une table, des mains, un schéma : c'est littéralement ce qui
            se passe, et cela vaut mieux qu'une photo de poignée de main.
          */}
          <figure className="mt-8 overflow-hidden rounded-[14px] border border-g-300">
            <img
              src="/photos/atelier-cadrage.webp"
              alt="Vue de dessus d’une table d’atelier : plusieurs personnes dessinent un schéma d’architecture réseau sur une grande feuille, entourée de notes autocollantes et d’un ordinateur portable."
              width={1376}
              height={768}
              loading="lazy"
              className="h-52 w-full object-cover sm:h-64"
            />
            <figcaption className="bg-white px-5 py-3 text-[12px] leading-relaxed text-g-500">
              Vue d’illustration d’un atelier de cadrage. Il dure une demi-journée, ne se facture
              pas, et se termine par un dimensionnement chiffré que vous emportez même si vous ne
              signez pas.
            </figcaption>
          </figure>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {OFFRES_ENTREPRISE.map((o) => (
              <Card key={o.titre} className="flex flex-col">
                <h3 className="type-h3">{o.titre}</h3>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-g-700">{o.texte}</p>
                <ul className="mt-4 space-y-1.5 border-t border-g-100 pt-3.5">
                  {o.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[13px] text-g-700">
                      <Check size={13} className="mt-0.5 shrink-0 text-ok" />
                      {p}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </Container>
      </SiteSection>

      <SiteSection fond="clair">
        <Container>
          <SectionTitle
            surtitre="Pourquoi les DSI nous choisissent"
            titre="Trois arguments vérifiables"
            chapeau="Aucun des trois ne repose sur notre parole : chacun se contrôle sur pièces."
          />
          <div className="mt-8 space-y-4">
            {ARGUMENTS.map((a, i) => (
              <div
                key={a.titre}
                className="flex gap-4 rounded-[10px] border border-g-300 bg-white p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-p-100 text-p-700">
                  <ShieldCheck size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-bold [font-family:var(--font-display)] text-ink">
                    <span className="tnum mr-2 text-p-600">0{i + 1}</span>
                    {a.titre}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-g-700">{a.texte}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </SiteSection>

      <section className="bg-p-700">
        <Container className="py-10">
          <dl className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {BANDEAU_CONFIANCE.map((c) => (
              <ChiffreCle key={c.libelle} valeur={c.valeur} libelle={c.libelle} sombre />
            ))}
          </dl>
        </Container>
      </section>

      {/* Formulaire de mise en relation */}
      <SiteSection id="contact">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <MicroLabel className="text-m-600">Mise en relation</MicroLabel>
              <h2 className="mt-3 text-[26px] font-bold leading-tight [font-family:var(--font-display)] text-ink sm:text-[32px]">
                Parlez à un architecte qui connaît votre marché
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-g-700">
                Pas un formulaire qui atterrit dans une file d’attente internationale. Un architecte
                basé à Abidjan vous rappelle sous un jour ouvré, avec vos contraintes en tête :
                bande passante locale, contraintes réglementaires du secteur bancaire ivoirien,
                moyens de paiement, disponibilité des compétences.
              </p>
              <dl className="mt-7 space-y-3.5">
                {[
                  ['Atelier de cadrage', 'Une demi-journée, sans frais et sans engagement'],
                  ['Chiffrage', 'Devis détaillé sous cinq jours ouvrés après l’atelier'],
                  ['Pilote', 'Environnement de démonstration peuplé de vos propres données de test'],
                  ['Contractualisation', 'Contrat cadre, annexe SLA, plan de réversibilité'],
                ].map(([t, d]) => (
                  <div key={t} className="border-l-2 border-p-300 pl-3.5">
                    <dt className="text-[13px] font-bold text-ink">{t}</dt>
                    <dd className="text-[13px] text-g-700">{d}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-7 rounded-[10px] border border-g-300 bg-g-050 p-4">
                <p className="text-[13px] leading-relaxed text-g-700">
                  Vous préparez un appel d’offres ? Demandez notre trame de cahier des charges cloud :
                  elle liste les exigences à formuler pour comparer des offres réellement
                  comparables — y compris celles qui nous désavantagent.
                </p>
              </div>
            </div>

            <Card className="lg:p-6">
              <FormulaireContact
                libelle="Demander un rendez-vous"
                titreSucces="Demande enregistrée"
                phraseSucces="Un architecte basé à Abidjan reprend votre demande. Pas de file d’attente internationale, pas de qualification par un centre d’appels."
                suite={[
                  'Un architecte lit votre besoin et prépare ses questions — pas un script commercial.',
                  'Il vous rappelle sous un jour ouvré, au créneau que vous indiquerez.',
                  'L’atelier de cadrage, sans frais, aboutit à une estimation chiffrée et à une trajectoire datée.',
                ]}
                complement={
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <Badge tone="ok" size="sm">
                      Réponse sous un jour ouvré
                    </Badge>
                    <Badge tone="neutral" size="sm">
                      Équipe basée à Abidjan
                    </Badge>
                    <Badge tone="neutral" size="sm">
                      Sans engagement
                    </Badge>
                  </div>
                }
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Nom et prénom" required>
                    <Input required name="nom" placeholder="Aïcha Koné" autoComplete="name" />
                  </Field>
                  <Field label="Fonction" required>
                    <Input required name="fonction" placeholder="Directrice des systèmes d’information" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="E-mail professionnel" required>
                    <Input
                      required
                      name="email"
                      type="email"
                      placeholder="prenom.nom@organisation.ci"
                      autoComplete="email"
                    />
                  </Field>
                  <Field label="Téléphone" hint="facultatif">
                    <Input name="tel" type="tel" placeholder="+225 27 22 00 00 00" autoComplete="tel" />
                  </Field>
                </div>
                <Field label="Organisation" required>
                  <Input required name="organisation" placeholder="Nom de votre organisation" />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Pays" required>
                    <Select name="pays" defaultValue={PAYS[0]}>
                      {PAYS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Secteur" required>
                    <Select name="secteur" required defaultValue="">
                      <option value="">Sélectionner…</option>
                      {SECTEURS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Taille de l’organisation" required>
                  <Select name="taille" required defaultValue="">
                    <option value="">Sélectionner…</option>
                    {TAILLES_ORG.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Votre besoin"
                  hint="contexte, échéance, volumétrie si vous la connaissez"
                  required
                >
                  <Textarea
                    required
                    name="besoin"
                    rows={5}
                    placeholder="Nous sortons d’un contrat de licences propriétaires arrivant à échéance en mars, pour un parc de 40 machines virtuelles et 240 boîtes de messagerie. Nous cherchons à établir un PRA inter-site avec un RTO inférieur à quatre heures."
                  />
                </Field>
                <Checkbox
                  name="consentement"
                  required
                  label="J’accepte d’être contacté par Synelia au sujet de cette demande"
                  description="Vos coordonnées ne sont utilisées que pour cette prise de contact et ne sont transmises à aucun tiers. Vous pouvez demander leur suppression à tout moment."
                />
              </FormulaireContact>
            </Card>
          </div>
        </Container>
      </SiteSection>

      <AppelFinal
        titre="Ou commencez par explorer le portail"
        chapeau="Créez un compte : l’espace client est peuplé de données de démonstration réalistes — Espaces Cloud, machines, applications, services managés, sauvegardes, PRA, facturation."
        primaire={{ libelle: 'Créer un compte', href: '/signup' }}
        secondaire={{ libelle: 'Voir les datacenters', href: '/datacenters' }}
      />
    </>
  )
}
