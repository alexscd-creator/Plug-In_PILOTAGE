import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parsePreset, libelle } from '../hooks/model/presets.ts'
import type { Preset } from '../hooks/model/presets.ts'
import { parseProjet, serializeProjet } from '../hooks/model/projet.ts'
import type { Projet } from '../hooks/model/projet.ts'

const lire = (rel: string): string => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8')
const charger = (id: string): Preset => { const p = parsePreset(lire(`presets/${id}.json`)); assert.ok(p, id); return p }
const IDS = ['site-web', 'jeu-roblox', 'application', 'autre']
const TEINTES = ['violet', 'bleu', 'sarcelle', 'vert', 'orange', 'rose']

const valide = (): Projet => ({
  version: 1, nom: 'Mon jeu', but: 'But', fini: 'Fini', preset: 'x', equipe: ['Léa'],
  poles: [{ id: 'code', titre: 'Code', couleur: 'bleu' }], phases: [{ id: 'p1', titre: 'P', taches: ['t'] }],
  agents: [{ id: 'dev', titre: 'Dev', pole: 'code', skills: [], pourquoi: 'x' }], workflow: { outils: [] },
  vocabulaire: { type: 'T', nomDuProjet: 'N', leProjet: 'l', unProjet: 'u', objectif: 'O', fini: 'F' },
  reglagesDef: [], reglages: {},
})
const erreurs = (o: unknown): string[] => { const r = parseProjet(JSON.stringify(o)); assert.equal(r.ok, false); return r.ok ? [] : r.erreurs }

// 1
test('jeu-roblox : pôles de la maquette avec leurs teintes', () => {
  const p = charger('jeu-roblox')
  assert.deepEqual(p.poles.map(x => [x.id, x.titre, x.couleur]), [
    ['gameplay', 'Gameplay', 'violet'], ['code', 'Code', 'bleu'], ['graphisme', 'Graphisme', 'rose'], ['qualite', 'Qualité', 'sarcelle'],
  ])
})
test('jeu-roblox : chaque agent est rattaché au pôle de la maquette', () => {
  const p = charger('jeu-roblox')
  const pole = Object.fromEntries(p.agents.map(a => [a.id, a.pole]))
  assert.equal(pole['concepteur-de-jeu'], 'gameplay')
  assert.equal(pole['developpeur'], 'code')
  assert.equal(pole['graphisme-et-environnement'], 'graphisme')
  assert.equal(pole['personnages-et-animations'], 'graphisme')
  assert.equal(pole['gardien'], 'qualite')
  assert.equal(pole['testeur'], 'qualite')
  assert.ok(p.agents.every(a => p.poles.some(x => x.id === a.pole) && a.pourquoi.trim() !== ''))
})
test('tous les presets : chaque pôle a une teinte valide, jamais deux fois la même', () => {
  for (const id of IDS) {
    const c = charger(id).poles.map(x => x.couleur)
    assert.ok(c.every(x => x && TEINTES.includes(x)), id)
    assert.equal(new Set(c).size, c.length, id)
  }
})
test('couleur de pôle : inconnue refusée, absente permise, conservée à l’aller-retour', () => {
  const p = valide()
  assert.ok(erreurs({ ...p, poles: [{ id: 'code', titre: 'Code', couleur: 'turquoise' }] }).some(e => e.includes('couleur')))
  assert.ok(erreurs({ ...p, poles: [{ id: 'code', titre: 'Code', couleur: 3 }] }).some(e => e.includes('couleur')))
  const sans = parseProjet(JSON.stringify({ ...p, poles: [{ id: 'code', titre: 'Code' }] }))
  assert.ok(sans.ok && sans.projet.poles[0]!.couleur === undefined)
  assert.ok(sans.ok && !serializeProjet(sans.projet).includes('couleur'))
  const r = parseProjet(serializeProjet(p))
  assert.ok(r.ok && r.projet.poles[0]!.couleur === 'bleu')
})
test('couleur de pôle : deux pôles de même teinte refusés', () => {
  const p = valide()
  assert.ok(erreurs({ ...p, poles: [{ id: 'a', titre: 'A', couleur: 'bleu' }, { id: 'b', titre: 'B', couleur: 'bleu' }], agents: [] }).some(e => e.includes('teinte')))
})

// 2
test('libelle ne lève jamais et ne rend jamais undefined', () => {
  const p = valide()
  assert.equal(libelle(p, 'nomDuProjet'), 'N')
  assert.notEqual(libelle(p, 'inconnue' as never), undefined)
  const sans = { ...p, vocabulaire: undefined } as unknown as Projet
  assert.doesNotThrow(() => libelle(sans, 'nomDuProjet'))
  assert.equal(libelle(sans, 'nomDuProjet'), 'Nom du projet')
  assert.equal(libelle({ ...p, vocabulaire: { ...p.vocabulaire, leProjet: undefined } } as unknown as Projet, 'leProjet'), 'le projet')
})

// 3
test('réglage d’id « constructor » : pas trouvé sur le prototype', () => {
  const def = { id: 'constructor', libelle: 'C', genre: 'texte' }
  const r = parseProjet(JSON.stringify({ ...valide(), reglagesDef: [def], reglages: {} }))
  assert.ok(r.ok, r.ok ? '' : r.erreurs.join(' / '))
  assert.deepEqual(r.ok && r.projet.reglages, {})
  const s = serializeProjet({ ...valide(), reglagesDef: [{ id: 'constructor', libelle: 'C', genre: 'texte' }], reglages: {} })
  assert.deepEqual(JSON.parse(s).reglages, {})
})

// 4
test('longueurs plafonnées, erreurs en français', () => {
  const p = valide()
  const long = (n: number) => 'x'.repeat(n)
  assert.ok(erreurs({ ...p, reglagesDef: [{ id: long(61), libelle: 'L', genre: 'texte' }], reglages: {} }).some(e => e.includes('60')))
  assert.ok(parseProjet(JSON.stringify({ ...p, reglagesDef: [{ id: long(60), libelle: 'L', genre: 'texte' }], reglages: {} })).ok)
  const d = { id: 'a', libelle: 'L', genre: 'texte' }
  assert.ok(erreurs({ ...p, reglagesDef: [d], reglages: { a: long(501) } }).some(e => e.includes('500')))
  assert.ok(parseProjet(JSON.stringify({ ...p, reglagesDef: [d], reglages: { a: long(500) } })).ok)
  assert.ok(erreurs({ ...p, nom: long(201) }).some(e => e.includes('200')))
  assert.ok(parseProjet(JSON.stringify({ ...p, nom: long(200) })).ok)
  assert.ok(erreurs({ ...p, poles: [{ id: 'code', titre: long(201) }] }).some(e => e.includes('200')))
  assert.ok(erreurs({ ...p, phases: [{ id: 'p1', titre: long(201), taches: [] }] }).some(e => e.includes('200')))
  assert.ok(erreurs({ ...p, agents: [{ id: 'dev', titre: long(201), pole: 'code', skills: [], pourquoi: 'x' }] }).some(e => e.includes('200')))
})

// 5
test('démarrage guidé : « dont « autre » » et non « plus « autre » »', () => {
  const t = lire('skills/demarrage-guide/SKILL.md')
  assert.ok(t.includes('dont « autre »'))
  assert.ok(!t.includes('plus « autre »'))
})

// 6
test('apostrophe typographique dans le vocabulaire des presets', () => {
  for (const id of IDS) for (const v of Object.values(charger(id).vocabulaire)) assert.ok(!v.includes("'"), `${id} : ${v}`)
  assert.equal(charger('application').vocabulaire.nomDuProjet, 'Nom de l’application')
})

// 7
test('serializeProjet : ordre fixe des clés d’un réglage', () => {
  const p = { ...valide(), reglagesDef: [{ aide: 'a', defaut: 'x', options: ['x', 'y'], genre: 'choix', libelle: 'L', id: 'r' }], reglages: {} } as unknown as Projet
  assert.deepEqual(Object.keys(JSON.parse(serializeProjet(p)).reglagesDef[0]), ['id', 'libelle', 'genre', 'options', 'defaut', 'aide'])
})
