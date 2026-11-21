// Jetons de la maquette (docs/maquette.md §3 et §4), modes clair et sombre.
// Les teintes « soft » de la maquette (transparence 12 % clair, 18 % sombre) sont mélangées d'avance avec la
// surface : des hex opaques, sans canal alpha. Logique pure.
import { TEINTES_POLE } from '../model/projet.ts'

export type Mode = 'clair' | 'sombre'
export type Teinte = (typeof TEINTES_POLE)[number]
export const TEINTES: readonly Teinte[] = TEINTES_POLE

export type EtatStatut = 'travail' | 'attente' | 'arrete' | 'reprendre' | 'bloque' | 'termine'
export const ETATS: readonly EtatStatut[] = ['travail', 'attente', 'arrete', 'reprendre', 'bloque', 'termine']
/** Libellés exacts de la maquette (§3) : jamais la couleur seule, toujours une icône et ce libellé. */
export const LIBELLES_ETAT: Record<EtatStatut, string> = {
  travail: 'En travail',
  attente: 'En attente d’une réponse',
  arrete: 'Arrêté',
  reprendre: 'Prêt à reprendre',
  bloque: 'Bloqué',
  termine: 'Terminé',
}
const ICONE_ETAT = { travail: 'play', attente: 'attente', arrete: 'stop', reprendre: 'reprendre', bloque: 'bloque', termine: 'termine' } as const

export type Teinté = { fg: string; soft: string }
export type Jetons = {
  mode: Mode
  fond: string; surface: string; releve: string; survol: string
  bord: string; bordFort: string
  texte: string; texteSec: string; texteDim: string
  accent: string; accentSoft: string; surAccent: string
  etats: Record<EtatStatut, Teinté & { icone: (typeof ICONE_ETAT)[EtatStatut] }>
  poles: Record<Teinte, Teinté>
}

const canaux = (c: string): [number, number, number] => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) as [number, number, number]
const hex2 = (n: number): string => Math.round(n).toString(16).padStart(2, '0')

/** Teinte posée à `alpha` sur un fond : un hex opaque. */
export function melange(teinte: string, fond: string, alpha: number): string {
  const t = canaux(teinte), f = canaux(fond)
  return '#' + t.map((v, i) => hex2(f[i]! + (v - f[i]!) * alpha)).join('')
}

function luminance(c: string): number {
  const [r, g, b] = canaux(c).map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rapport de contraste WCAG entre deux couleurs. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

const BASE = {
  clair: {
    fond: '#f6f7fa', surface: '#ffffff', releve: '#eceef5', survol: '#d9dde8', bord: '#d9dde8', bordFort: '#b3b9ca',
    texte: '#13151b', texteSec: '#3e4454', texteDim: '#5e6577', accent: '#4f56e0', surAccent: '#ffffff',
    etats: { travail: '#1d64b8', attente: '#8a5a00', arrete: '#4a5163', reprendre: '#4f56e0', bloque: '#b42318', termine: '#18794e' },
    poles: { violet: '#6b46c1', bleu: '#0f6aa6', sarcelle: '#0b6b64', vert: '#376b1a', orange: '#a4480a', rose: '#b8326e' },
    alpha: 0.12,
  },
  sombre: {
    fond: '#0d0e12', surface: '#13151b', releve: '#1a1d25', survol: '#232733', bord: '#2b303d', bordFort: '#3e4454',
    texte: '#eceef5', texteSec: '#b3b9ca', texteDim: '#858ca0', accent: '#8b93ff', surAccent: '#0d0e12',
    etats: { travail: '#7cb6ff', attente: '#f2b84b', arrete: '#b3b9ca', reprendre: '#a5abff', bloque: '#ff8a80', termine: '#5bd39a' },
    poles: { violet: '#b69cff', bleu: '#6cc0f5', sarcelle: '#4fd1c5', vert: '#9bd66f', orange: '#ffa45c', rose: '#ff8cc0' },
    alpha: 0.18,
  },
} as const

export function jetons(mode: Mode): Jetons {
  const b = BASE[mode]
  const soft = (fg: string): Teinté => ({ fg, soft: melange(fg, b.surface, b.alpha) })
  return {
    mode,
    fond: b.fond, surface: b.surface, releve: b.releve, survol: b.survol, bord: b.bord, bordFort: b.bordFort,
    texte: b.texte, texteSec: b.texteSec, texteDim: b.texteDim,
    accent: b.accent, accentSoft: melange(b.accent, b.surface, b.alpha), surAccent: b.surAccent,
    etats: Object.fromEntries(ETATS.map(e => [e, { ...soft(b.etats[e]), icone: ICONE_ETAT[e] }])) as Jetons['etats'],
    poles: Object.fromEntries(TEINTES.map(t => [t, soft(b.poles[t])])) as Jetons['poles'],
  }
}

/** Teinte d'un pôle : sa couleur si elle est valide, sinon celle de son rang (deux pôles n'ont jamais la même teinte). */
export function couleurPole(couleur: string | undefined, index: number): Teinte {
  const connue = TEINTES.find(t => t === couleur)
  return connue ?? TEINTES[((index % TEINTES.length) + TEINTES.length) % TEINTES.length]!
}

/** Espacements (px) de la maquette. */
export const ESPACES = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48, '4xl': 64 } as const
/** Rayons (px) de la maquette. */
export const RAYONS = { sm: 6, md: 10, lg: 16, xl: 20, full: 999 } as const
/** Styles de texte de la maquette (taille / interligne en px, graisse). */
export const TYPO = {
  titreEcran: { taille: 28, interligne: 34, graisse: 'bold' },
  titreSection: { taille: 20, interligne: 26, graisse: 'semibold' },
  corps: { taille: 15, interligne: 22, graisse: 'regular' },
  corpsFort: { taille: 15, interligne: 22, graisse: 'semibold' },
  libelle: { taille: 13, interligne: 18, graisse: 'semibold' },
  legende: { taille: 12, interligne: 16, graisse: 'regular' },
  surtitre: { taille: 11, interligne: 14, graisse: 'semibold' },
} as const

// Mise en page. L'API de dessin compte en colonnes de caractères (pas en pixels) : on prend 8 px par colonne,
// d'où la colonne centrée de 880 px = 110 colonnes et le seuil mobile de 600 px = 75 colonnes.
export const PX_PAR_COLONNE = 8
export const MAX_COLONNE = 110
export const SEUIL_MOBILE = 75
const MIN_COLONNE = 20
// Gouttières de la maquette : 16 px (mobile) = 2 colonnes de chaque côté ; marges du bureau, 4 colonnes de chaque côté.
const GOUTTIERE_MOBILE = 2
const GOUTTIERE_BUREAU = 4

/** Mobile : l'application mobile, ou un panneau plus étroit que 600 px. */
export function estMobile(surface: string, colonnes: number): boolean {
  return surface === 'mobile' || (Number.isFinite(colonnes) && colonnes < SEUIL_MOBILE)
}

/** Largeur de la colonne centrée, en colonnes : 880 px au plus, gouttières retirées, jamais sous 20. */
export function largeurColonne(colonnes: number, mobile: boolean): number {
  if (!Number.isFinite(colonnes)) return MIN_COLONNE
  const libre = colonnes - 2 * (mobile ? GOUTTIERE_MOBILE : GOUTTIERE_BUREAU)
  return Math.max(MIN_COLONNE, Math.min(MAX_COLONNE, Math.floor(libre)))
}

/** Mode d'après la valeur de la ligne « theme » du menu de configuration (« light », « dark-daltonized »...) ; null si inconnue. */
export function modeDeTheme(valeur: unknown): Mode | null {
  if (typeof valeur !== 'string') return null
  if (valeur.startsWith('light')) return 'clair'
  if (valeur.startsWith('dark')) return 'sombre'
  return null
}
