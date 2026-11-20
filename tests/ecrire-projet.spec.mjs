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

const sansTrace = r => assert.doesNotMatch(r.stderr + r.stdout, /\n\s+at |node:internal/)

test('prénom de 300 caractères : code 1, rien écrit, pas de trace', () => {
  const d = nouveau(); const rep = base(); rep.equipe = ['a'.repeat(300)]
  const r = lancer(d, rep)
  assert.equal(r.status, 1); sansTrace(r)
  assert.ok(!existsSync(join(d, '.pilotage')))
})

test('identifiant d\'agent de 100 caractères : code 1, rien écrit', () => {
  const d = nouveau(); const rep = base(); rep.agents[0].id = 'a'.repeat(100)
  const r = lancer(d, rep)
  assert.equal(r.status, 1); sansTrace(r)
  assert.ok(!existsSync(join(d, '.pilotage')))
})

test('noms réservés Windows (id con, prénom nul) : code 1', () => {
  const d1 = nouveau(); const r1 = base(); r1.agents[0].id = 'con'
  assert.equal(lancer(d1, r1).status, 1)
  const d2 = nouveau(); const r2 = base(); r2.equipe = ['nul']
  assert.equal(lancer(d2, r2).status, 1)
  assert.ok(!existsSync(join(d1, '.pilotage')) && !existsSync(join(d2, '.pilotage')))
})

test('un fichier passé comme dossier : code 5', () => {
  const d = nouveau(); const f = join(d, 'fichier.txt'); writeFileSync(f, 'x')
  const r = lancer(f, base())
  assert.equal(r.status, 5); sansTrace(r)
})

test('dossier inexistant : code 5, pas créé', () => {
  const d = join(nouveau(), 'absent', 'profond')
  const r = lancer(d, base())
  assert.equal(r.status, 5); sansTrace(r)
  assert.ok(!existsSync(d))
})

test('.pilotage est un fichier : code 4, rien de créé, fichier intact', () => {
  const d = nouveau(); writeFileSync(join(d, '.pilotage'), 'FICHIER')
  const r = lancer(d, base())
  assert.equal(r.status, 4); sansTrace(r)
  assert.equal(readFileSync(join(d, '.pilotage'), 'utf8'), 'FICHIER')
  assert.deepEqual(readdirSync(d), ['.pilotage'])
})

test('échec en cours d\'écriture : tout ce qui a été créé est retiré, le reste est intact', () => {
  const d = nouveau()
  mkdirSync(join(d, '.pilotage', 'equipe'), { recursive: true })
  writeFileSync(join(d, '.pilotage', 'equipe', 'jean-luc'), 'FICHIER') // bloque equipe/jean-luc/portes.md
  writeFileSync(join(d, '.pilotage', 'garde.txt'), 'GARDE')
  const r = lancer(d, base())
  assert.equal(r.status, 4); sansTrace(r)
  assert.deepEqual(tout(d).map(x => x.replace(/[^a-z0-9.-]/gi, '/')).sort(), ['.pilotage', '.pilotage/equipe', '.pilotage/equipe/jean-luc', '.pilotage/garde.txt'])
  assert.equal(readFileSync(join(d, '.pilotage', 'equipe', 'jean-luc'), 'utf8'), 'FICHIER')
  assert.equal(readFileSync(join(d, '.pilotage', 'garde.txt'), 'utf8'), 'GARDE')
})

const vocab = { type: 'Site web', nomDuProjet: 'Nom du site', leProjet: 'le site', unProjet: 'un site', objectif: 'Objectif du site', fini: 'Ce que « en ligne » veut dire' }
const defs = [
  { id: 'domaine', libelle: 'Domaine', genre: 'texte' },
  { id: 'hebergement', libelle: 'Hébergement', genre: 'choix', options: ['à choisir', 'cloud'], defaut: 'à choisir' },
  { id: 'paiement', libelle: 'Paiement', genre: 'oui-non', defaut: false },
]

test('vocabulaire, reglagesDef et reglages sont écrits dans projet.json', () => {
  const d = nouveau()
  const r = lancer(d, { ...base(), vocabulaire: vocab, reglagesDef: defs, reglages: { domaine: 'exemple.fr', hebergement: 'cloud', paiement: true } })
  assert.equal(r.status, 0, r.stderr)
  const p = parseProjet(readFileSync(join(d, '.pilotage/projet.json'), 'utf8'))
  assert.ok(p.ok)
  assert.deepEqual(p.projet.vocabulaire, vocab)
  assert.deepEqual(p.projet.reglagesDef, defs)
  assert.deepEqual(p.projet.reglages, { domaine: 'exemple.fr', hebergement: 'cloud', paiement: true })
  assert.equal(spawnSync('node', [check, d], { encoding: 'utf8' }).stdout.trim(), 'projet ok')
})

test('réponses sans les nouveaux champs : vocabulaire neutre par défaut', () => {
  const d = nouveau()
  assert.equal(lancer(d, base()).status, 0)
  const p = parseProjet(readFileSync(join(d, '.pilotage/projet.json'), 'utf8'))
  assert.ok(p.ok)
  assert.equal(p.projet.vocabulaire.nomDuProjet, 'Nom du projet')
  assert.deepEqual(p.projet.reglagesDef, [])
  assert.deepEqual(p.projet.reglages, {})
})

test('vocabulaire ou réglages invalides : code 1, rien écrit', () => {
  const cas = [
    { ...base(), vocabulaire: { ...vocab, nomDuProjet: '' } },
    { ...base(), vocabulaire: 'x' },
    { ...base(), reglagesDef: [{ id: 'Bad Id', libelle: 'X', genre: 'texte' }] },
    { ...base(), reglagesDef: defs, reglages: { paiement: 'oui' } },
    { ...base(), reglagesDef: defs, reglages: { hebergement: 'mutualisé' } },
    { ...base(), reglagesDef: defs, reglages: { inconnu: 'x' } },
  ]
  for (const rep of cas) {
    const d = nouveau()
    const r = lancer(d, rep)
    assert.equal(r.status, 1, JSON.stringify(rep).slice(0, 80))
    assert.doesNotMatch(r.stderr, /\n\s+at /)
    assert.ok(!existsSync(join(d, '.pilotage')))
  }
})
