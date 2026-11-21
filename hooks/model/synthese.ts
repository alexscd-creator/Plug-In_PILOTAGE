// Synthèses du panneau (vue d'ensemble, plan) : logique pure, sans fs ni process (les hooks tournent hors Node).
import { etatPorte, historique } from './phases.ts'
import type { EtapeHistorique, Portes } from './phases.ts'
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

/**
 * Phase où je travaille : celle que l'historique marque « en cours ». Null (rang 0) sans phase ou quand toutes les
 * phases sont franchies : la page Plan et la Vue d'ensemble lisent donc la même phase. Un membre inconnu n'a aucune
 * porte à son nom : il est en phase 1.
 */
export function resumerPhases(projet: Projet, _taches: Tache[], moi: string, portes: Record<string, Portes>) {
  const hist = historique(moi, projet.phases, portes)
  const i = hist.findIndex(h => h.etat === 'en-cours')
  const actuelle: PhaseDef | null = i < 0 ? null : projet.phases[i]!
  return { actuelle, indice: i + 1, sur: projet.phases.length, historique: hist }
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

/** Porte d'une phase telle que la page Phases la dit : `inconnu` quand le membre courant n'est pas connu. */
export type PorteVue = 'a-deux' | 'forcee' | 'passee' | 'en-attente' | 'refusee' | 'a-valider' | 'inconnu'

export type DetailPhase = {
  phase: PhaseDef
  /** Rang (à partir de 1) dans les phases du projet. */
  indice: number
  etat: EtapeHistorique['etat']
  franchie: EtapeHistorique['franchie']
  porte: PorteVue
  /** Toutes les tâches de la phase, fermées comprises. */
  taches: Tache[]
  /** Chemins distincts des tâches, dans l'ordre du plan. */
  fichiers: string[]
  reportees: number
  abandonnees: number
  avancement: Avancement
}

/**
 * Détail d'une phase pour la page Phases. Un identifiant vide ou inconnu désigne la phase actuelle (ou la dernière
 * quand tout est franchi). Null sans phase.
 */
export function detailPhase(projet: Projet, taches: Tache[], phaseId: string, moi: string, portes: Record<string, Portes>): DetailPhase | null {
  const r = resumerPhases(projet, taches, moi, portes)
  if (r.sur === 0) return null
  const voulu = projet.phases.findIndex(p => p.id === phaseId)
  const i = voulu >= 0 ? voulu : r.actuelle ? r.indice - 1 : r.sur - 1
  const h = r.historique[i]!
  const ici = taches.filter(t => t.phase === h.phase.id)
  let porte: PorteVue
  if (moi === '') porte = 'inconnu'
  else if (h.franchie) porte = { 'a-deux': 'a-deux', forcee: 'forcee', sautee: 'passee' }[h.franchie] as PorteVue
  else {
    const e = etatPorte(moi, h.phase.id, projet.phases, portes)
    porte = e === 'a-valider' ? 'a-valider' : e === 'refusee-par-l-autre' ? 'refusee' : e === 'validee-a-deux' ? 'a-deux' : e === 'forcee-sans-l-autre' ? 'forcee' : 'en-attente'
  }
  return {
    phase: h.phase, indice: i + 1, etat: h.etat, franchie: h.franchie, porte, taches: ici,
    fichiers: [...new Set(ici.flatMap(t => (t.fichier ? [t.fichier] : [])))],
    reportees: ici.filter(t => t.statut === 'reporte').length,
    abandonnees: ici.filter(t => t.statut === 'abandonne').length,
    avancement: avancementGlobal(ici),
  }
}
