// Plan du projet et tâches par phase : logique pure, sans fs ni process (les hooks tournent hors Node).
// Le plan est un fichier Markdown que les membres éditent à la main :
//   ## <titre de la phase> (<id de la phase>)
//   - [ ] <id> | <titre> | fichier: <chemin relatif> | auteur: <prénom> | pole: <id du pôle>      (fichier, auteur et pôle facultatifs)
// Statuts : `[ ]` a faire, `[~]` en cours, `[x]` termine, `[>]` reporte, `[-]` abandonne.
// Identifiants : `<id de la phase>-<n>`, n = position (à partir de 1) de la tâche dans la phase du preset.
// Ils sont écrits dans le fichier et relus tels quels : modifier le texte, cocher ou réordonner à la main ne les change pas.
// Rien n'est jamais coché tout seul : une phase ne se valide que lorsque plus aucune tâche n'est `a faire` ou `en cours`.
// Le texte du fichier est une DONNÉE : lu et réécrit comme du texte brut, jamais interprété.

import type { Projet, PhaseDef } from './projet.ts'

export type Statut = 'a faire' | 'en cours' | 'termine' | 'reporte' | 'abandonne'
export type Tache = { id: string; phase: string; titre: string; statut: Statut; fichier?: string; auteur?: string; pole?: string }

const MARQUES: Record<Statut, string> = { 'a faire': ' ', 'en cours': '~', termine: 'x', reporte: '>', abandonne: '-' }
const STATUTS: Record<string, Statut> = { ' ': 'a faire', '~': 'en cours', x: 'termine', X: 'termine', '>': 'reporte', '-': 'abandonne' }

// Même approche que phases.ts : pas de saut de ligne, et « | » remplacé, pour ne créer ni ligne ni champ de plus.
const ligneNette = (s: string): string => s.replace(/\s*[\r\n]+\s*/g, ' ').trim()
const texteNet = (s: string): string => ligneNette(s).replace(/\|/g, '/')
/** Identifiant de tâche : un seul mot (sans espace). */
const idTacheNet = (s: string): string => texteNet(s).replace(/\s+/g, '-')
/** Identifiant de phase dans un titre `## ... (<id>)` : sans parenthèse. */
const idPhaseNet = (s: string): string => texteNet(s).replace(/[()]/g, '_')

const ligneTache = (t: Tache): string =>
  `- [${MARQUES[t.statut]}] ${idTacheNet(t.id)} | ${texteNet(t.titre)}` +
  (t.fichier && texteNet(t.fichier) ? ` | fichier: ${texteNet(t.fichier)}` : '') +
  (t.auteur && texteNet(t.auteur) ? ` | auteur: ${texteNet(t.auteur)}` : '') +
  (t.pole && texteNet(t.pole) ? ` | pole: ${texteNet(t.pole)}` : '')

const enteteRe = /^\s{0,3}##\s+(.*?)\(([^()]*)\)\s*$/
const titreSansIdRe = /^\s{0,3}##\s/
const tacheRe = /^\s*[-*]\s+\[(.?)\]\s+(.*)$/
/** Titre des tâches sans phase (titre `## ` sans `(id)`, ou tâche avant tout titre) : relues avec phase '' puis réécrites ici. */
const SANS_PHASE = 'Sans phase'

function ecrire(blocs: { id: string; titre: string; taches: Tache[] }[]): string {
  const sortie: string[] = []
  for (const b of blocs) {
    if (sortie.length) sortie.push('')
    sortie.push(b.id === '' ? `## ${SANS_PHASE}` : `## ${texteNet(b.titre)} (${idPhaseNet(b.id)})`, '')
    for (const t of b.taches) sortie.push(ligneTache(t))
    if (!b.taches.length) sortie.pop()
  }
  return sortie.join('\n') + (sortie.length ? '\n' : '')
}

/** Plan neuf : une tâche `a faire` par entrée de chaque phase du projet. */
export function genererPlan(p: Projet): string {
  return ecrire(p.phases.map(ph => ({
    id: ph.id, titre: ph.titre,
    taches: ph.taches.map((titre, i) => ({ id: `${ph.id}-${i + 1}`, phase: ph.id, titre, statut: 'a faire' as const })),
  })))
}

/** Relit le plan. Ignorées : les lignes qui ne ressemblent pas à une tâche (sans id ni titre), les ids déjà vus. Marque de statut inconnue = `a faire`. */
export function parsePlan(texte: string): Tache[] {
  const taches: Tache[] = []
  const vus = new Set<string>()
  let phase = ''
  for (const ligne of texte.split(/\r?\n/)) {
    const e = enteteRe.exec(ligne)
    if (e) { phase = e[2]!.trim(); continue }
    if (titreSansIdRe.test(ligne)) { phase = ''; continue }
    const m = tacheRe.exec(ligne)
    if (!m) continue
    // Marque inconnue ou vide : par prudence la tâche reste ouverte (rien n'est coché en silence).
    const statut = STATUTS[m[1]!] ?? 'a faire'
    const [premier, titre, ...champs] = m[2]!.split('|').map(s => s.trim())
    if (!premier || !titre || /\s/.test(premier) || vus.has(premier)) continue
    const t: Tache = { id: premier, phase, titre, statut }
    for (const c of champs) {
      const i = c.indexOf(':')
      if (i <= 0) continue
      const cle = c.slice(0, i).trim(), val = c.slice(i + 1).trim()
      if (val === '') continue
      if (cle === 'fichier') t.fichier = val
      else if (cle === 'auteur') t.auteur = val
      else if (cle === 'pole') t.pole = val
    }
    vus.add(premier)
    taches.push(t)
  }
  return taches
}

/** Réécrit le plan : phases dans l'ordre de `phases` (titres compris), puis les phases inconnues, tâches dans l'ordre reçu. */
export function serializePlan(t: Tache[], phases: PhaseDef[]): string {
  const blocs = phases.map(ph => ({ id: ph.id, titre: ph.titre, taches: t.filter(x => x.phase === ph.id) }))
  const connues = new Set(phases.map(ph => ph.id))
  const reste: string[] = []
  for (const x of t) if (!connues.has(x.phase) && !reste.includes(x.phase)) reste.push(x.phase)
  for (const id of reste.filter(x => x !== '')) blocs.push({ id, titre: id, taches: t.filter(x => x.phase === id) })
  if (t.some(x => x.phase === '')) blocs.push({ id: '', titre: SANS_PHASE, taches: t.filter(x => x.phase === '') })
  return ecrire(blocs)
}

const ouverte = (t: Tache): boolean => t.statut === 'a faire' || t.statut === 'en cours'

/** `total` : toutes les tâches de la phase ; `faites` : les terminées ; `ouvertes` : `a faire` et `en cours` (reportées et abandonnées exclues). */
export function avancementPhase(taches: Tache[], phase: string): { total: number; faites: number; ouvertes: Tache[] } {
  const ici = phase === '' ? [] : taches.filter(t => t.phase === phase)
  return { total: ici.length, faites: ici.filter(t => t.statut === 'termine').length, ouvertes: ici.filter(ouverte) }
}

/** La porte n'est possible que sans tâche ouverte : sinon on rend la liste de celles à terminer, reporter ou abandonner. */
/** `total` permet de distinguer une phase vide ou inconnue (`total === 0`, ok) d'une phase terminée. */
export function portePossible(taches: Tache[], phase: string): { ok: boolean; ouvertes: Tache[]; total: number } {
  const { ouvertes, total } = avancementPhase(taches, phase)
  return { ok: ouvertes.length === 0, ouvertes, total }
}

/**
 * Copie de conflit Drive/Git/Dropbox, à ne pas lire. Sur le nom de fichier (dossiers et extension retirés), vrai si :
 * - il finit par ` (<nombre>)`, ou ` (conflit…)`, ` (conflict…)`, ` (copie…)`, ` (copy…)` (sans tenir compte des majuscules), ou
 * - il finit par ` - Copy` / ` - Copie`, éventuellement suivi de ` (<nombre>)`, ou
 * - il commence par `Copy of ` / `Copie de `.
 */
export function estCopieDeConflit(nom: string): boolean {
  const fichier = nom.slice(Math.max(nom.lastIndexOf('/'), nom.lastIndexOf('\\')) + 1)
  const point = fichier.lastIndexOf('.')
  const base = point > 0 ? fichier.slice(0, point) : fichier
  return /\s\((\d+|conflit[^)]*|conflict[^)]*|copie[^)]*|copy[^)]*)\)$/i.test(base)
    || /\s-\s(copy|copie)(\s\(\d+\))?$/i.test(base)
    || /^(copy of|copie de)\s/i.test(base)
}
