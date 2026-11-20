// Phases du projet et portes de qualité : logique pure, sans fs ni process (les hooks tournent hors Node).
// Les phases viennent du projet (`PhaseDef[]` passé en paramètre) : aucune liste n'est codée en dur.
// Chaque membre tient son fichier de portes, une entrée par ligne :
//   porte: <id>             → j'ai validé la porte
//   force: <id> | seul      → j'avance sans attendre la validation de l'autre
//   refus: <id> | <note>    → je réponds « pas encore » à la proposition de l'autre
// Une ligne inconnue ou mal formée est ignorée. Les notes sont des DONNÉES : du texte brut, jamais interprété.

import { memeMembre } from './projet.ts'
import type { PhaseDef } from './projet.ts'

export type Portes = { valides: string[]; forces: string[]; refus: { phase: string; note: string }[] }

export type EtatPorte =
  | 'a-valider'
  | 'en-attente-de-l-autre'
  | 'validee-a-deux'
  | 'forcee-sans-l-autre'
  | 'refusee-par-l-autre'

export type EtapeHistorique = {
  phase: PhaseDef
  etat: 'terminee' | 'en-cours' | 'a-venir'
  franchie: 'a-deux' | 'forcee' | 'sautee' | null
}

type Par = Record<string, Portes>

export function lirePortes(texte: string): Portes {
  const p: Portes = { valides: [], forces: [], refus: [] }
  for (const ligne of texte.split(/\r?\n/)) {
    const i = ligne.indexOf(':')
    if (i <= 0) continue
    const cle = ligne.slice(0, i).trim()
    const reste = ligne.slice(i + 1)
    const barre = reste.indexOf('|')
    const phase = (barre < 0 ? reste : reste.slice(0, barre)).trim()
    if (phase === '') continue
    if (cle === 'porte') {
      if (!p.valides.includes(phase)) p.valides.push(phase)
    } else if (cle === 'force') {
      if (!p.forces.includes(phase)) p.forces.push(phase)
    } else if (cle === 'refus') {
      if (!p.refus.some(r => r.phase === phase)) p.refus.push({ phase, note: barre < 0 ? '' : reste.slice(barre + 1).trim() })
    }
  }
  return p
}

const ligneNette = (s: string): string => s.replace(/\s*[\r\n]+\s*/g, ' ').trim()
/** Un identifiant ne peut contenir ni saut de ligne ni « | » : il ne peut pas créer une ligne ou un champ de plus. */
const idNet = (s: string): string => ligneNette(s).replace(/\|/g, '/')

export function serializePortes(p: Portes): string {
  const lignes: string[] = []
  for (const v of p.valides) lignes.push(`porte: ${idNet(v)}`)
  for (const f of p.forces) lignes.push(`force: ${idNet(f)} | seul`)
  for (const r of p.refus) lignes.push(`refus: ${idNet(r.phase)}${r.note ? ` | ${ligneNette(r.note)}` : ''}`)
  return lignes.join('\n') + (lignes.length ? '\n' : '')
}

/** La clé de `par` qui désigne ce membre (écritures différentes d'un même prénom tolérées). */
const cle = (membre: string, par: Par): string => Object.keys(par).find(k => memeMembre(k, membre)) ?? membre
const autres = (moi: string, par: Par): string[] => {
  const mienne = cle(moi, par)
  return Object.keys(par).filter(k => k !== mienne)
}

const aValide = (p: Portes | undefined, phase: string): boolean => !!p?.valides.includes(phase)
const aForce = (p: Portes | undefined, phase: string): boolean => !!p?.forces.includes(phase)
/** Validation ou forçage : pour l'associé, les deux disent « j'ai fini cette porte de mon côté ». */
const dit = (p: Portes | undefined, phase: string): boolean => aValide(p, phase) || aForce(p, phase)

/** Porte franchie pour moi : une porte plus loin vaut franchie ; sinon validée/forcée par moi et validée par tous les autres (sauf si j'ai forcé). */
function franchie(moi: string, i: number, phases: PhaseDef[], par: Par): boolean {
  const miens = par[cle(moi, par)]
  if (phases.slice(i + 1).some(p => dit(miens, p.id))) return true
  const id = phases[i]!.id
  if (!dit(miens, id)) return false
  return aForce(miens, id) || autres(moi, par).every(x => dit(par[x], id))
}

/** La phase où je travaille : la première non franchie ; après la dernière, on reste sur la dernière ('' sans phase). */
export function phaseActuelle(moi: string, phases: PhaseDef[], par: Par): string {
  const i = phases.findIndex((_, k) => !franchie(moi, k, phases, par))
  return i < 0 ? (phases[phases.length - 1]?.id ?? '') : phases[i]!.id
}

export function etatPorte(moi: string, phase: string, _phases: PhaseDef[], par: Par): EtatPorte {
  const miens = par[cle(moi, par)]
  if (!dit(miens, phase)) return 'a-valider'
  const lesAutres = autres(moi, par)
  if (lesAutres.every(x => dit(par[x], phase))) return 'validee-a-deux'
  if (aForce(miens, phase)) return 'forcee-sans-l-autre'
  if (lesAutres.some(x => par[x]?.refus.some(r => r.phase === phase))) return 'refusee-par-l-autre'
  return 'en-attente-de-l-autre'
}

/** Pour chaque phase : terminée (franchie, `forcee` si j'ai avancé sans l'autre), en cours (la phase actuelle) ou à venir. */
export function historique(moi: string, phases: PhaseDef[], par: Par): EtapeHistorique[] {
  const actuelle = phases.findIndex((_, k) => !franchie(moi, k, phases, par))
  return phases.map((phase, i) => {
    if (actuelle >= 0 && i >= actuelle) return { phase, etat: i === actuelle ? 'en-cours' : 'a-venir', franchie: null }
    const e = etatPorte(moi, phase.id, phases, par)
    return { phase, etat: 'terminee', franchie: e === 'validee-a-deux' ? 'a-deux' : e === 'forcee-sans-l-autre' ? 'forcee' : 'sautee' }
  })
}
