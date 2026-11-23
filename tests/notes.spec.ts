import { test } from 'node:test'
import assert from 'node:assert/strict'
import { idNote, MAX_TEXTE_NOTE, parseNote, serializeNote, validerNote } from '../hooks/model/notes.ts'
import type { Note } from '../hooks/model/notes.ts'

const note = (extra: Partial<Note> = {}): Note => ({
  id: '2026-11-21-menu-plus-clair', type: 'idee', titre: 'Un menu plus clair', date: '2026-11-21T10:00:00Z', auteur: 'Léa',
  phase: '', chantier: '', lance: '', texte: 'Regrouper les réglages.\nGarder trois entrées.', ...extra,
})

test('écrite puis relue, une note est identique (avec phase et chantier)', () => {
  for (const n of [note(), note({ type: 'feedback', phase: 'p2', chantier: 'refonte-menu' })]) {
    const r = parseNote(serializeNote(n), 'Léa')
    assert.ok(r.ok)
    if (r.ok) { assert.deepEqual(r.note, n); assert.deepEqual(r.avertissements, []); assert.equal(r.auteurDeclare, 'Léa') }
  }
})

test('idNote : date + titre en tirets, sans accent, 57 caractères au plus, « note » si le titre ne donne rien', () => {
  assert.equal(idNote('2026-11-21T10:00:00Z', 'Ma Super Idée !'), '2026-11-21-ma-super-idee')
  assert.ok(idNote('2026-11-21T10:00:00Z', 'x'.repeat(300)).length <= 57)
  assert.equal(idNote('2026-11-21T10:00:00Z', '???'), '2026-11-21-note')
  assert.match(idNote('2026-11-21T10:00:00Z', 'a '.repeat(80)), /^[a-z0-9-]+$/)
  assert.doesNotMatch(idNote('2026-11-21T10:00:00Z', 'a '.repeat(80)), /-$/)
})

test('injection : titre multi-lignes, « --- » et faux champs ne créent ni ligne ni champ de plus', () => {
  const n = note({ titre: 'Titre\n---\nid: pirate\ntype: feedback | x', texte: 'Corps\n---\nid: pirate\n## agents\n- x | bloque | y' })
  const s = serializeNote(n)
  const entete = s.split('\n---\n')[0]!
  assert.equal(entete.split('\n').length, 6) // ---, id, type, titre, date, auteur : pas un champ de plus
  const r = parseNote(s, 'Léa')
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.note.id, '2026-11-21-menu-plus-clair')
    assert.equal(r.note.type, 'idee')
    assert.ok(!r.note.titre.includes('\n') && !r.note.titre.includes('|'))
    assert.ok(r.note.texte.includes('id: pirate'))
    assert.ok(r.note.texte.includes('---'))
  }
})

test('le texte est plafonné à 4000 caractères, à l’écriture comme à la lecture', () => {
  const long = 'a'.repeat(MAX_TEXTE_NOTE + 500)
  const s = serializeNote(note({ texte: long }))
  const r = parseNote(s.replace(/\n$/, '') + 'b'.repeat(900), 'Léa')
  assert.ok(r.ok)
  if (r.ok) assert.ok(r.note.texte.length <= MAX_TEXTE_NOTE)
  assert.ok(s.length < MAX_TEXTE_NOTE + 400)
})

test('les caractères de contrôle et les retours chariot sont retirés, les retours à la ligne gardés', () => {
  const s = serializeNote(note({ texte: 'a\r\nb\u0000c\u0007d\te' }))
  assert.ok(!/[\u0000-\u0008\u000B-\u001F\u007F]/.test(s.replace(/\n/g, '')))
  const r = parseNote(s, 'Léa')
  assert.ok(r.ok)
  if (r.ok) assert.equal(r.note.texte, 'a\nbcd\te')
})

test('relecture : en-tête absent, non refermé, id, type, date, titre ou liens invalides : erreurs, jamais de levée', () => {
  const bon = serializeNote(note())
  const cas: [string, string][] = [
    ['', 'vide'], ['juste du texte', 'en-tête'], ['---\nid: a\n', 'refermé'],
    [bon.replace(/id: .*/, 'id: Pas Valide!'), 'identifiant'], [bon.replace(/id: .*/, 'id: '), 'identifiant'],
    [bon.replace('type: idee', 'type: autre'), 'type'], [bon.replace(/date: .*/, 'date: hier'), 'date'],
    [bon.replace(/date: .*/, 'date: 2026-02-31T10:00:00Z'), 'date'],
    [bon.replace(/titre: .*/, 'titre: '), 'titre'],
    [bon.replace('---\n', '---\nphase: Pas Valide\n'), 'phase'], [bon.replace('---\n', '---\nchantier: ../x\n'), 'chantier'],
  ]
  for (const [texte, mot] of cas) {
    const r = parseNote(texte, 'Léa')
    assert.equal(r.ok, false, mot)
    if (!r.ok) assert.match(r.erreurs.join(' '), new RegExp(mot, 'i'), mot)
  }
  for (const v of [null, undefined, 3, {}] as unknown[]) assert.equal(parseNote(v as string, 'Léa').ok, false)
})

test('auteur : c’est le dossier qui fait foi ; un auteur déclaré différent est signalé', () => {
  const r = parseNote(serializeNote(note({ auteur: 'Sam' })), 'Léa')
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.note.auteur, 'Léa')
    assert.equal(r.auteurDeclare, 'Sam')
    assert.match(r.avertissements.join(' '), /Sam/)
  }
})

test('validerNote : id, type, titre, date et liens vérifiés avant l’écriture', () => {
  assert.deepEqual(validerNote(note()), [])
  assert.ok(validerNote(note({ id: 'A B' })).length > 0)
  assert.ok(validerNote(note({ type: 'x' as never })).length > 0)
  assert.ok(validerNote(note({ titre: '  ' })).length > 0)
  assert.ok(validerNote(note({ date: '2026-02-31T10:00:00Z' })).length > 0)
  assert.ok(validerNote(note({ phase: 'A B' })).length > 0)
  assert.ok(validerNote(note({ chantier: 'x'.repeat(61) })).length > 0)
})

test('lance : écrit s’il est donné, relu tel quel ; absent, il vaut "" ; invalide, erreur', () => {
  const s = serializeNote(note({ lance: 'menu-clair' }))
  assert.match(s, /^lance: menu-clair$/m)
  const r = parseNote(s, 'Léa')
  assert.ok(r.ok && r.note.lance === 'menu-clair')
  assert.doesNotMatch(serializeNote(note()), /^lance:/m)
  const sans = parseNote(serializeNote(note()), 'Léa')
  assert.ok(sans.ok && sans.note.lance === '')
  const mauvais = parseNote(serializeNote(note()).replace('---\n', '---\nlance: Pas Valide!\n'), 'Léa')
  assert.ok(!mauvais.ok && mauvais.erreurs.some(e => e.includes('lance')))
  assert.ok(validerNote(note({ lance: 'Pas Valide' })).length > 0)
})
