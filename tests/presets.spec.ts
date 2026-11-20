import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parsePreset, preparerProjet, workflowIdeal, parseMonWorkflow } from '../hooks/model/presets.ts'
import type { Preset } from '../hooks/model/presets.ts'
import { parseProjet, serializeProjet } from '../hooks/model/projet.ts'

const dossier = fileURLToPath(new URL('../presets/', import.meta.url))
const fichiers = readdirSync(dossier).filter(f => f.endsWith('.json'))
const charger = (): Preset[] =>
  fichiers.map(f => {
    const p = parsePreset(readFileSync(dossier + f, 'utf8'))
    assert.ok(p, `${f} doit passer parsePreset`)
    return p
  })
const reponses = { nom: 'Mon projet', but: 'Un but', fini: 'Publié', equipe: ['Léa', 'Sam'] }

test('les trois presets existent', () => {
  assert.deepEqual(fichiers.sort(), ['application.json', 'autre.json', 'jeu-roblox.json'])
})

test('chaque preset passe parsePreset et donne un projet accepté par parseProjet', () => {
  for (const preset of charger()) {
    const projet = preparerProjet(preset, reponses)
    assert.equal(projet.preset, preset.id)
    const r = parseProjet(serializeProjet(projet))
    assert.ok(r.ok, `${preset.id} : ${r.ok ? '' : r.erreurs.join(' / ')}`)
    for (const a of preset.agents) assert.ok(a.pourquoi.trim() !== '', `${preset.id}/${a.id} sans pourquoi`)
  }
})

test('preparerProjet copie les réponses sans lier les tableaux au preset', () => {
  const preset = charger().find(p => p.id === 'jeu-roblox')!
  const projet = preparerProjet(preset, reponses)
  projet.poles.push({ id: 'x', titre: 'X' })
  assert.notEqual(projet.poles.length, preset.poles.length)
  assert.deepEqual(projet.equipe, ['Léa', 'Sam'])
})

test('jeu-roblox : pôles, phases et agents attendus', () => {
  const p = charger().find(x => x.id === 'jeu-roblox')!
  const titres = p.poles.map(x => x.titre)
  for (const t of ['Stratégie', 'Technique', 'Création', 'Qualité']) assert.ok(titres.includes(t), t)
  assert.deepEqual(p.phases.map(x => x.titre), ['Analyse', 'Idées', 'Game design', 'Développement', 'Test', 'Sortie'])
  assert.deepEqual(p.phases.map(x => x.id), ['analyse', 'idees', 'gamedesign', 'developpement', 'test', 'sortie'])
  assert.ok(p.phases.every(x => x.taches.length > 0))
  assert.ok(p.agents.length >= 5)
})

test('autre : aucun agent imposé, phases génériques', () => {
  const p = charger().find(x => x.id === 'autre')!
  assert.equal(p.agents.length, 0)
  assert.deepEqual(p.phases.map(x => x.titre), ['Cadrage', 'Réalisation', 'Livraison'])
})

test('application : phases et pôles attendus', () => {
  const p = charger().find(x => x.id === 'application')!
  assert.deepEqual(p.phases.map(x => x.titre), ['Cadrage', 'Conception', 'Développement', 'Test', 'Livraison'])
  assert.deepEqual(p.poles.map(x => x.titre), ['Produit', 'Technique', 'Design', 'Qualité'])
})

test('workflowIdeal jeu-roblox propose les outils attendus', () => {
  const noms = workflowIdeal('jeu-roblox', charger()).outils.map(o => o.outil)
  for (const n of ['Roblox Studio', 'Claude', 'GitHub', 'Figma', 'Google Gemini', 'Blender', 'Mesh AI'])
    assert.ok(noms.includes(n), n)
  assert.ok(noms.some(n => n.includes('.md')))
})

test('workflowIdeal d\'un id inconnu retombe sur autre', () => {
  const presets = charger()
  assert.deepEqual(workflowIdeal('inconnu', presets), presets.find(p => p.id === 'autre')!.workflow)
})

test('parsePreset refuse le JSON invalide ou incomplet', () => {
  assert.equal(parsePreset('pas du json'), null)
  assert.equal(parsePreset('{}'), null)
  assert.equal(parsePreset('[]'), null)
  const p = JSON.parse(readFileSync(dossier + 'autre.json', 'utf8'))
  assert.equal(parsePreset(JSON.stringify({ ...p, agents: [{ id: 'a', titre: 'A', pole: 'inexistant', skills: [], pourquoi: 'x' }] })), null)
})

test('parseMonWorkflow', () => {
  assert.equal(parseMonWorkflow('pas du json'), null)
  assert.equal(parseMonWorkflow('{}'), null)
  assert.equal(parseMonWorkflow('{"outils":[{"role":"r"}]}'), null)
  assert.deepEqual(parseMonWorkflow('{"outils":[{"role":"éditeur","outil":"Studio"}]}'), { outils: [{ role: 'éditeur', outil: 'Studio' }] })
})
