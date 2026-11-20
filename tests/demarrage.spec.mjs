import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { serializeProjet, parseProjet } from '../hooks/model/projet.ts'
import { genererPlan } from '../hooks/model/plan.ts'

const script = fileURLToPath(new URL('../scripts/check-projet.mjs', import.meta.url))
const check = dir => spawnSync('node', [script, dir], { encoding: 'utf8' })
const nouveau = () => mkdtempSync(join(tmpdir(), 'demarrage-'))

const projet = {
  version: 1, nom: 'Mon jeu', but: 'Un jeu', fini: 'Publié', preset: 'jeu-roblox', equipe: ['Léa'],
  poles: [{ id: 'technique', titre: 'Technique' }],
  phases: [{ id: 'dev', titre: 'Développement', taches: ['Coder'] }],
  agents: [{ id: 'dev', titre: 'Développeur', pole: 'technique', skills: [], pourquoi: 'Code' }],
  workflow: { outils: [{ role: 'IA', outil: 'Claude' }] },
}
function marqueur(dir, texte) {
  mkdirSync(join(dir, '.pilotage'), { recursive: true })
  writeFileSync(join(dir, '.pilotage', 'projet.json'), texte)
}

test('projet valide : projet ok, code 0', () => {
  const d = nouveau()
  marqueur(d, serializeProjet(projet))
  const r = check(d)
  assert.equal(r.status, 0)
  assert.match(r.stdout, /projet ok/)
})

test('JSON cassé : erreurs en français, code 1', () => {
  const d = nouveau()
  marqueur(d, '{ pas du json')
  const r = check(d)
  assert.equal(r.status, 1)
  assert.match(r.stdout + r.stderr, /pas du JSON valide/)
})

test('JSON incomplet : une erreur par ligne, code 1', () => {
  const d = nouveau()
  marqueur(d, JSON.stringify({ version: 1 }))
  const r = check(d)
  assert.equal(r.status, 1)
  assert.ok((r.stdout + r.stderr).trim().split('\n').length > 1)
})

test('dossier sans marqueur : aucun projet, code 2', () => {
  const r = check(nouveau())
  assert.equal(r.status, 2)
  assert.match(r.stdout, /aucun projet/)
})

test('marqueur dans un dossier parent : code 0', () => {
  const d = nouveau()
  marqueur(d, serializeProjet(projet))
  const sous = join(d, 'a', 'b')
  mkdirSync(sous, { recursive: true })
  const r = check(sous)
  assert.equal(r.status, 0)
  assert.match(r.stdout, /projet ok/)
})

test('serializeProjet est relu à l\'identique et le plan généré a une tâche par entrée', () => {
  const r = parseProjet(serializeProjet(projet))
  assert.ok(r.ok)
  assert.match(genererPlan(projet), /- \[ \] dev-1 \| Coder/)
})
