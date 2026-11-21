// Presets de projet et workflow idéal : logique pure, sans fs ni process (les hooks tournent hors Node).
// Les fichiers `presets/*.json` sont lus ailleurs ; ici on ne reçoit que leur texte déjà lu.

import { parseProjet, DEFAUT_VOCABULAIRE } from './projet.ts'
import type { Pole, PhaseDef, AgentDef, Workflow, Projet, Vocabulaire, ReglageDef } from './projet.ts'

export type Preset = {
  id: string; titre: string; poles: Pole[]; phases: PhaseDef[]; agents: AgentDef[]; workflow: Workflow
  vocabulaire: Vocabulaire; reglagesDef: ReglageDef[]
}

const ID_PAR_DEFAUT = 'autre'

/** Valide un preset : on réutilise parseProjet sur un projet factice pour ne pas dupliquer les règles. */
export function parsePreset(texte: string): Preset | null {
  let brut: unknown
  try { brut = JSON.parse(texte) } catch { return null }
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null
  const o = brut as Record<string, unknown>
  if (typeof o.id !== 'string' || o.id.trim() === '' || typeof o.titre !== 'string' || o.titre.trim() === '') return null
  const r = parseProjet(JSON.stringify({
    version: 1, nom: o.titre, but: o.titre, fini: o.titre, preset: o.id, equipe: ['x'],
    poles: o.poles, phases: o.phases, agents: o.agents, workflow: o.workflow,
    vocabulaire: o.vocabulaire, reglagesDef: o.reglagesDef,
  }))
  if (!r.ok) return null
  const { poles, phases, agents, workflow, vocabulaire, reglagesDef } = r.projet
  return { id: o.id, titre: o.titre, poles, phases, agents, workflow, vocabulaire, reglagesDef }
}

/** Crée un projet à partir d'un preset et des réponses du questionnaire (copies, le preset reste intact). */
export function preparerProjet(
  preset: Preset,
  reponses: { nom: string; but: string; fini: string; equipe: string[] },
): Projet {
  return {
    version: 1,
    nom: reponses.nom,
    but: reponses.but,
    fini: reponses.fini,
    preset: preset.id,
    equipe: [...reponses.equipe],
    poles: preset.poles.map(p => ({ ...p })),
    phases: preset.phases.map(p => ({ ...p, taches: [...p.taches] })),
    agents: preset.agents.map(a => ({ ...a, skills: [...a.skills] })),
    workflow: { outils: preset.workflow.outils.map(o => ({ ...o })) },
    vocabulaire: { ...preset.vocabulaire },
    reglagesDef: preset.reglagesDef.map(d => ({ ...d, ...(d.options ? { options: [...d.options] } : {}) })),
    reglages: Object.fromEntries(preset.reglagesDef.filter(d => d.defaut !== undefined).map(d => [d.id, d.defaut as string | boolean])),
  }
}

/** Libellé d'interface qui suit le type de projet (ex. « Nom du site » ou « Nom de l'application »). */
export function libelle(p: Projet, cle: keyof Vocabulaire): string {
  return p.vocabulaire?.[cle] ?? DEFAUT_VOCABULAIRE[cle] ?? ''
}

/** Workflow proposé par le preset, ou celui de « autre » si l'identifiant est inconnu. */
export function workflowIdeal(presetId: string, presets: Preset[]): Workflow {
  const p = presets.find(x => x.id === presetId) ?? presets.find(x => x.id === ID_PAR_DEFAUT)
  return p ? { outils: p.workflow.outils.map(o => ({ ...o })) } : { outils: [] }
}

/** Contenu de `~/.claude/pilotage/mon-workflow.json` : refusé s'il n'a pas de liste `outils` valide. */
export function parseMonWorkflow(texte: string): Workflow | null {
  let brut: unknown
  try { brut = JSON.parse(texte) } catch { return null }
  if (typeof brut !== 'object' || brut === null || !Array.isArray((brut as { outils?: unknown }).outils)) return null
  const outils: { role: string; outil: string }[] = []
  for (const x of (brut as { outils: unknown[] }).outils) {
    if (typeof x !== 'object' || x === null) return null
    const { role, outil } = x as Record<string, unknown>
    if (typeof role !== 'string' || role.trim() === '' || typeof outil !== 'string' || outil.trim() === '') return null
    outils.push({ role, outil })
  }
  return { outils }
}
