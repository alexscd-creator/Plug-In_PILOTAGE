// Les 43 icônes de la maquette (page Figma « Icônes », composants `Icône/*`) : tracé type Lucide, trait de 2 px,
// grille de 24. Aucun texte dans les SVG. Le terminal ne dessine pas de SVG : chaque icône a un glyphe de repli.
// Logique pure.

const T = {
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  attente: '<path d="M21 12a8 7 0 0 1-8 7H8l-5 3v-5a8 7 0 0 1 0-10 8 7 0 0 1 18 5z"/><path d="M10 9.5a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.5"/><path d="M12 16v.01"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  reprendre: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  bloque: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  termine: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  'a-faire': '<circle cx="12" cy="12" r="9"/>',
  'en-cours': '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z"/>',
  reporte: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  abandonne: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6"/><path d="M15 9l-6 6"/>',
  copier: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  fichier: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  fleche: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  reglages: '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/>',
  rafraichir: '<path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 20v-5h-5"/>',
  plan: '<path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><path d="M8 6H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2"/><path d="M8 12l2 2 4-4"/><path d="M8 17h6"/>',
  equipe: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14a5 5 0 0 1 4 6"/>',
  alerte: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17.5v.01"/>',
  verrou: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  dossier: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  agent: '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4"/><path d="M9 13v.01"/><path d="M15 13v.01"/><path d="M9.5 16.5h5"/>',
  coche: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  crayon: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  corbeille: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  passer: '<path d="M5 5l7 7-7 7"/><path d="M13 5l7 7-7 7"/>',
  oeil: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  fermer: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  branche: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10"/><path d="M18 11a6 6 0 0 1-6 6H8"/>',
  outil: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  chantier: '<path d="M14.5 6.5l3 3"/><path d="M4 20l9-9"/><path d="M13 5l2-2 6 6-2 2-6-6z"/><path d="M3 21l1-4 3 3-4 1z"/>',
  phase: '<path d="M5 4v17"/><path d="M5 5h12l-2.5 4 2.5 4H5"/>',
  apercu: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  idee: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  cible: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  code: '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M13.5 6l-3 12"/>',
  pinceau: '<path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-5 2-5 5 0 2-1 3-1 3s5 1 7-1c2-1.5 1.5-4 0-5"/>',
  bouclier: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  calendrier: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
  manette: '<path d="M7 7h10a4 4 0 0 1 4 4l-1 6a2.5 2.5 0 0 1-4.3 1.3L14 16h-4l-1.7 2.3A2.5 2.5 0 0 1 4 17l-1-6a4 4 0 0 1 4-4z"/><path d="M8 10v3"/><path d="M6.5 11.5h3"/><path d="M16 11v.01"/><path d="M18 13v.01"/>',
} as const

export type NomIcone = keyof typeof T
export const NOMS_ICONES = Object.keys(T) as NomIcone[]

/** Repli texte pour le terminal. */
export const GLYPHES: Record<NomIcone, string> = {
  play: '▶', attente: '?', stop: '■', reprendre: '↻', bloque: '⊘', termine: '✓',
  'a-faire': '○', 'en-cours': '◐', reporte: '◷', abandonne: '⊗', copier: '⧉', fichier: '▤',
  fleche: '→', reglages: '⚙', rafraichir: '↻', plan: '☰', equipe: '☻', alerte: '⚠',
  verrou: '⚿', plus: '+', dossier: '▣', archive: '▭', agent: '●', coche: '✓',
  crayon: '✎', corbeille: '✕', passer: '»', oeil: '◉', fermer: '×', branche: '⑂',
  outil: '⚒', chantier: '⚒', phase: '⚑', apercu: '◧', idee: '✦', cible: '◎',
  code: '‹›', pinceau: '✎', bouclier: '⛨', chevron: '›', calendrier: '▦', globe: '◍', manette: '◈',
}

/** Le contenu du tracé (sans balise svg). */
export const tracer = (nom: NomIcone): string => T[nom]

const ATTR_TRAIT = 'fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'

/** Source SVG de l'icône, à la couleur et à la taille (px) données. */
export function icone(nom: NomIcone, couleur: string, taille: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${taille}" height="${taille}" ${ATTR_TRAIT} stroke="${couleur}">${T[nom]}</svg>`
}

/** Icône dans un rond plein (bulle de la maquette) : fond teinté, icône au centre. */
export function iconeRonde(nom: NomIcone, fond: string, couleur: string, taille: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${taille}" height="${taille}">` +
    `<circle cx="24" cy="24" r="24" fill="${fond}"/>` +
    `<g transform="translate(12 12)" ${ATTR_TRAIT} stroke="${couleur}">${T[nom]}</g></svg>`
  )
}

/** Avatar : rond avec l'initiale (une lettre seulement, jamais de balisage venu des données). */
export function avatarSvg(nom: string, fond: string, couleur: string, taille: number): string {
  const l = (nom.match(/\p{L}/u)?.[0] ?? '?').toUpperCase()
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="${taille}" height="${taille}">` +
    `<circle cx="14" cy="14" r="14" fill="${fond}"/>` +
    `<text x="14" y="18" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="600" fill="${couleur}">${l}</text></svg>`
  )
}

/** Barre de progression de la maquette : 8 px, piste `survol`, valeur bornée entre 0 et 1 (illisible : 0). */
export function barreSvg(valeur: number, piste: string, remplissage: string, largeur: number): string {
  const v = Number.isFinite(valeur) ? Math.max(0, Math.min(1, valeur)) : 0
  const plein = Math.round(v * largeur * 100) / 100
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largeur} 8" width="${largeur}" height="8">` +
    `<rect width="${largeur}" height="8" rx="4" fill="${piste}"/>` +
    (plein > 0 ? `<rect width="${Math.max(plein, 8)}" height="8" rx="4" fill="${remplissage}"/>` : '') +
    `</svg>`
  )
}

/** Pastille ronde de 8 px (point des chips de pôle). */
export function pointSvg(couleur: string, taille = 8): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="${taille}" height="${taille}"><circle cx="4" cy="4" r="4" fill="${couleur}"/></svg>`
}
