import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Transaction, erreursNom, slug } from '../scripts/lib/ecriture.mjs'

const nouveau = () => mkdtempSync(join(tmpdir(), 'lib-'))

test('slug : sans accent, minuscules, tirets ; traversée neutralisée', () => {
  assert.equal(slug('Léa Dupont'), 'lea-dupont')
  assert.equal(slug('../x'), 'x')
  assert.equal(slug('???'), '')
})

test('erreursNom : trop long et noms réservés Windows', () => {
  assert.deepEqual(erreursNom('Le dossier', 'ok'), [])
  assert.equal(erreursNom('Le dossier', 'a'.repeat(61)).length, 1)
  assert.match(erreursNom('Le dossier', 'con')[0], /réservé/)
})

test('Transaction : annuler retire fichiers et dossiers créés, dans l’ordre inverse', () => {
  const d = nouveau()
  const t = new Transaction()
  t.dossierSur(join(d, 'a', 'b'))
  t.ecrire(join(d, 'a', 'b', 'f.txt'), 'x')
  assert.ok(existsSync(join(d, 'a', 'b', 'f.txt')))
  t.annuler()
  assert.deepEqual(readdirSync(d), [])
})

test('Transaction : ecrire refuse d’écraser (flag wx) et ne retire pas le fichier existant', () => {
  const d = nouveau(); const f = join(d, 'f.txt'); writeFileSync(f, 'ORIGINAL')
  const t = new Transaction()
  assert.throws(() => t.ecrire(f, 'AUTRE'))
  t.annuler()
  assert.equal(readFileSync(f, 'utf8'), 'ORIGINAL')
})

test('Transaction : remplacer est atomique et annuler restaure l’original, sans fichier temporaire', () => {
  const d = nouveau(); const f = join(d, 'f.txt'); writeFileSync(f, 'AVANT')
  const t = new Transaction()
  t.remplacer(f, 'APRES')
  assert.equal(readFileSync(f, 'utf8'), 'APRES')
  assert.deepEqual(readdirSync(d), ['f.txt'])
  t.annuler()
  assert.equal(readFileSync(f, 'utf8'), 'AVANT')
  assert.deepEqual(readdirSync(d), ['f.txt'])
})

test('Transaction : remplacer d’un fichier absent le crée, annuler le retire', () => {
  const d = nouveau(); const f = join(d, 'neuf.txt')
  const t = new Transaction()
  t.remplacer(f, 'X')
  assert.equal(readFileSync(f, 'utf8'), 'X')
  t.annuler()
  assert.ok(!existsSync(f))
})

test('Transaction : supprimer puis annuler remet le fichier', () => {
  const d = nouveau(); const f = join(d, 'f.txt'); writeFileSync(f, 'GARDE')
  const t = new Transaction()
  t.supprimer(f)
  assert.ok(!existsSync(f))
  t.annuler()
  assert.equal(readFileSync(f, 'utf8'), 'GARDE')
})

test('Transaction : remplacer quand la cible est un dossier échoue sans rien laisser', () => {
  const d = nouveau(); mkdirSync(join(d, 'cible'))
  const t = new Transaction()
  assert.throws(() => t.remplacer(join(d, 'cible'), 'X'))
  t.annuler()
  assert.deepEqual(readdirSync(d), ['cible'])
})
