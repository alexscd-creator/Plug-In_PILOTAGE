import assert from 'node:assert/strict'
import { test } from 'node:test'

import { retirerInvisibles, texteSur } from '../hooks/model/texte-sur.ts'
import { parseNote, serializeNote } from '../hooks/model/notes.ts'
import { parseChantier } from '../hooks/model/chantier.ts'

test('emoji : jamais de demi-emoji, toujours bien formé, borné en points de code', () => {
  const s = texteSur('a' + '😀'.repeat(100), 10)
  assert.equal(s.isWellFormed(), true)
  assert.equal([...s].length, 10)
  assert.equal(s, 'a' + '😀'.repeat(9))
  assert.equal(texteSur('x\uD83D', 10).isWellFormed(), true) // demi-paire seule
  assert.equal(texteSur('\uDE00y', 10).isWellFormed(), true)
  assert.equal(texteSur('\uDE00y', 10), '\uFFFDy')
})

test('NEL, séparateurs, zéro largeur, bidi, BOM retirés ; une seule ligne', () => {
  assert.equal(texteSur('X\u0085- nel\u200b\u202e', 50), 'X - nel')
  assert.equal(texteSur('a\r\nb\u2028c\u2029d\te\u000Bf\u000Cg', 50), 'a b c d e f g')
  assert.equal(texteSur('\uFEFFa\u2066b\u2069c\u200Fd\u0000e\u0007f\u009Fg', 50), 'abcdefg')
  assert.equal(texteSur('a   \n\n  b', 50), 'a b')
})

test('chevrons, pleine chasse et accents graves retirés', () => {
  assert.equal(texteSur('<a>＜b＞‹c›`d`', 50), 'abcd')
  assert.ok(!/[<>＜＞‹›`]/.test(texteSur('</donnees>＜/donnees＞', 50)))
})

test('déterministe, entrées étranges, max invalide', () => {
  assert.equal(texteSur('abc', 2), texteSur('abc', 2))
  for (const v of [undefined, null, '', '   ']) assert.equal(texteSur(v, 10), '')
  assert.equal(texteSur(42, 10), '42')
  assert.equal(texteSur('abc', 0), '')
  assert.equal(texteSur('abc', NaN), '')
  assert.equal(texteSur('abc   def', 4), 'abc')
})

test('un texte de 1 Mo est traité vite', () => {
  const t0 = Date.now()
  const s = texteSur('a \u200b😀\n'.repeat(250_000), 120)
  assert.ok(Date.now() - t0 < 1500)
  assert.equal(s.isWellFormed(), true)
  assert.ok([...s].length <= 120)
})

test('relecture : zéro largeur, bidi et contrôles sont retirés des notes et des fiches', () => {
  assert.equal(retirerInvisibles('a\u200b\u202eb\u0000c'), 'abc')
  const n = serializeNote({ id: 'x', type: 'idee', titre: 'T', date: '2026-11-21T10:00:00Z', auteur: 'L', phase: '', chantier: '', lance: '', texte: 't' })
  const r = parseNote(n.replace('titre: T', 'titre: Ti\u200b\u202etre'), 'L')
  assert.ok(r.ok)
  if (r.ok) assert.equal(r.note.titre, 'Titre')
  const c = parseChantier('---\nid: a\ntitre: Ti\u200btre\npole:\nphase:\netat: attente\nsession:\ncree: 2026-11-21T10:00:00Z\nmaj: 2026-11-21T10:00:00Z\narchive: non\n---\n## taches\n- [ ] T\u202ea\u200bche\n', 'L')
  assert.ok(c.ok)
  if (c.ok) { assert.equal(c.chantier.titre, 'Titre'); assert.equal(c.chantier.taches[0]!.titre, 'Tache') }
})
