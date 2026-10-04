/** Texte et actions communs aux listes filtrées par Espace Cloud (Infrastructure). */

export function phraseVideEspace(code: string, suite: string) {
  return `${suite} Ici, la liste ne montre que l’Espace « ${code} » — celui du panneau de gauche.`
}

export const actionChangerEspace = {
  libelle: 'Choisir un autre Espace',
  href: '/app/infrastructure',
} as const
