// Gestion des skills depuis la page Agents : textes des demandes préparées pour Claude et choix proposés (fonctions pures, sans disque).
// Le panneau n'écrit jamais le texte d'un skill : il prépare une demande que Claude exécute avec scripts/pilotage-skill.mjs.
import type { AgentDef, Projet } from './projet.ts'

export const NOUVEAU = 'Nouveau skill'
export const AUTRE = 'Autre'
export const ANNULER = 'Annuler'
const PAR_PAGE = 3

/** Identifiant de skill sûr pour une phrase : minuscules, chiffres et tirets seulement, 60 caractères au plus ('' s'il ne reste rien). */
export const idSkillSur = (s: unknown): string => (typeof s === 'string' ? s.replace(/[^a-z0-9-]/g, '').slice(0, 60) : '')

/** Demande prête pour modifier le texte d'un skill ('' si l'identifiant ne donne rien). `<décrivez le changement>` reste à compléter par l'utilisateur. */
export function demandeModifier(skill: unknown): string {
  const id = idSkillSur(skill)
  return id === '' ? '' : `Modifie le skill ${id} du projet avec le script pilotage-skill.mjs : <décrivez le changement>`
}

/** Demande prête pour rédiger un nouveau skill ; le titre de l'agent est mis sur une ligne, sans guillemet ni accent grave ni chevron. */
export function demandeNouveau(titreAgent: unknown): string {
  const t = (typeof titreAgent === 'string' ? titreAgent : '').replace(/[`"<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60)
  return `Crée un nouveau skill pour l'agent ${t === '' ? 'choisi' : t} du projet avec le script pilotage-skill.mjs (action creer) : <décrivez le skill voulu>`
}

export const agentsUtilisant = (projet: Projet, skill: string): AgentDef[] => projet.agents.filter(a => a.skills.includes(skill))

/** Skills (parmi `disponibles`) que cet agent n'a pas encore. */
export const pasRattaches = (projet: Projet, agent: string, disponibles: string[]): string[] => {
  const a = projet.agents.find(x => x.id === agent)
  return disponibles.filter(s => !(a?.skills ?? []).includes(s))
}

/**
 * Choix de la question « Ajouter un skill » : 2 à 4 options. Au plus trois skills par page ; s'il en reste, « Autre » mène à la page
 * suivante (`suivante`), sinon « Nouveau skill » ferme la liste. Sans candidat : « Nouveau skill » et « Annuler ».
 */
export function optionsAjout(candidats: string[], page: number): { options: string[]; suivante: number | null; skills: string[] } {
  const debut = Math.max(0, page) * PAR_PAGE
  const skills = candidats.slice(debut, debut + PAR_PAGE)
  const reste = candidats.length - (debut + skills.length)
  // Trois exactement et rien derrière : « Nouveau skill » tient dans les quatre options.
  if (reste > 0) return { options: [...skills, AUTRE], suivante: Math.max(0, page) + 1, skills }
  const options = [...skills, NOUVEAU]
  if (options.length < 2) options.push(ANNULER)
  return { options, suivante: null, skills }
}
