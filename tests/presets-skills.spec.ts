// Skills livrés avec chaque preset : un fichier presets/skills/<preset>/<skill>.md par skill cité par un agent, et chaque agent en a au moins un.
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { parsePreset } from '../hooks/model/presets.ts'

const dossier = fileURLToPath(new URL('../presets/', import.meta.url))
const presets = readdirSync(dossier).filter(f => f.endsWith('.json')).map(f => {
  const p = parsePreset(readFileSync(dossier + f, 'utf8'))
  assert.ok(p, f)
  return p
})
const fichier = (preset: string, skill: string): string => `${dossier}skills/${preset}/${skill}.md`
const ID = /^[a-z0-9-]+$/

test('chaque agent de chaque preset a au moins un skill', () => {
  for (const p of presets) for (const a of p.agents) assert.ok(a.skills.length > 0, `${p.id}/${a.id} sans skill`)
})

test('chaque skill cité par un agent a son fichier dans presets/skills/<preset>/, avec frontmatter name (= nom du fichier) et description', () => {
  for (const p of presets) for (const a of p.agents) for (const s of a.skills) {
    assert.ok(ID.test(s) && s.length <= 60, `${p.id}/${s} : nom invalide`)
    const f = fichier(p.id, s)
    assert.ok(existsSync(f), `${p.id}/${s} : fichier manquant`)
    const t = readFileSync(f, 'utf8')
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(t)
    assert.ok(m, `${p.id}/${s} : frontmatter`)
    assert.match(m![1]!, new RegExp(`^name: ${s}$`, 'm'), `${p.id}/${s} : name`)
    assert.match(m![1]!, /^description: \S.+$/m, `${p.id}/${s} : description`)
    assert.ok(t.length > 400, `${p.id}/${s} : trop court pour servir`)
  }
})

test('aucun fichier de skill de preset sans agent qui le cite', () => {
  for (const p of presets) {
    const dir = `${dossier}skills/${p.id}`
    if (!existsSync(dir)) continue
    const cites = new Set(p.agents.flatMap(a => a.skills))
    for (const f of readdirSync(dir)) assert.ok(cites.has(f.replace(/\.md$/, '')), `${p.id}/${f} n’est cité par aucun agent`)
  }
})

test('les skills Roblox gardent leurs faits sourcés (Source et Vérifié le) ; aucun renvoi à l’ancien plugin ni au Vault', () => {
  const faits = ['limites-roblox', 'luau-et-architecture', 'securite-client-serveur', 'donnees-et-datastore', 'materiaux-et-eclairage', 'environnement-et-modeles', 'avatars-et-animations', 'interface-et-lisibilite', 'audio-et-ambiances']
  for (const s of faits.filter(x => x !== 'limites-roblox')) {
    const t = readFileSync(fichier('jeu-roblox', s), 'utf8')
    assert.match(t, /- Source : https:\/\/create\.roblox\.com\//, s)
    assert.match(t, /- Vérifié le : 20\d\d-\d\d-\d\d/, s)
  }
  for (const p of presets) for (const f of existsSync(`${dossier}skills/${p.id}`) ? readdirSync(`${dossier}skills/${p.id}`) : []) {
    const t = readFileSync(`${dossier}skills/${p.id}/${f}`, 'utf8')
    for (const interdit of [/\/chantier\b/, /chef-de-chantier/, /vault/i, /Pixel Desk/i, /roblox-project-creator/, /check-fiche|check-idee/, /CLAUDE_PLUGIN_ROOT/])
      assert.doesNotMatch(t, interdit, `${p.id}/${f} : ${interdit}`)
  }
})

test('aucun secret ni action sortante dans les skills de preset', () => {
  for (const p of presets) for (const f of existsSync(`${dossier}skills/${p.id}`) ? readdirSync(`${dossier}skills/${p.id}`) : []) {
    const t = readFileSync(`${dossier}skills/${p.id}/${f}`, 'utf8')
    assert.doesNotMatch(t, /(api[_-]?key|token|mot de passe)\s*[:=]\s*\S{8,}/i, `${p.id}/${f}`)
    assert.doesNotMatch(t, /\b(curl|wget|git push|npm publish)\b/, `${p.id}/${f}`)
  }
})
