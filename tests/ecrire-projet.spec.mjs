import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parsePlan } from '../hooks/model/plan.ts'
import { parseProjet } from '../hooks/model/projet.ts'

const ecrire = fileURLToPath(new URL('../scripts/ecrire-projet.mjs', import.meta.url))
const check = fileURLToPath(new URL('../scripts/check-projet.mjs', import.meta.url))
const nouveau = () => mkdtempSync(join(tmpdir(), 'ecrire-'))

const base = () => ({
  nom: 'Mon "jeu"\nbizarre', but: 'Un but', fini: 'Publié', preset: 'jeu-roblox', equipe: ['Léa Dupont', 'Jean-Luc'],
  poles: [{ id: 'technique', titre: 'Technique' }],
  phases: [{ id: 'dev', titre: 'Dév (v1)', taches: ['Coder | vite\nbien', 'Tester (tout)'] }],
  agents: [{ id: 'dev', titre: 'Développeur', pole: 'technique', skills: ['a', 'b'], pourquoi: 'Code\n# piège' }],
  workflow: { outils: [{ role: 'IA', outil: 'Claude' }] },
})
function lancer(dossier, reponses) {
  const f = join(mkdtempSync(join(tmpdir(), 'rep-')), 'reponses.json')
  writeFileSync(f, typeof reponses === 'string' ? reponses : JSON.stringify(reponses))
  return spawnSync('node', [ecrire, dossier, f], { encoding: 'utf8' })
}
const tout = d => readdirSync(d, { recursive: true }).map(String)

test('réponses valides : fichiers écrits, check-projet ok, plan relu', () => {
  const d = nouveau()
  const r = lancer(d, base())
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /projet écrit/)
  for (const f of ['.pilotage/projet.json', '.pilotage/plan.md', '.pilotage/equipe/lea-dupont/portes.md', '.pilotage/equipe/jean-luc/portes.md', '.pilotage/agents/dev.md'])
    assert.ok(existsSync(join(d, f)), f)
  assert.equal(spawnSync('node', [check, d], { encoding: 'utf8' }).stdout.trim(), 'projet ok')
  const p = parseProjet(readFileSync(join(d, '.pilotage/projet.json'), 'utf8'))
  assert.ok(p.ok)
  assert.equal(p.projet.nom, 'Mon "jeu"\nbizarre')
  const taches = parsePlan(readFileSync(join(d, '.pilotage/plan.md'), 'utf8'))
  assert.equal(taches.length, 2)
  assert.deepEqual(taches.map(t => t.id), ['dev-1', 'dev-2'])
  assert.equal(taches[0].phase, 'dev')
  const agent = readFileSync(join(d, '.pilotage/agents/dev.md'), 'utf8')
  assert.doesNotMatch(agent, /\n# piège/)
})

test('prénom ../x : pas de traversée, slug x', () => {
  const d = nouveau()
  const parent = mkdtempSync(join(tmpdir(), 'parent-'))
  const dossier = join(parent, 'proj'); mkdirSync(dossier)
  const rep = base(); rep.equipe = ['../x']
  assert.equal(lancer(dossier, rep).status, 0)
  assert.ok(existsSync(join(dossier, '.pilotage/equipe/x/portes.md')))
  assert.deepEqual(readdirSync(parent), ['proj'])
  void d
})

test('slug vide ou doublon refusés, rien écrit', () => {
  for (const equipe of [['???'], ['Léa', 'lea']]) {
    const d = nouveau(); const rep = base(); rep.equipe = equipe
    assert.equal(lancer(d, rep).status, 1)
    assert.ok(!existsSync(join(d, '.pilotage')))
  }
})

test('projet.json existant : code 3, rien écrasé', () => {
  const d = nouveau()
  mkdirSync(join(d, '.pilotage'))
  writeFileSync(join(d, '.pilotage/projet.json'), 'ORIGINAL')
  assert.equal(lancer(d, base()).status, 3)
  assert.equal(readFileSync(join(d, '.pilotage/projet.json'), 'utf8'), 'ORIGINAL')
  assert.equal(tout(d).length, 2)
})

test('réponses invalides : code 1, rien écrit', () => {
  const cas = [{ ...base(), nom: '' }, 'pas du json', { ...base(), poles: [{ id: 'Bad Id', titre: 'x' }] },
    { ...base(), agents: [{ id: '../a', titre: 'a', pole: 'technique', skills: [], pourquoi: '' }] },
    { ...base(), phases: [{ id: 'a b', titre: 'x', taches: [] }] }]
  for (const rep of cas) {
    const d = nouveau()
    const r = lancer(d, rep)
    assert.equal(r.status, 1, JSON.stringify(rep).slice(0, 60))
    assert.ok(!existsSync(join(d, '.pilotage')))
  }
})
