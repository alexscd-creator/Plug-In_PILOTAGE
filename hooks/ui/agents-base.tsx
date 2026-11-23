// Types et aides partagés par la grille et le détail des agents (évite qu'ils s'importent l'un l'autre).
import type { EtatAgent, Live } from '../model/agents-live.ts'
import type { AgentDef, Pole, Projet } from '../model/projet.ts'
import type { Ctx } from './kit'
import { couleurPole } from './theme'
import type { Teinte } from './theme'

/** Actions sur les skills ; absent quand le prénom est inconnu (lecture seule). */
export type GestionSkills = {
  ajouter: (agent: string) => void | Promise<void>
  retirer: (agent: string, skill: string) => void | Promise<void>
  supprimer: (skill: string) => void | Promise<void>
  demander: (skill: string) => void | Promise<void>
}

export type DonneesAgents = {
  projet: Projet
  /** Un état par agent du projet (`fusionnerEtats`). */
  etats: EtatAgent[]
  live: Live
  fichesAgents: Record<string, boolean>
  fichesSkills: Record<string, boolean>
  maintenant: number
  /** Pôle filtré ('' : tous). */
  filtre: string
  /** Agent dont le détail est ouvert ('' : la grille). */
  ouvert: string
  copier: (texte: string, surface?: string) => Promise<void>
  filtrer: (pole: string) => void | Promise<void>
  ouvrir: (agent: string) => void | Promise<void>
}

export const cheminAgent = (id: string): string => `.pilotage/agents/${id}.md`
export const cheminSkill = (skill: string): string => `.pilotage/skills/${skill}.md`

/** Pôle d'un agent et sa teinte ; teinte absente si le pôle n'est plus dans le projet. */
export function poleAgent(projet: Projet, a: AgentDef): { pole: Pole | null; teinte: Teinte | undefined } {
  const i = projet.poles.findIndex(p => p.id === a.pole)
  return i < 0 ? { pole: null, teinte: undefined } : { pole: projet.poles[i]!, teinte: couleurPole(projet.poles[i]!.couleur, i) }
}

/** Bouton qui copie un chemin ; son nom accessible est `label`. */
export function boutonVoir(c: Ctx, cle: string, label: string, chemin: string, copier: DonneesAgents['copier']) {
  const { Button } = c.ui
  return <Button key={cle} label={label} variant="secondary" onPress={((p: { surface?: string } | undefined) => copier(chemin, p?.surface)) as never} />
}
