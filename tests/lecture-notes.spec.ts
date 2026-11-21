import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { FsLike } from '../hooks/model/activation.ts'
import { separerAvis } from '../hooks/model/chantiers.ts'
import { lireNotes } from '../hooks/model/lecture.ts'
import { serializeNote } from '../hooks/model/notes.ts'
import type { Note } from '../hooks/model/notes.ts'

const R = 'C:/Projet'
const E = `${R}/.pilotage/equipe`
const sl = (p: string) => p.replaceAll(String.fromCharCode(92), '/')

function fsDe(fichiers: Record<string, string>, panne: string[] = []): FsLike {
  return {
    read: async p => {
      const t = fichiers[sl(p)]
      if (t === undefined || panne.includes(sl(p))) throw new Error('illisible')
      return t
    },
    list: async p => {
      const c = sl(p).replace(/\/$/, '')
      if (panne.includes(c)) throw new Error('liste en panne')
      const noms = new Set<string>()
      for (const f of Object.keys(fichiers)) if (f.startsWith(c + '/')) noms.add(f.slice(c.length + 1).split('/')[0]!)
      if (noms.size === 0) throw new Error('dossier absent')
      return [...noms]
    },
  }
}
const note = (id: string, extra: Partial<Note> = {}): Note => ({
  id, type: 'idee', titre: `Note ${id}`, date: '2026-11-21T10:00:00Z', auteur: 'Léa', phase: '', chantier: '', texte: 'Texte.', ...extra,
})
const f = (membre: string, sous: string, n: Note) => ({ [`${E}/${membre}/${sous}/${n.id}.md`]: serializeNote(n) })

test('lit les idées et les retours de tous les membres, auteur = prénom du projet, du plus récent au plus ancien', async () => {
  const fs = fsDe({
    ...f('lea', 'idees', note('2026-11-20-a', { date: '2026-11-20T09:00:00Z' })),
    ...f('lea', 'feedback', note('2026-11-21-b', { type: 'feedback', date: '2026-11-21T11:00:00Z' })),
    ...f('jean-luc', 'idees', note('2026-11-21-c', { auteur: 'Jean-Luc', date: '2026-11-21T12:00:00Z' })),
  })
  const r = await lireNotes(fs, R, ['Léa', 'Jean-Luc'])
  assert.deepEqual(r.notes.map(n => [n.id, n.auteur, n.type]), [['2026-11-21-c', 'Jean-Luc', 'idee'], ['2026-11-21-b', 'Léa', 'feedback'], ['2026-11-20-a', 'Léa', 'idee']])
  assert.deepEqual(r.erreurs, [])
})

test('aucun dossier de notes : rien, sans erreur', async () => {
  const r = await lireNotes(fsDe({ [`${R}/.pilotage/projet.json`]: '{}' }), R, ['Léa'])
  assert.deepEqual(r, { notes: [], erreurs: [] })
})

test('note illisible, invalide, trop grosse ou d’un autre type que son dossier : écartée et dite ; copies de conflit ignorées', async () => {
  const fs = fsDe({
    ...f('lea', 'idees', note('2026-11-21-bonne')),
    [`${E}/lea/idees/cassee.md`]: 'juste du texte',
    [`${E}/lea/idees/grosse.md`]: serializeNote(note('grosse')) + 'x'.repeat(70 * 1024),
    ...f('lea', 'idees', note('2026-11-21-mauvais-type', { type: 'feedback' })),
    [`${E}/lea/idees/2026-11-21-bonne (1).md`]: serializeNote(note('2026-11-21-bonne')),
    [`${E} (conflit)/x/idees/y.md`]: 'x',
    [`${E}/lea/idees/illisible.md`]: serializeNote(note('illisible')),
  }, [`${E}/lea/idees/illisible.md`])
  const r = await lireNotes(fs, R, ['Léa'])
  assert.deepEqual(r.notes.map(n => n.id), ['2026-11-21-bonne'])
  const { erreurs, avertissements } = separerAvis(r.erreurs)
  assert.equal(erreurs.length, 4, r.erreurs.join('\n'))
  assert.ok(erreurs.some(e => /cassee\.md/.test(e)) && erreurs.some(e => /64 Ko/.test(e)) && erreurs.some(e => /mauvais-type/.test(e)) && erreurs.some(e => /illisible\.md/.test(e)))
  assert.deepEqual(avertissements, [])
})

test('auteur déclaré différent : avertissement, la note reste lue sous le membre du dossier', async () => {
  const r = await lireNotes(fsDe(f('lea', 'idees', note('2026-11-21-x', { auteur: 'Sam' }))), R, ['Léa', 'Sam'])
  assert.equal(r.notes.length, 1); assert.equal(r.notes[0]!.auteur, 'Léa')
  assert.equal(separerAvis(r.erreurs).avertissements.length, 1)
})

test('au plus 200 notes par membre (les plus récentes, par nom) : le reste est signalé en info', async () => {
  const fichiers: Record<string, string> = {}
  for (let i = 0; i < 230; i++) Object.assign(fichiers, f('lea', 'idees', note(`2026-11-21-n${String(i).padStart(3, '0')}`)))
  Object.assign(fichiers, f('sam', 'idees', note('2026-11-21-sam', { auteur: 'Sam' })))
  const r = await lireNotes(fsDe(fichiers), R, ['Léa', 'Sam'])
  assert.equal(r.notes.filter(n => n.auteur === 'Léa').length, 200)
  assert.ok(r.notes.some(n => n.id === '2026-11-21-n229') && !r.notes.some(n => n.id === '2026-11-21-n029') && r.notes.some(n => n.id === '2026-11-21-n030'))
  assert.equal(r.notes.filter(n => n.auteur === 'Sam').length, 1)
  const { infos, erreurs } = separerAvis(r.erreurs)
  assert.equal(infos.length, 1); assert.match(infos[0]!, /30 notes/); assert.deepEqual(erreurs, [])
})

test('dossier de notes qui ne se liste pas : une erreur, les autres notes restent lues ; jamais de levée', async () => {
  const fichiers = { ...f('lea', 'idees', note('2026-11-21-a')), ...f('lea', 'feedback', note('2026-11-21-b', { type: 'feedback' })) }
  const r = await lireNotes(fsDe(fichiers, [`${E}/lea/feedback`]), R, ['Léa'])
  assert.deepEqual(r.notes.map(n => n.id), ['2026-11-21-a'])
  assert.equal(separerAvis(r.erreurs).erreurs.length, 1)
  const q = await lireNotes({ read: async () => { throw new Error('x') }, list: async () => { throw new Error('x') } }, R, ['Léa'])
  assert.deepEqual(q.notes, [])
  for (const racine of ['', null, undefined] as unknown[]) assert.deepEqual(await lireNotes(fsDe({}), racine as string, ['Léa']), { notes: [], erreurs: [] })
  assert.deepEqual((await lireNotes(fsDe({}), R, null as unknown as string[])).notes, [])
})
