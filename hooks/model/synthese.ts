// Synthèses du panneau (vue d'ensemble, plan) : logique pure, sans fs ni process (les hooks tournent hors Node).
import type { Chantier } from './chantier.ts'
import { etatPorte, historique } from './phases.ts'
import type { EtapeHistorique, Portes } from './phases.ts'
import { portePossible } from './plan.ts'
import type { Tache } from './plan.ts'
import { memeMembre } from './projet.ts'
import type { AgentDef, PhaseDef, Projet } from './projet.ts'

export type Avancement = { total: number; faites: number; pourcent: number }

/** Titre comparé sans casse, sans accent ni espace en trop (pour reconnaître la même tâche au plan et dans un chantier). */
const cleTitre = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

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
 * phases sont franchies : la page Plan et l'Aperçu lisent donc la même phase. Un membre inconnu n'a aucune
 * porte à son nom : il est en phase 1.
 */
export function resumerPhases(projet: Projet, _taches: Tache[], moi: string, portes: Record<string, Portes>) {
  const hist = historique(moi, projet.phases, portes)
  const i = hist.findIndex(h => h.etat === 'en-cours')
  const actuelle: PhaseDef | null = i < 0 ? null : projet.phases[i]!
  return { actuelle, indice: i + 1, sur: projet.phases.length, historique: hist }
}

/** Avancement des tâches rattachées à un pôle (champ `pole` du plan) et les agents de ce pôle. */
export function avancementPole(projet: Projet, taches: Tache[], poleId: string, chantiers: Chantier[] = []): Avancement & { agents: AgentDef[]; dansChantiers: number } {
  const duPlan = taches.filter(t => t.pole === poleId)
  // Une tâche de chantier dont le titre (casse, accents et espaces ignorés) est celui d'une tâche du plan du même pôle est la
  // même tâche : elle n'est comptée qu'une fois (celle du plan). Les autres tâches de chantiers comptent avec le pôle du chantier.
  const vues = new Set(duPlan.map(t => cleTitre(t.titre)))
  const duChantier = chantiers.filter(c => c.pole === poleId).flatMap(c => c.taches).filter(t => !vues.has(cleTitre(t.titre)))
  return {
    ...avancementGlobal([...duPlan, ...duChantier] as Tache[]),
    agents: projet.agents.filter(a => a.pole === poleId),
    dansChantiers: duChantier.filter(t => t.statut !== 'abandonne').length,
  }
}

/** Bandeau « porte verrouillée » : vrai tant que la phase compte des tâches à faire ou en cours. */
export function bandeauPorte(taches: Tache[], phaseId: string): { bloquee: boolean; ouvertes: Tache[] } {
  const r = portePossible(taches, phaseId)
  return { bloquee: !r.ok, ouvertes: r.ouvertes }
}

/** Porte franchie telle qu'on la dit : « validee » quand l'équipe n'a qu'un membre (rien n'a été validé à deux). */
export type FranchieVue = 'a-deux' | 'validee' | 'forcee' | 'sautee'
/** Porte d'une phase telle que la page Phases la dit : `inconnu` quand le membre courant n'est pas dans l'équipe. */
export type PorteVue = 'a-deux' | 'validee' | 'forcee' | 'passee' | 'en-attente' | 'refusee' | 'a-valider' | 'inconnu'

export type EtapeFrise = { phase: PhaseDef; etat: EtapeHistorique['etat']; franchie: FranchieVue | null; pourcent: number }

/** Vrai si `moi` désigne un membre de l'équipe du projet. Sinon aucun état de porte ne peut lui être attribué. */
export const moiConnu = (projet: Projet, moi: string): boolean => moi !== '' && projet.equipe.some(m => memeMembre(m, moi))

/** Les étapes de la frise, calculées une seule fois. Un membre inconnu n'a rien de franchi. */
export function frisePhases(projet: Projet, taches: Tache[], moi: string, portes: Record<string, Portes>): EtapeFrise[] {
  const connu = moiConnu(projet, moi)
  const solo = projet.equipe.length === 1
  const miens = connu ? portes[Object.keys(portes).find(k => memeMembre(k, moi)) ?? moi] : undefined
  const { historique: hist } = resumerPhases(projet, taches, connu ? moi : '', portes)
  return hist.map(h => {
    let franchie: FranchieVue | null = null
    if (h.franchie === 'a-deux') franchie = !solo ? 'a-deux' : miens?.forces.includes(h.phase.id) ? 'forcee' : 'validee'
    else if (h.franchie) franchie = h.franchie
    return { phase: h.phase, etat: h.etat, franchie, pourcent: avancementGlobal(taches.filter(t => t.phase === h.phase.id)).pourcent }
  })
}

export type DetailPhase = {
  phase: PhaseDef
  /** Rang (à partir de 1) dans les phases du projet. */
  indice: number
  etat: EtapeHistorique['etat']
  franchie: FranchieVue | null
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
  const connu = moiConnu(projet, moi)
  const m = connu ? moi : ''
  const r = resumerPhases(projet, taches, m, portes)
  if (r.sur === 0) return null
  const voulu = projet.phases.findIndex(p => p.id === phaseId)
  const i = voulu >= 0 ? voulu : r.actuelle ? r.indice - 1 : r.sur - 1
  const e = frisePhases(projet, taches, moi, portes)[i]!
  const ici = taches.filter(t => t.phase === e.phase.id)
  let porte: PorteVue
  if (!connu) porte = 'inconnu'
  else if (e.franchie) porte = e.franchie === 'sautee' ? 'passee' : e.franchie
  else {
    const x = etatPorte(m, e.phase.id, projet.phases, portes)
    porte = x === 'a-valider' ? 'a-valider' : x === 'refusee-par-l-autre' ? 'refusee' : x === 'validee-a-deux' ? 'a-deux' : x === 'forcee-sans-l-autre' ? 'forcee' : 'en-attente'
  }
  return {
    phase: e.phase, indice: i + 1, etat: e.etat, franchie: e.franchie, porte, taches: ici,
    fichiers: [...new Set(ici.flatMap(t => (t.fichier ? [t.fichier] : [])))],
    reportees: ici.filter(t => t.statut === 'reporte').length,
    abandonnees: ici.filter(t => t.statut === 'abandonne').length,
    avancement: avancementGlobal(ici),
  }
}
