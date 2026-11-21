// Synthèses du panneau (vue d'ensemble, plan) : logique pure, sans fs ni process (les hooks tournent hors Node).
import { historique, phaseActuelle } from './phases.ts'
import type { Portes } from './phases.ts'
import { portePossible } from './plan.ts'
import type { Tache } from './plan.ts'
import type { AgentDef, PhaseDef, Projet } from './projet.ts'

export type Avancement = { total: number; faites: number; pourcent: number }

/**
 * Avancement d'un ensemble de tâches. `faites` = les terminées. `total` = toutes les tâches SAUF les abandonnées
 * (une tâche abandonnée ne reste pas à faire) ; les reportées comptent dans `total` mais pas dans `faites`.
 * `pourcent` = faites / total arrondi à l'entier, 0 si `total` vaut 0.
 */
export function avancementGlobal(taches: Tache[]): Avancement {
  const comptees = taches.filter(t => t.statut !== 'abandonne')
  const faites = comptees.filter(t => t.statut === 'termine').length
  return { total: comptees.length, faites, pourcent: comptees.length === 0 ? 0 : Math.round((faites / comptees.length) * 100) }
}

/** Phase où je travaille (null sans phase), son rang à partir de 1 (0 sans phase), le nombre de phases et l'historique. */
export function resumerPhases(projet: Projet, _taches: Tache[], moi: string, portes: Record<string, Portes>) {
  const id = phaseActuelle(moi, projet.phases, portes)
  const i = projet.phases.findIndex(p => p.id === id)
  const actuelle: PhaseDef | null = i < 0 ? null : projet.phases[i]!
  return { actuelle, indice: i + 1, sur: projet.phases.length, historique: historique(moi, projet.phases, portes) }
}

/** Avancement des tâches rattachées à un pôle (champ `pole` du plan) et les agents de ce pôle. */
export function avancementPole(projet: Projet, taches: Tache[], poleId: string): Avancement & { agents: AgentDef[] } {
  return { ...avancementGlobal(taches.filter(t => t.pole === poleId)), agents: projet.agents.filter(a => a.pole === poleId) }
}

/** Bandeau « porte verrouillée » : vrai tant que la phase compte des tâches à faire ou en cours. */
export function bandeauPorte(taches: Tache[], phaseId: string): { bloquee: boolean; ouvertes: Tache[] } {
  const r = portePossible(taches, phaseId)
  return { bloquee: !r.ok, ouvertes: r.ouvertes }
}
