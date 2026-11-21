import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const racine = fileURLToPath(new URL('..', import.meta.url))
// Copie des scripts sans le modèle : l'import des fichiers .ts échoue.
function copieSansModele() {
  const d = mkdtempSync(join(tmpdir(), 'sansmodele-'))
  mkdirSync(join(d, 'scripts'))
  mkdirSync(join(d, 'scripts', 'lib'))
  copyFileSync(join(racine, 'scripts', 'lib', 'ecriture.mjs'), join(d, 'scripts', 'lib', 'ecriture.mjs'))
  for (const f of ['check-projet.mjs', 'ecrire-projet.mjs', 'pilotage-chantier.mjs']) copyFileSync(join(racine, 'scripts', f), join(d, 'scripts', f))
  return d
}

test('ecrire-projet : modèle introuvable, message français et code 4, pas de trace', () => {
  const d = copieSansModele()
  const rep = join(d, 'r.json'); writeFileSync(rep, '{}')
  const r = spawnSync('node', [join(d, 'scripts', 'ecrire-projet.mjs'), d, rep], { encoding: 'utf8' })
  assert.equal(r.status, 4, r.stderr)
  assert.match(r.stderr, /modèle/i)
  assert.doesNotMatch(r.stderr, /\n\s+at /)
})

test('check-projet : modèle introuvable, message français et code 1, pas de trace', () => {
  const d = copieSansModele()
  const r = spawnSync('node', [join(d, 'scripts', 'check-projet.mjs'), d], { encoding: 'utf8' })
  assert.equal(r.status, 1, r.stderr + r.stdout)
  assert.match(r.stdout + r.stderr, /modèle/i)
  assert.doesNotMatch(r.stdout + r.stderr, /\n\s+at /)
})

test('pilotage-chantier : modèle introuvable, message français et code 4, pas de trace', () => {
  const d = copieSansModele()
  const r = spawnSync('node', [join(d, 'scripts', 'pilotage-chantier.mjs'), d, 'creer', '{}', '--membre', 'a'], { encoding: 'utf8' })
  assert.equal(r.status, 4, r.stderr)
  assert.match(r.stderr, /modèle/i)
  assert.doesNotMatch(r.stderr, /\n\s+at /)
})
