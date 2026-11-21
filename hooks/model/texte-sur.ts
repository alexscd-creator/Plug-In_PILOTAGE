// Nettoyage commun des textes qui viennent des fichiers du projet et finissent dans un prompt ou à l'écran : logique pure, sans
// dépendance (le bac à sable des hooks n'a ni `toWellFormed` ni Node). Une valeur devient UNE ligne, sans contrôle ni caractère
// invisible, sans chevron ni accent grave, bornée en POINTS DE CODE et toujours bien formée (jamais de demi-paire de substitution).

/** Séparateurs de ligne ou de paragraphe et tabulations : chacun devient une espace. */
const SEPARATEURS = new RegExp('[\t\n\u000B\u000C\r\u0085\u2028\u2029]', 'g')
/** Contrôles C0 et C1 (hors séparateurs ci-dessus), soft hyphen, zéro largeur, marques et forçages bidi, mot-joint, BOM. */
const INVISIBLES = new RegExp('[\u0000-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F\u00AD\u200B-\u200F\u2060\u202A-\u202E\u2066-\u2069\uFEFF]', 'g')
const ANGLES = new RegExp('[<>\uFF1C\uFF1E\u2039\u203A`]', 'g')

/** Retire les contrôles et caractères invisibles ; garde les séparateurs de ligne et les tabulations (pour un texte à plusieurs lignes). */
export const retirerInvisibles = (s: string): string => String(s ?? '').replace(INVISIBLES, '')

/** Les `max` premiers points de code, une demi-paire isolée devenant U+FFFD. Parcours linéaire : un texte de 1 Mo ne coûte que `max` tours. */
export function tronquer(s: string, max: number): string {
  let sortie = ''
  let n = 0
  for (let i = 0; i < s.length && n < max; i++, n++) {
    const c = s.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1)
      if (d >= 0xdc00 && d <= 0xdfff) { sortie += s[i]! + s[i + 1]!; i++ } else sortie += '�'
    } else sortie += c >= 0xdc00 && c <= 0xdfff ? '�' : s[i]!
  }
  return sortie
}

/** Une valeur du projet sur UNE ligne, sûre pour un prompt, bornée à `max` points de code (0 ou invalide : vide). Ne lève jamais. */
export function texteSur(valeur: unknown, max: number): string {
  try {
    const limite = Number.isFinite(max) && max > 0 ? Math.floor(max) : 0
    const s = String(valeur ?? '').replace(SEPARATEURS, ' ').replace(INVISIBLES, '').replace(ANGLES, '').replace(/ {2,}/g, ' ').trim()
    return tronquer(s, limite).trim()
  } catch {
    return ''
  }
}
