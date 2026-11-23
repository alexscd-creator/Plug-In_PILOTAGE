import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseChantier, validerChantier } from '../hooks/model/chantier.ts'
import { chantierDepuisNote, lancerNote } from '../hooks/model/lancer-note.ts'
import type { NoteLue } from '../hooks/model/lecture.ts'
import { parseNote, serializeNote } from '../hooks/model/notes.ts'
import type { Note } from '../hooks/model/notes.ts'

const R = 'C:/Projet'
const MAINTENANT = '2026-11-23T10:00:00.000Z'
const note = (extra: Partial<Note> = {}): Note => ({
  id: '2026-11-22-export-pdf', type: 'idee', titre: 'Export PDF du plan', date: '2026-11-22T09:00:00Z', auteur: 'Léa',
  phase: '', chantier: '', lance: '', texte: 'Un bouton qui exporte le plan en PDF.', ...extra,
})
const lue = (n: Note, membre = 'lea'): NoteLue => ({ ...n, chemin: `.pilotage/equipe/${membre}/${n.type === 'idee' ? 'idees' : 'feedback'}/${n.id}.md` })

/** Disque en mémoire : les dossiers se déduisent des fichiers ; `panne` fait échouer l'écriture d'un chemin donné. */
function disque(fichiers: Record<string, string>, panne = '') {
  const f = { ...fichiers }
  const ecrits: string[] = []
  return {
    f, ecrits,
    fs: {
      read: async (p: string) => { if (!(p in f)) throw new Error('absent'); return f[p]! },
      write: async (p: string, t: string) => { if (p === panne) throw new Error('disque plein'); ecrits.push(p); f[p] = t },
      list: async (p: string) => {
        const pre = p.replace(/\/$/, '') + '/'
        const noms = new Set(Object.keys(f).filter(k => k.startsWith(pre)).map(k => k.slice(pre.length).split('/')[0]!))
        if (noms.size === 0) throw new Error('absent')
        return [...noms]
      },
    },
  }
}
const base = (n: Note = note(), extra: Record<string, string> = {}) => ({
  [`${R}/.pilotage/equipe/lea/idees/${n.id}.md`]: serializeNote(n),
  [`${R}/.pilotage/equipe/sam/idees/x.md`]: 'x',
  ...extra,
})

test('chantierDepuisNote : id tiré du titre, état attente, une tâche = le titre, passation = le texte, fiche valide', () => {
  const c = chantierDepuisNote(note(), [], 'dev', MAINTENANT)
  assert.equal(c.id, 'export-pdf-du-plan')
  assert.equal(c.titre, 'Export PDF du plan')
  assert.equal(c.etat, 'attente')
  assert.equal(c.phase, 'dev')
  assert.equal(c.pole, '')
  assert.deepEqual(c.taches, [{ titre: 'Export PDF du plan', statut: 'a faire' }])
  assert.equal(c.passation, 'Un bouton qui exporte le plan en PDF.')
  assert.equal(c.cree, MAINTENANT)
  assert.deepEqual(validerChantier(c), [])
})

test('chantierDepuisNote : identifiant pris → -2, -3 ; long → 60 caractères au plus ; titre vide de lettres → « chantier »', () => {
  assert.equal(chantierDepuisNote(note(), ['export-pdf-du-plan'], '', MAINTENANT).id, 'export-pdf-du-plan-2')
  assert.equal(chantierDepuisNote(note(), ['export-pdf-du-plan', 'export-pdf-du-plan-2'], '', MAINTENANT).id, 'export-pdf-du-plan-3')
  const long = chantierDepuisNote(note({ titre: 'mot '.repeat(40) }), [], '', MAINTENANT).id
  assert.ok(long.length <= 60 && /^[a-z0-9-]+$/.test(long) && !long.endsWith('-'))
  const pris = chantierDepuisNote(note({ titre: 'mot '.repeat(40) }), [long], '', MAINTENANT).id
  assert.ok(pris.length <= 60 && pris.endsWith('-2'), pris)
  assert.equal(chantierDepuisNote(note({ titre: '???' }), [], '', MAINTENANT).id, 'chantier')
  assert.equal(chantierDepuisNote(note({ texte: 'x'.repeat(5000) }), [], '', MAINTENANT).passation.length, 4000)
})

test('lancerNote : écrit la fiche chez le membre, puis la note avec « lance » ; jamais d’autre fichier', async () => {
  const d = disque(base())
  const r = await lancerNote(d.fs, R, 'Léa', lue(note()), 'dev', MAINTENANT)
  assert.deepEqual(r, { ok: true, id: 'export-pdf-du-plan', titre: 'Export PDF du plan' })
  const fiche = `${R}/.pilotage/equipe/lea/chantiers/export-pdf-du-plan.md`
  assert.deepEqual(d.ecrits, [fiche, `${R}/.pilotage/equipe/lea/idees/2026-11-22-export-pdf.md`])
  const c = parseChantier(d.f[fiche]!, 'Léa')
  assert.ok(c.ok && c.chantier.etat === 'attente' && c.chantier.phase === 'dev')
  const n = parseNote(d.f[`${R}/.pilotage/equipe/lea/idees/2026-11-22-export-pdf.md`]!, 'Léa')
  assert.ok(n.ok && n.note.lance === 'export-pdf-du-plan' && n.note.texte === note().texte)
})

test('lancerNote : fiche déjà là (chantier ou archive) → suffixe, jamais d’écrasement', async () => {
  const d = disque(base(note(), {
    [`${R}/.pilotage/equipe/lea/chantiers/export-pdf-du-plan.md`]: 'existante',
    [`${R}/.pilotage/equipe/lea/archive/export-pdf-du-plan-2.md`]: 'archivée',
  }))
  const r = await lancerNote(d.fs, R, 'Léa', lue(note()), '', MAINTENANT)
  assert.ok(r.ok && r.id === 'export-pdf-du-plan-3')
  assert.equal(d.f[`${R}/.pilotage/equipe/lea/chantiers/export-pdf-du-plan.md`], 'existante')
})

test('lancerNote : note d’un autre membre, prénom inconnu, note déjà lancée → refus, rien n’est écrit', async () => {
  const d = disque(base())
  for (const [moi, n] of [['Sam', lue(note())], ['', lue(note())], ['Léa', lue(note(), 'sam')], ['Léa', lue(note({ lance: 'deja' }))]] as const) {
    const r = await lancerNote(d.fs, R, moi, n, '', MAINTENANT)
    assert.equal(r.ok, false)
  }
  assert.deepEqual(d.ecrits, [])
})

test('lancerNote : la fiche s’écrit mais la note non → l’erreur le dit, la fiche reste ; un second appui ne l’écrase pas', async () => {
  const chemin = `${R}/.pilotage/equipe/lea/idees/2026-11-22-export-pdf.md`
  const d = disque(base(), chemin)
  const r = await lancerNote(d.fs, R, 'Léa', lue(note()), '', MAINTENANT)
  assert.equal(r.ok, false)
  if (!r.ok) assert.match(r.erreur, /export-pdf-du-plan/)
  assert.ok(`${R}/.pilotage/equipe/lea/chantiers/export-pdf-du-plan.md` in d.f)
  const r2 = await lancerNote(d.fs, R, 'Léa', lue(note()), '', MAINTENANT)
  assert.equal(r2.ok, false)
  assert.ok(`${R}/.pilotage/equipe/lea/chantiers/export-pdf-du-plan-2.md` in d.f)
})

test('lancerNote : note changée sur le disque (illisible) → refus avant toute écriture', async () => {
  const d = disque(base(note(), { [`${R}/.pilotage/equipe/lea/idees/2026-11-22-export-pdf.md`]: 'cassée' }))
  const r = await lancerNote(d.fs, R, 'Léa', lue(note()), '', MAINTENANT)
  assert.equal(r.ok, false)
  assert.deepEqual(d.ecrits, [])
})

test('relecture : casse différente sur le disque → suffixe ; dossier présent mais illisible → refus ; dossier de note inattendu → refus', async () => {
  const d = disque(base(note(), { [`${R}/.pilotage/equipe/lea/chantiers/Export-PDF-du-plan.md`]: 'à la main' }))
  const r = await lancerNote(d.fs, R, 'Léa', lue(note()), '', MAINTENANT)
  assert.ok(r.ok && r.id === 'export-pdf-du-plan-2')

  const e = disque(base(note(), { [`${R}/.pilotage/equipe/lea/chantiers/autre.md`]: 'x' }))
  const fsPanne = {
    ...e.fs,
    list: async (p: string) => { if (p.endsWith('/chantiers')) throw new Error('accès refusé'); return e.fs.list(p) },
    exists: async (p: string) => Object.keys(e.f).some(k => k === p || k.startsWith(p + '/')),
  }
  assert.equal((await lancerNote(fsPanne, R, 'Léa', lue(note()), '', MAINTENANT)).ok, false)
  assert.deepEqual(e.ecrits, [])

  const g = disque(base())
  const ailleurs: NoteLue = { ...lue(note()), chemin: '.pilotage/equipe/lea/chantiers/2026-11-22-export-pdf.md' }
  assert.equal((await lancerNote(g.fs, R, 'Léa', ailleurs, '', MAINTENANT)).ok, false)
  assert.deepEqual(g.ecrits, [])
})

test('exists : une fiche que la liste ne montre pas mais qui existe n’est jamais écrasée', async () => {
  const d = disque(base())
  const fs = { ...d.fs, exists: async (p: string) => p.endsWith('/chantiers/export-pdf-du-plan.md') }
  assert.equal((await lancerNote(fs, R, 'Léa', lue(note()), '', MAINTENANT)).ok, false)
  assert.deepEqual(d.ecrits, [])
})
