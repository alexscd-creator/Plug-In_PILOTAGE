// Notes d'idée et de retour (`equipe/<prénom>/idees/<id>.md`, `equipe/<prénom>/feedback/<id>.md`) : logique pure, sans fs ni process.
// Format, écrit et relu tel quel (un membre peut l'éditer à la main) :
//   ---
//   id: <date>-<titre en tirets> | type: idee|feedback | titre: ... | date: <ISO UTC> | auteur: <prénom> | phase: <id> | chantier: <id>   (un champ par ligne ; phase et chantier facultatifs)
//   ---
//   texte libre, jusqu'à la fin du fichier (une ligne `---` ou `## ...` y est du texte, jamais un champ ni une section)
// L'auteur qui fait foi est le membre dont le dossier contient la note (on n'écrit que chez soi) ; le champ `auteur` ne sert qu'à
// reconnaître « une note que ce membre a créée ». Tout ce qui est écrit est assaini, tout ce qui est relu est validé : une DONNÉE.
import { texteNet as ligneSure } from './plan.ts'
import { memeMembre } from './projet.ts'

export type TypeNote = 'idee' | 'feedback'
export type Note = {
  id: string
  type: TypeNote
  titre: string
  /** Date ISO UTC de la création. */
  date: string
  auteur: string
  /** Phase ou chantier liés (identifiants) ; vide : aucun lien. */
  phase: string
  chantier: string
  texte: string
}
/** `avertissements` : anomalies sans gravité ; `auteurDeclare` : l'auteur écrit dans le fichier (jamais celui qui s'affiche). */
export type ResultatNote = { ok: true; note: Note; avertissements: string[]; auteurDeclare: string } | { ok: false; erreurs: string[] }

export const TYPES_NOTE: readonly TypeNote[] = ['idee', 'feedback']
/** Dossier de chaque type, sous `equipe/<prénom>/`. */
export const DOSSIER_NOTE: Record<TypeNote, string> = { idee: 'idees', feedback: 'feedback' }
export const MAX_TEXTE_NOTE = 4000
export const MAX_TITRE_NOTE = 200
/** Au-delà, une note lue est écartée. */
export const MAX_FICHIER_NOTE = 64 * 1024
const MAX_ID = 60
/** Place laissée aux suffixes de collision (`-2` … `-99`) : l'identifiant de base ne dépasse jamais 57 caractères. */
const MAX_BASE = 57

const ID_RE = /^[a-z0-9-]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/
const CONTROLES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

const texteNet = (s: unknown, max = MAX_TITRE_NOTE): string => ligneSure(String(s ?? '')).replace(CONTROLES, ' ').slice(0, max).trim()
const idNet = (s: unknown): string =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
/** Corps de la note : retours à la ligne unifiés, caractères de contrôle retirés, plafonné. */
const corpsNet = (s: unknown): string => String(s ?? '').replace(/\r\n?/g, '\n').replace(CONTROLES, '').trim().slice(0, MAX_TEXTE_NOTE).trim()
const estType = (v: string): v is TypeNote => (TYPES_NOTE as readonly string[]).includes(v)
const dateValide = (d: string): boolean => DATE_RE.test(d) && !Number.isNaN(Date.parse(d))
/** Date ISO UTC réelle : `2026-02-31` (que `Date` reporterait au mois suivant) est refusée. */
const dateStricte = (v: string): boolean => dateValide(v) && new Date(Date.parse(v)).toISOString().slice(0, 10) === v.split('T')[0]

/** Identifiant de base d'une note : jour de la date et titre en tirets (`2026-11-21-menu-plus-clair`), 57 caractères au plus ; « note » si le titre ne donne rien. */
export function idNote(date: string, titre: string): string {
  const jour = /^\d{4}-\d{2}-\d{2}/.exec(String(date))?.[0] ?? '0000-00-00'
  const slug = idNet(titre).slice(0, MAX_BASE - jour.length - 1).replace(/-+$/, '')
  return `${jour}-${slug === '' ? 'note' : slug}`
}

/** Relit une note. Ne lève jamais : toute anomalie est une erreur en français. `auteur` : le membre dont le dossier la contient. */
export function parseNote(texte: string, auteur: string): ResultatNote {
  try {
    if (typeof texte !== 'string') return { ok: false, erreurs: ['La note n’est pas un texte.'] }
    if (texte.trim() === '') return { ok: false, erreurs: ['La note est vide.'] }
    const lignes = texte.replace(/^﻿/, '').split(/\r?\n/)
    let i = 0
    while (i < lignes.length && lignes[i]!.trim() === '') i++
    if (lignes[i]?.trim() !== '---') return { ok: false, erreurs: ['La note doit commencer par un en-tête entre deux lignes « --- ».'] }
    i++
    const cles: Record<string, string> = {}
    let ferme = false
    for (; i < lignes.length; i++) {
      const l = lignes[i]!
      if (l.trim() === '---') { ferme = true; i++; break }
      const p = l.indexOf(':')
      if (p <= 0) continue
      const cle = l.slice(0, p).trim().toLowerCase()
      if (!(cle in cles)) cles[cle] = l.slice(p + 1).trim()
    }
    if (!ferme) return { ok: false, erreurs: ['L’en-tête de la note n’est pas refermé par une ligne « --- ».'] }

    const erreurs: string[] = []
    const id = cles.id ?? ''
    if (id === '') erreurs.push('Il manque l’identifiant de la note (id).')
    else if (!ID_RE.test(id) || id.length > MAX_ID) erreurs.push(`L’identifiant (id) « ${id.slice(0, 40)} » est invalide : lettres minuscules, chiffres et tirets, ${MAX_ID} caractères au plus.`)
    const typeBrut = cles.type ?? ''
    let type: TypeNote = 'idee'
    if (!estType(typeBrut)) erreurs.push(typeBrut === '' ? 'Il manque le type de la note (type).' : `Le type « ${typeBrut.slice(0, 40)} » est inconnu (attendus : ${TYPES_NOTE.join(', ')}).`)
    else type = typeBrut
    const titre = cles.titre ?? ''
    if (titre === '') erreurs.push('Il manque le titre de la note (titre).')
    else if (titre.length > MAX_TITRE_NOTE) erreurs.push(`Le titre est trop long (${MAX_TITRE_NOTE} caractères au plus).`)
    const date = cles.date ?? ''
    if (!dateStricte(date)) erreurs.push('La date (date) est absente ou invalide (attendu : date ISO UTC, ex. 2026-11-21T10:00:00Z).')
    const lien = (cle: 'phase' | 'chantier'): string => {
      const v = cles[cle] ?? ''
      if (v !== '' && (!ID_RE.test(v) || v.length > MAX_ID)) erreurs.push(`Le champ « ${cle} » (« ${v.slice(0, 40)} ») est invalide : lettres minuscules, chiffres et tirets.`)
      return v
    }
    const phase = lien('phase'), chantier = lien('chantier')
    if (erreurs.length) return { ok: false, erreurs }

    const auteurDeclare = (cles.auteur ?? '').slice(0, MAX_TITRE_NOTE)
    const avertissements: string[] = []
    if (auteurDeclare !== '' && !memeMembre(auteurDeclare, auteur))
      avertissements.push(`L’auteur écrit dans la note (« ${auteurDeclare.slice(0, 40)} ») n’est pas le membre du dossier : c’est le dossier qui fait foi.`)
    return { ok: true, avertissements, auteurDeclare, note: { id, type, titre, date, auteur, phase, chantier, texte: corpsNet(lignes.slice(i).join('\n')) } }
  } catch {
    return { ok: false, erreurs: ['La note n’a pas pu être lue.'] }
  }
}

/** Écrit la note, assainie : une ligne par valeur, sans `|`, identifiants sûrs ; texte plafonné à 4000 caractères. */
export function serializeNote(n: Note): string {
  const sortie = [
    '---',
    `id: ${idNet(n.id)}`,
    `type: ${estType(String(n.type)) ? n.type : 'idee'}`,
    `titre: ${texteNet(n.titre)}`,
    `date: ${texteNet(n.date)}`,
    `auteur: ${texteNet(n.auteur)}`,
  ]
  if (idNet(n.phase) !== '') sortie.push(`phase: ${idNet(n.phase).slice(0, MAX_ID)}`)
  if (idNet(n.chantier) !== '') sortie.push(`chantier: ${idNet(n.chantier).slice(0, MAX_ID)}`)
  sortie.push('---', corpsNet(n.texte))
  return sortie.join('\n') + '\n'
}

/** Erreurs qui empêcheraient `parseNote` de relire la note telle qu'elle serait écrite (vide = écriture possible). */
export function validerNote(n: Note): string[] {
  const e: string[] = []
  const id = String(n?.id ?? '')
  if (!ID_RE.test(id) || id.length > MAX_ID) e.push(`L’identifiant (id) « ${id.slice(0, 40)} » est invalide : lettres minuscules, chiffres et tirets, ${MAX_ID} caractères au plus.`)
  if (!estType(String(n?.type))) e.push(`Le type « ${String(n?.type).slice(0, 40)} » est inconnu (attendus : ${TYPES_NOTE.join(', ')}).`)
  if (texteNet(n?.titre) === '') e.push('Le titre de la note est vide.')
  if (!dateStricte(String(n?.date ?? ''))) e.push('La date est absente ou invalide (attendu : date ISO UTC existante, ex. 2026-11-21T10:00:00Z).')
  for (const k of ['phase', 'chantier'] as const) {
    const v = String(n?.[k] ?? '')
    if (v !== '' && (!ID_RE.test(v) || v.length > MAX_ID)) e.push(`Le champ « ${k} » (« ${v.slice(0, 40)} ») est invalide : lettres minuscules, chiffres et tirets, ${MAX_ID} caractères au plus.`)
  }
  if (String(n?.texte ?? '').length > MAX_TEXTE_NOTE) e.push(`Le texte dépasse ${MAX_TEXTE_NOTE} caractères.`)
  return e
}
