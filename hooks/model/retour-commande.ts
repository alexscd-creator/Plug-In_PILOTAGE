// Ce qui s'est passé quand un bouton du panneau a voulu envoyer une commande dans la conversation. Logique pure.
//   rempli      : la commande attend dans la zone de saisie (Entrée pour l'envoyer)
//   copie       : elle est dans le presse-papiers (Ctrl+V pour la coller)
//   copie-echec : la copie a échoué ; la commande est affichée à sélectionner
//   taper       : ni envoi, ni remplissage, ni copie n'ont été possibles ; la commande est affichée
// Un envoi réussi ne laisse rien à dire (retour vide).
export type ModeRetour = 'rempli' | 'copie' | 'copie-echec' | 'taper'
const MODES: ModeRetour[] = ['rempli', 'copie', 'copie-echec', 'taper']

export const encoderRetour = (mode: ModeRetour, texte: string): string => `${mode}|${texte}`

export function decrireRetour(brut: string): { mode: ModeRetour; texte: string } | null {
  if (typeof brut !== 'string') return null
  const i = brut.indexOf('|')
  if (i <= 0) return null
  const mode = brut.slice(0, i) as ModeRetour
  const texte = brut.slice(i + 1)
  return MODES.includes(mode) && texte !== '' ? { mode, texte } : null
}
