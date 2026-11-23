import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ecrireProjet = fileURLToPath(new URL('../scripts/ecrire-projet.mjs', import.meta.url))
const script = fileURLToPath(new URL('../scripts/installer-skills.mjs', import.meta.url))
const racinePresets = fileURLToPath(new URL('../presets/skills/', import.meta.url))

const reponses = (preset, skills) => ({
  nom: 'Mon projet', but: 'Un but', fini: 'Publié', preset, equipe: ['Léa'],
  poles: [{ id: 'technique', titre: 'Technique' }],
  phases: [{ id: 'dev', titre: 'Dév', taches: ['Coder'] }],
  agents: [{ id: 'dev', titre: 'Développeur', pole: 'technique', skills, pourquoi: 'Code' }],
  workflow: { outils: [{ role: 'IA', outil: 'Claude' }] },
})
function projet(preset, skills) {
  const d = mkdtempSync(join(tmpdir(), 'inst-'))
  const f = join(mkdtempSync(join(tmpdir(), 'rep-')), 'r.json')
  writeFileSync(f, JSON.stringify(reponses(preset, skills)))
  const r = spawnSync('node', [ecrireProjet, d, f], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return d
}
const lancer = (d, ...reste) => spawnSync('node', [script, d, ...reste], { encoding: 'utf8' })
const skillsDe = d => readdirSync(join(d, '.pilotage', 'skills')).sort()
const unSkillDuPreset = preset => readdirSync(join(racinePresets, preset)).find(n => n.endsWith('.md')).replace(/\.md$/, '')

test('usage : sans dossier ou avec un argument en trop : code 64', () => {
  assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 64)
  assert.equal(lancer(mkdtempSync(join(tmpdir(), 'x-')), 'extra').status, 64)
})

test('dossier introuvable ou sans projet : code 5', () => {
  assert.equal(lancer(join(tmpdir(), 'nexiste-pas-inst')).status, 5)
  assert.equal(lancer(mkdtempSync(join(tmpdir(), 'vide-'))).status, 5)
})

test('installe les skills du preset qui manquent, copiés tels quels', () => {
  const sk = unSkillDuPreset('site-web')
  const d = projet('site-web', [sk])
  rmSync(join(d, '.pilotage', 'skills', `${sk}.md`)) // projet créé avant la livraison des skills
  const r = lancer(d)
  assert.equal(r.status, 0, r.stderr)
  assert.equal(readFileSync(join(d, '.pilotage', 'skills', `${sk}.md`), 'utf8'), readFileSync(join(racinePresets, 'site-web', `${sk}.md`), 'utf8'))
  assert.match(r.stdout, /1 skill installé/)
})

test('un skill déjà présent n\'est jamais écrasé (même modifié)', () => {
  const sk = unSkillDuPreset('site-web')
  const d = projet('site-web', [sk])
  const f = join(d, '.pilotage', 'skills', `${sk}.md`)
  writeFileSync(f, 'MON TEXTE')
  const r = lancer(d)
  assert.equal(r.status, 0, r.stderr)
  assert.equal(readFileSync(f, 'utf8'), 'MON TEXTE')
  assert.match(r.stdout, /0 skill installé/)
  assert.match(r.stdout, /1 déjà présent/)
})

test('un skill sans fichier de preset reçoit le modèle « à compléter »', () => {
  const d = projet('autre', ['maison'])
  rmSync(join(d, '.pilotage', 'skills', 'maison.md'))
  assert.equal(lancer(d).status, 0)
  assert.match(readFileSync(join(d, '.pilotage', 'skills', 'maison.md'), 'utf8'), /à compléter/i)
})

test('sans skill cité, rien n\'est écrit et le dit', () => {
  const d = projet('autre', [])
  const avant = existsSync(join(d, '.pilotage', 'skills')) ? skillsDe(d) : []
  const r = lancer(d)
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(existsSync(join(d, '.pilotage', 'skills')) ? skillsDe(d) : [], avant)
  assert.match(r.stdout, /Aucun skill/)
})

test('relancé deux fois : la deuxième ne change rien', () => {
  const sk = unSkillDuPreset('application')
  const d = projet('application', [sk])
  rmSync(join(d, '.pilotage', 'skills', `${sk}.md`))
  assert.equal(lancer(d).status, 0)
  const apres = skillsDe(d)
  const r = lancer(d)
  assert.equal(r.status, 0)
  assert.deepEqual(skillsDe(d), apres)
  assert.match(r.stdout, /0 skill installé/)
})

test('un lien qui mène hors du projet est refusé (code 1), rien n\'est écrit', () => {
  const d = projet('autre', ['maison'])
  const dehors = mkdtempSync(join(tmpdir(), 'dehors-'))
  rmSync(join(d, '.pilotage', 'skills'), { recursive: true })
  try { symlinkOuJonction(dehors, join(d, '.pilotage', 'skills')) } catch { return } // pas de droit de lien : rien à tester ici
  const r = lancer(d)
  assert.equal(r.status, 1)
  assert.deepEqual(readdirSync(dehors), [])
})

import { symlinkSync } from 'node:fs'
function symlinkOuJonction(cible, lien) {
  symlinkSync(cible, lien, process.platform === 'win32' ? 'junction' : 'dir')
}
