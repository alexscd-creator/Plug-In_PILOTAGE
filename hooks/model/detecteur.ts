// Détecteur d'idées et de retours : repère, sans appel au modèle, un message de l'utilisateur qui ressemble à une idée ou à un retour,
// pour que le hook `prompt.submit` ajoute au contexte de ce message un rappel de tri (skill `chef-de-projet`). Il ne décide rien :
// c'est Claude qui trie. Logique pure, déterministe, sans fs ni `$`.

/** Rappel ajouté au contexte d'un message qui ressemble à une idée ou à un retour. */
export const RAPPEL_TRI =
  'Pilotage : ce message ressemble à une idée ou à un retour. Trie-le (skill `chef-de-projet`) : petit correctif ici, note pour plus tard, ou chantier proposé ; dis-le en une ligne.'

/** Au-delà, seul le début du message est examiné. */
const MAX_EXAMINE = 2000

/** Tournures (texte sans accent, en minuscules, apostrophes unifiées). */
const TOURNURES: RegExp[] = [
  /\bet si (on|je|tu|vous|l'on)\b/,
  /\bce serait (bien|mieux|cool|top|pratique|sympa|super)\b/,
  /\bca serait (bien|mieux|cool|top|pratique|sympa|super)\b/,
  /\bil faudrait\b/,
  /\bon (pourrait|devrait)\b/,
  /\bj'aimerais\b/,
  /\bje voudrais (que|qu'|pouvoir)\b/,
  /\b(ca|cela) (ne )?marche (pas|plus|mal)\b/,
  /\b(ca|cela) (ne )?fonctionne (pas|plus|mal)\b/,
  /\bbugs?\b/,
  /\bbugu?e\b/,
  /^\s*(retour|feedback|idee|remarque)\s*:/,
  /\bune idee\b/,
  /\btrop (petit|petite|grand|grande|lent|lente|long|longue|gros|grosse|charge|chargee)s?\b/,
  /\b(pas|peu) (clair|claire|lisible|pratique|intuitif|intuitive)\b/,
]

const normaliser = (s: string): string =>
  s.slice(0, MAX_EXAMINE).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[‘’ʼ`]/g, "'")

/** Vrai quand le message ressemble à une idée ou à un retour. Jamais pour une commande (`/…`) ni un texte vide. Ne lève jamais. */
export function ressembleIdeeOuRetour(texte: string): boolean {
  if (typeof texte !== 'string') return false
  const t = texte.trim()
  if (t === '' || t.startsWith('/')) return false
  const n = normaliser(t)
  return TOURNURES.some(r => r.test(n))
}
