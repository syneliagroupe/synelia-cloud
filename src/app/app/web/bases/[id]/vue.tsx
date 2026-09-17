'use client'

import { useState } from 'react'
import { Download, ExternalLink, Plus, RotateCcw, Trash2, Upload } from 'lucide-react'
import { cn, surfaceMarque } from '@/lib/utils'
import { dateHeure, num, relatif } from '@/lib/format'
import {
  MOTEUR_WEB_LABEL,
  MOTEUR_WEB_TEINTE,
  SERVEURS_BASES,
  hebergementById,
  nomServi,
  type ServeurBases,
} from '@/lib/mock'
import { Badge, MicroLabel } from '@/components/ui/badge'
import { Button, ButtonLink, IconButton } from '@/components/ui/button'
import { CopyField, GatedAction, Tabs } from '@/components/ui/display'
import { Field, Input, Select } from '@/components/ui/field'
import { Drawer } from '@/components/ui/overlay'
import { PageHeader, Card, CardHeader, Callout, KeyValueList } from '@/components/composition/card'
import { StatTile, QuotaBar } from '@/components/composition/metrics'
import { EmptyState } from '@/components/composition/states'
import { useApp, useMaintenant } from '@/components/app/contexte'
import { useCollection } from '@/components/app/atelier'
import { BoutonAction, BoutonFormulaire, useOperation } from '@/components/app/actions'
import { creerRessource, estActif, modifierRessource, requete } from '@/lib/api/client'

/** Mot de passe fort généré côté client — affiché une seule fois, jamais stocké ici. */
function genererMotDePasse(longueur = 20): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#%+-_'
  const octets = new Uint8Array(longueur)
  crypto.getRandomValues(octets)
  return Array.from(octets, (o) => alphabet[o % alphabet.length]).join('')
}

export function VueServeurBases({ id }: { id: string }) {
  const maintenant = useMaintenant()
  const { autorise, refus } = useApp()
  const executer = useOperation()
  const serveurs = useCollection<ServeurBases>('serveurs-bases', SERVEURS_BASES)
  const [onglet, setOnglet] = useState('bases')
  const [creation, setCreation] = useState(false)
  const [nomBase, setNomBase] = useState('')
  const [collation, setCollation] = useState('utf8mb4_unicode_ci')
  const [compteDedie, setCompteDedie] = useState('')
  const [baseRestauree, setBaseRestauree] = useState<string | null>(null)
  const [pointRestauration, setPointRestauration] = useState('hier')
  const [nomCopie, setNomCopie] = useState<string | null>(null)
  /** Mot de passe réinitialisé d’un utilisateur — montré une fois. */
  const [secretUtilisateur, setSecretUtilisateur] = useState<{ nom: string; motDePasse: string } | null>(null)

  const s = serveurs.items.find((x) => x.id === id)
  if (!s) return null
  const h = hebergementById(s.hebergementId)
  const surface = surfaceMarque(MOTEUR_WEB_TEINTE[s.moteur])
  const cle = s.moteur === 'redis' ? 'index' : 'base'

  const onglets = [
    { id: 'bases', label: s.moteur === 'redis' ? 'Index' : 'Bases' },
    ...(s.moteur === 'redis' ? [] : [{ id: 'utilisateurs', label: 'Utilisateurs' }]),
    { id: 'connexion', label: 'Connexion' },
    { id: 'sauvegarde', label: 'Sauvegarde' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        fil={[
          { label: 'Espace client', href: '/app' },
          { label: 'Bases de données', href: '/app/web/bases' },
          { label: MOTEUR_WEB_LABEL[s.moteur] },
        ]}
        titre={
          <span className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] text-[12px] font-bold"
              style={{ background: surface.fond, color: surface.texte }}
            >
              {MOTEUR_WEB_LABEL[s.moteur].slice(0, 2).toUpperCase()}
            </span>
            <span>
              {MOTEUR_WEB_LABEL[s.moteur]} {s.version}
            </span>
          </span>
        }
        sousTitre={`Installé sur ${s.serveur}${h ? `, le serveur de ${nomServi(h)}` : ''}. Accessible seulement depuis cette machine.`}
        meta={
          <>
            <Badge tone={s.actif ? 'ok' : 'neutral'} dot={s.actif}>
              {s.actif ? 'Actif' : 'À activer'}
            </Badge>
            <Badge tone="neutral">Port local {s.port}</Badge>
            {h && <Badge tone="violet">{h.palier}</Badge>}
            <Badge tone="neutral">Aucun accès distant</Badge>
          </>
        }
        actions={
          s.actif ? (
            <GatedAction autorise={autorise('service.admin')} message={refus('service.admin')}>
              <Button iconBefore={<Plus size={14} />} onClick={() => setCreation(true)}>
                Créer une {cle}
              </Button>
            </GatedAction>
          ) : (
            <BoutonAction
              libelle={`Activer ${MOTEUR_WEB_LABEL[s.moteur]}`}
              variant="primary"
              size="md"
              icone={<Plus size={14} />}
              operation={{
                action: 'service.admin',
                titre: 'Activation demandée',
                detail: `${MOTEUR_WEB_LABEL[s.moteur]} sera installé sur ${s.serveur} dans quelques minutes.`,
                appel: () => modifierRessource('/web/bases', s.id, { actif: true }),
                job: { workflow: 'web.db.enable', cible: `${MOTEUR_WEB_LABEL[s.moteur]} · ${s.serveur}` },
                effetFinal: () => {
                  if (estActif()) {
                    serveurs.recharger()
                    return
                  }
                  serveurs.modifier(s.id, { actif: true })
                },
              }}
            />
          )
        }
      />

      {!s.actif ? (
        <Card>
          <EmptyState
            titre={`${MOTEUR_WEB_LABEL[s.moteur]} n’est pas encore installé`}
            phrase={`Le moteur est disponible sur ${s.serveur}. L’activer crée le service, ouvre son port sur la boucle locale et l’ajoute au plan de sauvegarde de l’hébergement. Aucun redémarrage d’Apache n’est nécessaire.`}
            action={{ libelle: 'Retour aux moteurs', href: '/app/web/bases' }}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              libelle={s.moteur === 'redis' ? 'Index' : 'Bases'}
              valeur={s.bases.length}
            />
            <StatTile
              libelle={s.moteur === 'redis' ? 'Mémoire' : 'Espace'}
              valeur={`${(s.utiliseMo / 1024).toFixed(2)} Go`}
              detail={`sur ${(s.quotaMo / 1024).toFixed(0)} Go`}
              ton={s.utiliseMo / s.quotaMo > 0.85 ? 'warn' : 'neutral'}
            />
            <StatTile
              libelle="Connexions"
              valeur={`${s.connexions?.actives ?? 0} / ${s.connexions?.max ?? 0}`}
              detail="actives sur maximum"
            />
            <StatTile
              libelle="Dernière sauvegarde"
              valeur={s.sauvegarde.derniere === '—' ? '—' : relatif(s.sauvegarde.derniere, maintenant)}
              detail={s.sauvegarde.frequence}
              ton={s.sauvegarde.derniere === '—' ? 'neutral' : 'ok'}
            />
          </div>

          <Tabs tabs={onglets} active={onglet} onChange={setOnglet} />

          {onglet === 'bases' && (
            <Card padding={false}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-g-100 px-4 py-3">
                <p className="text-[13px] font-bold text-ink">
                  {s.bases.length} {cle}
                  {s.bases.length > 1 ? 's' : ''} · {(s.utiliseMo / 1024).toFixed(2)} Go
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <BoutonAction
                    libelle="Exporter"
                    variant="ghost"
                    icone={<Download size={12} />}
                    operation={{
                      action: 'service.admin',
                      titre: `Export de ${s.bases.length} ${cle}(s) préparé`,
                      detail: `${(s.utiliseMo / 1024).toFixed(2)} Go · lien signé valable une heure`,
                      // Un export par base (`POST …/bases/{nom}/export`, `202` chacun).
                      appel:
                        s.bases.length > 0
                          ? () =>
                              Promise.all(
                                s.bases.map((b) =>
                                  requete(
                                    `/web/bases/${encodeURIComponent(s.id)}/bases/${encodeURIComponent(b.nom)}/export`,
                                    { methode: 'POST', corps: { format: 'sql_gz' } },
                                  ),
                                ),
                              )
                          : undefined,
                      job: {
                        type: 'base.dump',
                        label: `Export ${MOTEUR_WEB_LABEL[s.moteur]} · ${s.serveur}`,
                        etapes: ['Verrouiller en lecture', 'Écrire le dump', 'Compresser'],
                        dureeEtapeMs: 900,
                      },
                    }}
                  />
                  <BoutonFormulaire
                    libelle="Importer"
                    variant="ghost"
                    icone={<Upload size={12} />}
                    action="service.admin"
                    titre={`Importer dans ${MOTEUR_WEB_LABEL[s.moteur]}`}
                    description="L’import écrase les tables de même nom. Sur une base servant un site en ligne, faites-le d’abord sur une copie."
                    champs={[
                      {
                        id: 'base',
                        label: 'Base de destination',
                        type: 'select',
                        options: s.bases.map((b) => ({ value: b.nom, label: b.nom })),
                      },
                      { id: 'fichier', label: 'Nom du fichier', placeholder: 'dump-2026-08-19.sql', obligatoire: true },
                    ]}
                    libelleValider="Importer"
                    operation={(v) => ({
                      ton: 'warn',
                      titre: `Import dans ${v.base} lancé`,
                      detail: 'Les tables de même nom sont écrasées.',
                      job: {
                        type: 'base.import',
                        label: `Import SQL · ${v.base}`,
                        etapes: ['Vérifier le fichier', 'Charger les données', 'Reconstruire les index'],
                        dureeEtapeMs: 1100,
                      },
                    })}
                  />
                  {s.moteur !== 'redis' && (
                    <ButtonLink
                      href={`https://adminer.${h ? nomServi(h) : 'synelia.cloud'}`}
                      variant="ghost"
                      size="sm"
                      iconAfter={<ExternalLink size={12} />}
                    >
                      Ouvrir Adminer
                    </ButtonLink>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead>
                    <tr className="border-b border-g-300 bg-g-050">
                      {[
                        cle === 'base' ? 'Base' : 'Index',
                        'Taille',
                        s.moteur === 'redis' ? 'Clés' : 'Tables',
                        ...(s.moteur === 'redis' ? [] : ['Jeu de caractères']),
                        'Utilisé par',
                        '',
                      ].map((c) => (
                        <th
                          key={c}
                          className="type-micro px-3 py-2 text-left font-semibold text-g-500"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.bases.map((b) => (
                      <tr key={b.nom} className="border-b border-g-100 last:border-0">
                        <td className="px-3 py-2.5 font-mono text-[13px] font-semibold text-ink">
                          {b.nom}
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                          {b.tailleMo >= 1024
                            ? `${(b.tailleMo / 1024).toFixed(2)} Go`
                            : `${b.tailleMo} Mo`}
                        </td>
                        <td className="tnum px-3 py-2.5 text-[12px] text-g-700">
                          {num(b.tables ?? b.cles ?? 0)}
                        </td>
                        {s.moteur !== 'redis' && (
                          <td className="px-3 py-2.5 font-mono text-[12px] text-g-500">
                            {b.collation}
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-[12px] text-g-700">{b.utilise}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="flex items-center justify-end gap-1">
                            <IconButton
                              label={`Restaurer ${b.nom}`}
                              size="sm"
                              onClick={() => {
                                setBaseRestauree(b.nom)
                                setNomCopie(`${b.nom}_restauree`)
                                setOnglet('sauvegarde')
                              }}
                            >
                              <RotateCcw size={13} />
                            </IconButton>
                            <IconButton
                              label={`Supprimer ${b.nom}`}
                              size="sm"
                              onClick={() =>
                                executer({
                                  action: 'service.admin',
                                  ton: 'warn',
                                  titre: `${b.nom} supprimée`,
                                  detail: `Les sauvegardes restent disponibles ${s.sauvegarde.retentionJours} jours.`,
                                  appel: () =>
                                    requete(
                                      `/web/bases/${encodeURIComponent(s.id)}/bases/${encodeURIComponent(b.nom)}`,
                                      { methode: 'DELETE', query: { confirmation: b.nom } },
                                    ),
                                  effet: () =>
                                    serveurs.modifier(s.id, (x) => ({
                                      bases: x.bases.filter((y) => y.nom !== b.nom),
                                      utiliseMo: Math.max(0, x.utiliseMo - b.tailleMo),
                                    })),
                                  effetFinal: () => serveurs.recharger(),
                                })
                              }
                            >
                              <Trash2 size={13} className="text-err" />
                            </IconButton>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {onglet === 'utilisateurs' && (
            <Card>
              <CardHeader
                titre="Comptes d’accès"
                sousTitre="Un compte par application, avec les droits les plus étroits possible. Le mot de passe n’est affiché qu’à la création."
                actions={
                  <BoutonFormulaire
                    libelle="Créer un compte"
                    icone={<Plus size={13} />}
                    action="service.admin"
                    titre="Créer un compte d’accès"
                    description="Un compte par application, avec les droits les plus étroits possible. Le mot de passe n’est affiché qu’à la création."
                    champs={[
                      { id: 'nom', label: 'Identifiant', placeholder: 'monsite_rw', obligatoire: true },
                      {
                        id: 'base',
                        label: 'Base',
                        type: 'select',
                        demi: true,
                        options: s.bases.map((b) => ({ value: b.nom, label: b.nom })),
                      },
                      {
                        id: 'droits',
                        label: 'Droits',
                        type: 'select',
                        demi: true,
                        options: [
                          { value: 'lecture', label: 'Lecture seule' },
                          { value: 'ecriture', label: 'Écriture' },
                          { value: 'complet', label: 'Tous droits' },
                        ],
                      },
                    ]}
                    valeursDepart={{ droits: 'ecriture' }}
                    libelleValider="Créer le compte"
                    operation={(v) => ({
                      titre: `Compte ${v.nom} créé`,
                      detail: 'Notez le mot de passe maintenant : il ne sera plus affiché.',
                      effet: () =>
                        serveurs.modifier(s.id, (x) => ({
                          utilisateurs: [
                            ...x.utilisateurs,
                            {
                              nom: String(v.nom),
                              droits: v.droits as ServeurBases['utilisateurs'][number]['droits'],
                              base: String(v.base),
                            },
                          ],
                        })),
                    })}
                  />
                }
              />
              <ul className="divide-y divide-g-100">
                {s.utilisateurs.map((u) => (
                  <li
                    key={u.nom}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[13px] font-semibold text-ink">
                        {u.nom}
                      </span>
                      <span className="block text-[11px] text-g-500">sur {u.base}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge
                        tone={
                          u.droits === 'complet' ? 'violet' : u.droits === 'lecture' ? 'ok' : 'info'
                        }
                        size="sm"
                      >
                        {u.droits === 'complet'
                          ? 'Tous droits'
                          : u.droits === 'lecture'
                            ? 'Lecture seule'
                            : 'Écriture'}
                      </Badge>
                      <IconButton
                        label={`Réinitialiser le mot de passe de ${u.nom}`}
                        size="sm"
                        onClick={() => {
                          const motDePasse = genererMotDePasse()
                          executer({
                            action: 'service.admin',
                            titre: `Mot de passe de ${u.nom} réinitialisé`,
                            detail:
                              'Affiché une seule fois ci-dessous. Mettez à jour la configuration du site avant de quitter cette page.',
                            // `PATCH /web/bases/{id}/utilisateurs/{nom} { motDePasse }`.
                            appel: () =>
                              requete(
                                `/web/bases/${encodeURIComponent(s.id)}/utilisateurs/${encodeURIComponent(u.nom)}`,
                                { methode: 'PATCH', corps: { motDePasse } },
                              ),
                            effetFinal: () => setSecretUtilisateur({ nom: u.nom, motDePasse }),
                          })
                        }}
                      >
                        <RotateCcw size={13} />
                      </IconButton>
                    </span>
                  </li>
                ))}
              </ul>
              {secretUtilisateur && (
                <Callout
                  ton="warn"
                  className="mt-4"
                  titre={`Nouveau mot de passe de ${secretUtilisateur.nom} — affiché une seule fois`}
                >
                  <CopyField className="mt-2" value={secretUtilisateur.motDePasse} masque mono />
                </Callout>
              )}
            </Card>
          )}

          {onglet === 'connexion' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  titre="Depuis vos sites, sur cette machine"
                  sousTitre="Ce sont les seules valeurs qui fonctionnent : le moteur n’écoute pas ailleurs."
                />
                <div className="space-y-3">
                  <div>
                    <MicroLabel>Hôte</MicroLabel>
                    <CopyField value={s.hoteInterne} mono className="mt-1" />
                  </div>
                  <div>
                    <MicroLabel>Port</MicroLabel>
                    <CopyField value={String(s.port)} mono className="mt-1" />
                  </div>
                  {s.bases[0] && (
                    <div>
                      <MicroLabel>Chaîne de connexion — {s.bases[0].nom}</MicroLabel>
                      <CopyField
                        value={
                          s.moteur === 'postgresql'
                            ? `postgresql://${s.utilisateurs[0]?.nom ?? 'utilisateur'}:MOT_DE_PASSE@${s.hoteInterne}:${s.port}/${s.bases[0].nom}`
                            : s.moteur === 'redis'
                              ? `redis://${s.hoteInterne}:${s.port}/0`
                              : `mysql://${s.utilisateurs[0]?.nom ?? 'utilisateur'}:MOT_DE_PASSE@${s.hoteInterne}:${s.port}/${s.bases[0].nom}`
                        }
                        mono
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader titre="Depuis l’extérieur" />
                <Callout ton="warn" titre="Aucun accès distant sur une base mutualisée">
                  Le moteur est lié à la boucle locale du serveur ; aucune règle de pare-feu ne
                  l’ouvrira, c’est une propriété de l’offre et non un réglage. Pour administrer vos
                  tables, passez par Adminer, servi sur votre domaine et derrière votre
                  authentification.
                </Callout>
                <KeyValueList
                  className="mt-3"
                  items={[
                    { cle: 'Écoute', valeur: `${s.hoteInterne}:${s.port}` },
                    { cle: 'Exposition publique', valeur: 'Aucune' },
                    { cle: 'Tunnel SSH', valeur: h?.acces.ssh ? 'Possible si SSH est activé' : 'SSH désactivé' },
                    { cle: 'Alternative', valeur: 'Base managée, avec liste d’adresses autorisées' },
                  ]}
                />
              </Card>
            </div>
          )}

          {onglet === 'sauvegarde' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  titre="Ce moteur dans le plan de l’hébergement"
                  sousTitre="Les bases sont sauvegardées avec les fichiers du serveur, dans la même exécution."
                />
                <KeyValueList
                  items={[
                    { cle: 'Fréquence', valeur: s.sauvegarde.frequence },
                    {
                      cle: 'Dernière',
                      valeur:
                        s.sauvegarde.derniere === '—'
                          ? '—'
                          : dateHeure(s.sauvegarde.derniere),
                    },
                    { cle: 'Rétention', valeur: `${s.sauvegarde.retentionJours} jours` },
                  ]}
                />
                <ButtonLink
                  href={`/app/web/backup`}
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                >
                  Voir le plan complet
                </ButtonLink>
              </Card>

              <Card>
                <CardHeader
                  titre="Restaurer"
                  sousTitre="Une base restaurée est écrite à côté de l’originale, jamais par-dessus."
                />
                <div className="space-y-3">
                  <Field label={`${cle === 'base' ? 'Base' : 'Index'} à restaurer`}>
                    <Select defaultValue={s.bases[0]?.nom}>
                      {s.bases.map((b) => (
                        <option key={b.nom} value={b.nom}>
                          {b.nom}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Point de restauration">
                    <Select
                      value={pointRestauration}
                      onChange={(e) => setPointRestauration(e.target.value)}
                    >
                      <option value="hier">19 août 2026 · 03:04</option>
                      <option value="avant">18 août 2026 · 03:03</option>
                      <option value="semaine">12 août 2026 · 03:02</option>
                    </Select>
                  </Field>
                  <Field label="Nom de la copie" hint="l’originale reste intacte">
                    <Input
                      value={nomCopie ?? `${baseRestauree ?? s.bases[0]?.nom ?? 'base'}_restauree`}
                      onChange={(e) => setNomCopie(e.target.value)}
                    />
                  </Field>
                  <BoutonAction
                    libelle="Lancer la restauration"
                    fullWidth
                    size="md"
                    operation={{
                      action: 'backup.restore',
                      ton: 'info',
                      titre: 'Restauration lancée',
                      detail: `La copie est créée à côté de l’originale, qui reste intacte.`,
                      job: { workflow: 'web.db.restore', cible: `${nomCopie ?? baseRestauree ?? s.bases[0]?.nom ?? 'base'}` },
                      effetFinal: () => {
                        const nomFinal =
                          nomCopie ?? `${baseRestauree ?? s.bases[0]?.nom ?? 'base'}_restauree`
                        serveurs.modifier(s.id, (x) => ({
                          bases: [
                            ...x.bases,
                            {
                              nom: nomFinal,
                              tailleMo: x.bases[0]?.tailleMo ?? 0,
                              tables: x.bases[0]?.tables,
                              cles: x.bases[0]?.cles,
                              collation: x.bases[0]?.collation,
                              utilise: 'copie de restauration',
                            },
                          ],
                        }))
                      },
                    }}
                  />
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      <Drawer
        open={creation}
        onClose={() => setCreation(false)}
        title={`Créer une ${cle}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreation(false)}>
              Annuler
            </Button>
            <Button
              disabled={!nomBase.trim()}
              onClick={() => {
                // Le contrat exige un mot de passe pour créer le compte dédié en même temps
                // que la base (`POST …/bases { utilisateur: { motDePasse } }`) : ce tiroir ne
                // le demande pas à l’opérateur, donc on le génère côté client — même motif que
                // la réinitialisation de mot de passe de l’onglet Utilisateurs, affiché une
                // seule fois juste après.
                const motDePasseCompte = compteDedie ? genererMotDePasse() : null
                executer({
                  action: 'service.admin',
                  titre: `${cle === 'base' ? 'Base' : 'Index'} ${nomBase} créé`,
                  detail: `Disponible immédiatement sur ${s.hoteInterne}:${s.port}.`,
                  appel: () =>
                    creerRessource(`/web/bases/${encodeURIComponent(s.id)}/bases`, {
                      nom: nomBase,
                      ...(s.moteur === 'redis' ? {} : { jeuCaracteres: collation }),
                      ...(compteDedie
                        ? { utilisateur: { nom: compteDedie, motDePasse: motDePasseCompte, droits: 'tous' } }
                        : {}),
                    }),
                  effet: () =>
                    serveurs.modifier(s.id, (x) => ({
                      bases: [
                        ...x.bases,
                        {
                          nom: nomBase,
                          tailleMo: 0,
                          tables: s.moteur === 'redis' ? undefined : 0,
                          cles: s.moteur === 'redis' ? 0 : undefined,
                          collation: s.moteur === 'redis' ? undefined : collation,
                          utilise: compteDedie ? `compte ${compteDedie}` : 'aucun site',
                        },
                      ],
                      utilisateurs: compteDedie
                        ? [
                            ...x.utilisateurs,
                            { nom: compteDedie, droits: 'complet' as const, base: nomBase },
                          ]
                        : x.utilisateurs,
                    })),
                  effetFinal: () => {
                    if (compteDedie && motDePasseCompte) {
                      setSecretUtilisateur({ nom: compteDedie, motDePasse: motDePasseCompte })
                      setOnglet('utilisateurs')
                    }
                    serveurs.recharger()
                  },
                })
                setNomBase('')
                setCompteDedie('')
                setCreation(false)
              }}
            >
              Créer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Nom" hint="lettres, chiffres et tirets bas">
            <Input
              value={nomBase}
              onChange={(e) => setNomBase(e.target.value)}
              placeholder={`${s.moteur === 'postgresql' ? 'app_prod' : 'monsite_wp'}`}
            />
          </Field>
          {s.moteur !== 'redis' && (
            <Field label="Jeu de caractères">
              <Select value={collation} onChange={(e) => setCollation(e.target.value)}>
                <option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</option>
                <option value="utf8mb4_general_ci">utf8mb4_general_ci</option>
                <option value="fr_FR.UTF-8">fr_FR.UTF-8</option>
              </Select>
            </Field>
          )}
          <Field label="Créer un compte dédié" hint="recommandé : un compte par application">
            <Input
              value={compteDedie}
              onChange={(e) => setCompteDedie(e.target.value)}
              placeholder="monsite_rw"
            />
          </Field>
          <Callout ton="info" titre="Le mot de passe n’est affiché qu’une fois">
            Notez-le à la création. Nous ne le stockons pas en clair et ne pourrons pas vous le
            rappeler — seulement le réinitialiser.
          </Callout>
        </div>
      </Drawer>
    </div>
  )
}
