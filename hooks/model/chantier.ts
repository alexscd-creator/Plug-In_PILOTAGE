// Fiche de chantier (`equipe/<prénom>/chantiers/<id>.md`) : logique pure, sans fs ni process (les hooks tournent hors Node).
// Format, écrit et relu tel quel (les membres peuvent l'éditer à la main) :
//   ---
//   id: <identifiant : a-z, 0-9, tirets, 60 caractères au plus>
//   titre: ... | pole: ... | phase: ... | etat: ... | session: ... | cree: <ISO UTC> | maj: <ISO UTC> | archive: oui|non   (un champ par ligne)
//   ---
//   ## taches      - [ ] titre        (mêmes marques que le plan : [ ] [~] [x] [>] [-])
//   ## agents      - <id> | <etat> | <quoi>
//   ## fichiers    - chemin/relatif
//   ## passation   (ou « ## passation finale » : tout titre dont le premier mot est passation) texte libre, jusqu'à la fin du fichier (une ligne `## ...` ou `---` y est du texte, jamais une section)
// L'auteur n'est PAS dans le fichier : c'est le membre dont le dossier contient la fiche (on n'écrit que chez soi).
// Le texte est une DONNÉE : tout ce qui est écrit est assaini (une ligne, sans `|`), tout ce qui est relu est validé.
import { texteNet as ligneSure } from './plan.ts'
import type { Statut } from './plan.ts'
import { retirerInvisibles } from './texte-sur.ts'

export type EtatChantier = 'en-travail' | 'attente' | 'arrete' | 'pret' | 'bloque' | 'termine'
export type Chantier = {
  id: string
  titre: string
  pole: string
  phase: string
  etat: EtatChantier
  /** Nom de la sous-session qui porte le chantier. */
  session: string
  agents: { id: string; etat: EtatChantier; quoi: string }[]
  taches: { titre: string; statut: Statut }[]
  fichiers: string[]
  /** Dates ISO UTC. */
  cree: string
  maj: string
  passation: string
  archive: boolean
  auteur: string
}
/** `avertissements` : anomalies sans gravité (chemins de fichier écartés) ; la fiche reste lue. */
export type ResultatChantier = { ok: true; chantier: Chantier; avertissements: string[] } | { ok: false; erreurs: string[] }

export const ETATS_CHANTIER: readonly EtatChantier[] = ['en-travail', 'attente', 'arrete', 'pret', 'bloque', 'termine']
/** Au-delà, un chantier « en travail » ou « en attente » sans nouvelle est affiché `pret` (la session est sans doute finie). */
export const DELAI_INACTIF_MS = 15 * 60_000
export const MAX_PASSATION = 4000
const MAX_ID = 60
const MAX_TEXTE = 200
const MAX_FICHIER = 260

const MARQUES: Record<Statut, string> = { 'a faire': ' ', 'en cours': '~', termine: 'x', reporte: '>', abandonne: '-' }
const STATUTS: Record<string, Statut> = { ' ': 'a faire', '~': 'en cours', x: 'termine', X: 'termine', '>': 'reporte', '-': 'abandonne' }
const ID_RE = /^[a-z0-9-]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/
const tacheRe = /^\s*[-*]\s+\[(.?)\]\s+(.*)$/
const puceRe = /^\s*[-*]\s+(.*)$/

// Même approche que plan.ts : une seule ligne, « | » remplacé, pour ne créer ni ligne ni champ de plus.
const texteNet = (s: unknown, max = MAX_TEXTE): string => retirerInvisibles(ligneSure(String(s ?? ''))).slice(0, max).trim()
/** Identifiant sûr : minuscules sans accent, a-z 0-9 et tirets, jamais plus de 60 caractères. */
const idNet = (s: unknown): string =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_ID).replace(/-+$/, '')
const estEtat = (v: string): v is EtatChantier => (ETATS_CHANTIER as readonly string[]).includes(v)
/** Chemin relatif au projet : ni absolu, ni lecteur, ni `..`, ni antislash. */
const cheminSur = (f: string): boolean =>
  f !== '' && f.length <= MAX_FICHIER && !/^[/\\]|^[a-zA-Z]:|[\\\0:|]|[\r\n]/.test(f) && !f.split('/').includes('..')
const dateValide = (d: string): boolean => DATE_RE.test(d) && !Number.isNaN(Date.parse(d))

/** Relit une fiche. Ne lève jamais : toute anomalie est une erreur en français. */
export function parseChantier(texte: string, auteur: string): ResultatChantier {
  try {
    if (typeof texte !== 'string') return { ok: false, erreurs: ['La fiche n’est pas un texte.'] }
    if (texte.trim() === '') return { ok: false, erreurs: ['La fiche est vide.'] }
    const lignes = texte.replace(/^﻿/, '').split(/\r?\n/)
    let i = 0
    while (i < lignes.length && lignes[i]!.trim() === '') i++
    if (lignes[i]?.trim() !== '---') return { ok: false, erreurs: ['La fiche doit commencer par un en-tête entre deux lignes « --- ».'] }
    i++
    const cles: Record<string, string> = {}
    let ferme = false
    for (; i < lignes.length; i++) {
      const l = retirerInvisibles(lignes[i]!)
      if (l.trim() === '---') { ferme = true; i++; break }
      const p = l.indexOf(':')
      if (p <= 0) continue
      const cle = l.slice(0, p).trim().toLowerCase()
      if (!(cle in cles)) cles[cle] = l.slice(p + 1).trim()
    }
    if (!ferme) return { ok: false, erreurs: ['L’en-tête de la fiche n’est pas refermé par une ligne « --- ».'] }

    const erreurs: string[] = []
    const id = cles.id ?? ''
    if (id === '') erreurs.push('Il manque l’identifiant du chantier (id).')
    else if (!ID_RE.test(id) || id.length > MAX_ID) erreurs.push(`L’identifiant (id) « ${id.slice(0, 40)} » est invalide : lettres minuscules, chiffres et tirets, ${MAX_ID} caractères au plus.`)
    const titre = cles.titre ?? ''
    if (titre === '') erreurs.push('Il manque le titre du chantier (titre).')
    else if (titre.length > MAX_TEXTE) erreurs.push(`Le titre est trop long (${MAX_TEXTE} caractères au plus).`)
    const idOptionnel = (cle: string): string => {
      const v = cles[cle] ?? ''
      if (v !== '' && (!ID_RE.test(v) || v.length > MAX_ID)) erreurs.push(`Le champ « ${cle} » (« ${v.slice(0, 40)} ») est invalide : lettres minuscules, chiffres et tirets.`)
      return v
    }
    const pole = idOptionnel('pole'), phase = idOptionnel('phase')
    const session = cles.session ?? ''
    if (session.length > MAX_TEXTE) erreurs.push(`Le nom de session est trop long (${MAX_TEXTE} caractères au plus).`)
    const etatBrut = cles.etat ?? ''
    let etat: EtatChantier = 'arrete'
    if (!estEtat(etatBrut)) erreurs.push(etatBrut === '' ? 'Il manque l’état du chantier (etat).' : `L’état « ${etatBrut.slice(0, 40)} » est inconnu (attendus : ${ETATS_CHANTIER.join(', ')}).`)
    else etat = etatBrut
    const date = (cle: 'cree' | 'maj'): string => {
      const v = cles[cle] ?? ''
      if (!dateValide(v)) erreurs.push(`La date « ${cle} » est absente ou invalide (attendu : date ISO UTC, ex. 2026-11-21T10:00:00Z).`)
      return v
    }
    const cree = date('cree'), maj = date('maj')
    const archive = /^(oui|true)$/i.test(cles.archive ?? '')

    const taches: Chantier['taches'] = []
    const agents: Chantier['agents'] = []
    const fichiers: string[] = []
    const passation: string[] = []
    const avertissements: string[] = []
    let section = ''
    for (; i < lignes.length; i++) {
      const l = retirerInvisibles(lignes[i]!)
      if (section === 'passation') { passation.push(l); continue }
      const s = /^\s{0,3}##\s+(\S+)(\s.*)?$/.exec(l)
      if (s) { section = s[1]!.toLowerCase() === 'tâches' ? 'taches' : s[1]!.toLowerCase(); continue }
      if (section === 'taches') {
        const m = tacheRe.exec(l)
        const t = m ? m[2]!.trim() : ''
        if (m && t !== '') taches.push({ titre: t.slice(0, MAX_TEXTE), statut: STATUTS[m[1]!] ?? 'a faire' })
      } else if (section === 'agents') {
        const m = puceRe.exec(l)
        if (!m) continue
        const [aid = '', aetat = '', ...reste] = m[1]!.split('|').map(x => x.trim())
        if (!ID_RE.test(aid) || aid.length > MAX_ID) { erreurs.push(`L’agent « ${aid.slice(0, 40)} » a un identifiant invalide.`); continue }
        if (!estEtat(aetat)) { erreurs.push(`L’état « ${aetat.slice(0, 40)} » de l’agent ${aid} est inconnu (attendus : ${ETATS_CHANTIER.join(', ')}).`); continue }
        agents.push({ id: aid, etat: aetat, quoi: reste.join(' / ').slice(0, MAX_TEXTE) })
      } else if (section === 'fichiers') {
        const m = puceRe.exec(l)
        const f = m ? m[1]!.trim() : ''
        if (!m || f === '') continue
        if (cheminSur(f)) fichiers.push(f)
        else avertissements.push(`Le fichier « ${f.slice(0, 60)} » n’est pas un chemin relatif au projet (ni « .. », ni chemin absolu) : il est écarté de la fiche.`)
      }
    }
    if (erreurs.length) return { ok: false, erreurs }
    return {
      ok: true,
      avertissements,
      chantier: {
        id, titre, pole, phase, etat, session, agents, taches, fichiers, cree, maj, archive, auteur,
        passation: passation.join('\n').trim().slice(0, MAX_PASSATION).trim(),
      },
    }
  } catch {
    return { ok: false, erreurs: ['La fiche n’a pas pu être lue.'] }
  }
}

/** Écrit la fiche, assainie : une ligne par valeur, sans `|`, id sûrs, fichiers relatifs seulement ; passation plafonnée. */
export function serializeChantier(c: Chantier): string {
  const marque = (s: Statut): string => MARQUES[s] ?? ' '
  const etat = (e: string): string => (estEtat(e) ? e : 'arrete')
  const sortie: string[] = [
    '---',
    `id: ${idNet(c.id)}`,
    `titre: ${texteNet(c.titre)}`,
    `pole: ${idNet(c.pole)}`,
    `phase: ${idNet(c.phase)}`,
    `etat: ${etat(c.etat)}`,
    `session: ${texteNet(c.session)}`,
    `cree: ${texteNet(c.cree)}`,
    `maj: ${texteNet(c.maj)}`,
    `archive: ${c.archive ? 'oui' : 'non'}`,
    '---',
    '## taches',
  ]
  for (const t of c.taches) {
    const titre = texteNet(t.titre)
    if (titre !== '') sortie.push(`- [${marque(t.statut)}] ${titre}`)
  }
  sortie.push('', '## agents')
  for (const a of c.agents) {
    const id = idNet(a.id)
    if (id !== '') sortie.push(`- ${id} | ${etat(a.etat)} | ${texteNet(a.quoi)}`.trimEnd())
  }
  sortie.push('', '## fichiers')
  for (const f of c.fichiers) {
    const n = texteNet(f, MAX_FICHIER).replaceAll(String.fromCharCode(92), '/')
    if (cheminSur(n)) sortie.push(`- ${n}`)
  }
  const passation = String(c.passation ?? '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_PASSATION).trim()
  sortie.push('', '## passation', passation)
  return sortie.join('\n') + '\n'
}

/** `total` : les tâches sauf les abandonnées ; `faites` : les terminées ; `pourcent` : arrondi, 0 sans tâche. */
export function progressionChantier(c: Chantier): { total: number; faites: number; pourcent: number } {
  const comptees = c.taches.filter(t => t.statut !== 'abandonne')
  const faites = comptees.filter(t => t.statut === 'termine').length
  const total = comptees.length
  return { total, faites, pourcent: total === 0 ? 0 : Math.round((faites * 100) / total) }
}

/**
 * État montré à l'écran. Règle : un chantier `en-travail` ou `attente` dont `maj` date de PLUS de 15 minutes
 * (`maintenant` en millisecondes) est affiché `pret` — sa session ne donne plus signe de vie. Jamais pour un chantier
 * archivé ou `termine`, ni pour les autres états ; date illisible, future ou `maintenant` invalide : l'état écrit.
 */
export function etatAffiche(c: Chantier, maintenant: number): EtatChantier {
  if (c.archive || c.etat === 'termine') return c.etat
  if (c.etat !== 'en-travail' && c.etat !== 'attente') return c.etat
  const maj = Date.parse(c.maj)
  if (Number.isNaN(maj) || !Number.isFinite(maintenant)) return c.etat
  return maintenant - maj > DELAI_INACTIF_MS ? 'pret' : c.etat
}

/** Erreurs qui empêcheraient `parseChantier` de relire la fiche telle qu'elle serait écrite (vide = écriture possible). */
export function validerChantier(c: Chantier): string[] {
  const e: string[] = []
  const id = String(c?.id ?? '')
  if (!ID_RE.test(id) || id.length > MAX_ID) e.push(`L’identifiant (id) « ${id.slice(0, 40)} » est invalide : lettres minuscules, chiffres et tirets, ${MAX_ID} caractères au plus.`)
  if (texteNet(c?.titre) === '') e.push('Le titre du chantier est vide.')
  for (const k of ['cree', 'maj'] as const) {
    const v = String(c?.[k] ?? '')
    if (!dateStricte(v)) e.push(`La date « ${k} » est absente ou invalide (attendu : date ISO UTC existante, ex. 2026-11-21T10:00:00Z).`)
  }
  if (!estEtat(String(c?.etat))) e.push(`L’état « ${String(c?.etat).slice(0, 40)} » est inconnu (attendus : ${ETATS_CHANTIER.join(', ')}).`)
  for (const a of c?.agents ?? []) {
    if (!estEtat(String(a?.etat))) e.push(`L’état « ${String(a?.etat).slice(0, 40)} » de l’agent ${String(a?.id).slice(0, 40)} est inconnu.`)
  }
  if (String(c?.session ?? '').length > MAX_TEXTE) e.push(`Le nom de session (session) est trop long (${MAX_TEXTE} caractères au plus).`)
  return e
}

/** Date ISO UTC réelle : `2026-02-31` (que `Date` reporterait au mois suivant) est refusée. */
function dateStricte(v: string): boolean {
  if (!dateValide(v)) return false
  const [jour] = v.split('T')
  return new Date(Date.parse(v)).toISOString().slice(0, 10) === jour
}
