import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseChantier } from '../hooks/model/chantier.ts'
import { parsePlan } from '../hooks/model/plan.ts'
import { lirePortes } from '../hooks/model/phases.ts'

const ecrireProjet = fileURLToPath(new URL('../scripts/ecrire-projet.mjs', import.meta.url))
const script = fileURLToPath(new URL('../scripts/pilotage-chantier.mjs', import.meta.url))

const reponses = () => ({
  nom: 'Mon projet', but: 'Un but', fini: 'Publié', preset: 'autre', equipe: ['Léa Dupont', 'Jean-Luc'],
  poles: [{ id: 'technique', titre: 'Technique' }],
  phases: [{ id: 'dev', titre: 'Dév', taches: ['Coder', 'Tester'] }, { id: 'prod', titre: 'Prod', taches: [] }],
  agents: [{ id: 'dev', titre: 'Développeur', pole: 'technique', skills: [], pourquoi: 'Code' }],
  workflow: { outils: [{ role: 'IA', outil: 'Claude' }] },
})
function projet() {
  const d = mkdtempSync(join(tmpdir(), 'chantier-'))
  const f = join(mkdtempSync(join(tmpdir(), 'rep-')), 'r.json')
  writeFileSync(f, JSON.stringify(reponses()))
  const r = spawnSync('node', [ecrireProjet, d, f], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return d
}
const lancer = (d, action, json, ...opts) =>
  spawnSync('node', [script, d, action, typeof json === 'string' ? json : JSON.stringify(json), ...opts], { encoding: 'utf8' })
const M = ['--membre', 'Léa Dupont']
const fiche = (d, id = 'carte', sous = 'chantiers', slug = 'lea-dupont') => join(d, '.pilotage', 'equipe', slug, sous, `${id}.md`)
const lire = f => readFileSync(f, 'utf8')
const relu = (d, id = 'carte', sous = 'chantiers') => {
  const r = parseChantier(lire(fiche(d, id, sous)), 'Léa')
  assert.ok(r.ok, JSON.stringify(r))
  return r.chantier
}
const tout = d => readdirSync(d, { recursive: true }).map(String).sort()
const sansTrace = r => assert.doesNotMatch(r.stderr + r.stdout, /\n\s+at |node:internal/)
const creerBase = (d, extra = {}) =>
  lancer(d, 'creer', { id: 'carte', titre: 'Carte du lobby', pole: 'technique', phase: 'dev', agents: [{ id: 'dev', quoi: 'Script' }], taches: ['Poser le sol', 'Placer les portes'], ...extra }, ...M)

// --- usage, dossier, membre ---------------------------------------------------------------------------------------

test('usage : sans arguments, action inconnue, --membre absent ou option inconnue : code 64', () => {
  const d = projet()
  assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 64)
  assert.equal(lancer(d, 'inconnue', {}, ...M).status, 64)
  assert.equal(lancer(d, 'creer', { titre: 'x' }).status, 64)
  assert.equal(lancer(d, 'creer', { titre: 'x' }, '--membre').status, 64)
  assert.equal(lancer(d, 'creer', { titre: 'x' }, ...M, '--zzz').status, 64)
})

test('dossier introuvable, fichier ou sans projet : code 5, rien créé', () => {
  const vide = mkdtempSync(join(tmpdir(), 'vide-'))
  const fichier = join(vide, 'f.txt'); writeFileSync(fichier, 'x')
  for (const d of [join(vide, 'absent'), fichier, vide]) {
    const r = lancer(d, 'creer', { titre: 'x' }, ...M)
    assert.equal(r.status, 5, d); sansTrace(r)
  }
  assert.deepEqual(readdirSync(vide), ['f.txt'])
})

test('membre hors équipe ou tentative de traversée : code 1, rien écrit', () => {
  const d = projet(); const avant = tout(d)
  for (const m of ['Mallory', '../x', 'Léa Dupont/../x']) {
    const r = lancer(d, 'creer', { titre: 'Carte' }, '--membre', m)
    assert.equal(r.status, 1, m); sansTrace(r)
  }
  assert.deepEqual(tout(d), avant)
})

test('membre : écritures différentes du même prénom acceptées (lea, JEAN LUC)', () => {
  const d = projet()
  assert.equal(lancer(d, 'creer', { id: 'a', titre: 'A' }, '--membre', 'lea dupont').status, 0)
  assert.equal(lancer(d, 'creer', { id: 'b', titre: 'B' }, '--membre', 'JEAN LUC').status, 0)
  assert.ok(existsSync(fiche(d, 'a')) && existsSync(fiche(d, 'b', 'chantiers', 'jean-luc')))
})

// --- creer ---------------------------------------------------------------------------------------------------------

test('creer : fiche écrite chez le membre, relue par le modèle, état attente, dates ISO', () => {
  const d = projet(); const avant = Date.now()
  const r = creerBase(d)
  assert.equal(r.status, 0, r.stderr)
  const c = relu(d)
  assert.equal(c.titre, 'Carte du lobby'); assert.equal(c.pole, 'technique'); assert.equal(c.phase, 'dev')
  assert.equal(c.etat, 'attente'); assert.equal(c.session, 'carte'); assert.equal(c.archive, false)
  assert.deepEqual(c.taches.map(t => [t.titre, t.statut]), [['Poser le sol', 'a faire'], ['Placer les portes', 'a faire']])
  assert.deepEqual(c.agents, [{ id: 'dev', etat: 'attente', quoi: 'Script' }])
  assert.equal(c.cree, c.maj)
  assert.ok(Date.parse(c.cree) >= avant - 1000 && Date.parse(c.cree) <= Date.now() + 1000)
})

test('creer : rien n’est écrit hors equipe/<slug>/chantiers', () => {
  const d = projet(); const avant = tout(d)
  assert.equal(creerBase(d).status, 0)
  const nouveaux = tout(d).filter(x => !avant.includes(x))
  assert.deepEqual(nouveaux, [join('.pilotage', 'equipe', 'lea-dupont', 'chantiers'), join('.pilotage', 'equipe', 'lea-dupont', 'chantiers', 'carte.md')])
})

test('creer : identifiant tiré du titre quand il est absent, JSON lu depuis un fichier', () => {
  const d = projet()
  const f = join(mkdtempSync(join(tmpdir(), 'js-')), 'c.json'); writeFileSync(f, JSON.stringify({ titre: 'Écran d’accueil !' }))
  const r = lancer(d, 'creer', f, ...M)
  assert.equal(r.status, 0, r.stderr)
  assert.ok(existsSync(fiche(d, 'ecran-d-accueil')))
})

test('creer : refuse d’écraser (code 3), la fiche existante reste intacte ; idem si l’id est déjà archivé', () => {
  const d = projet()
  assert.equal(creerBase(d).status, 0)
  writeFileSync(fiche(d), 'ORIGINAL')
  const r = creerBase(d); assert.equal(r.status, 3, r.stderr); sansTrace(r)
  assert.equal(lire(fiche(d)), 'ORIGINAL')
  mkdirSync(join(d, '.pilotage', 'equipe', 'lea-dupont', 'archive'), { recursive: true })
  writeFileSync(fiche(d, 'vieux', 'archive'), 'ARCHIVE')
  assert.equal(lancer(d, 'creer', { id: 'vieux', titre: 'V' }, ...M).status, 3)
  assert.equal(lire(fiche(d, 'vieux', 'archive')), 'ARCHIVE')
})

test('creer : entrées invalides, code 1, rien écrit, pas de trace', () => {
  const d = projet(); const avant = tout(d)
  const cas = [
    'pas du json', '[]', {}, { titre: '' }, { titre: 'x'.repeat(201) },
    { id: 'Bad Id', titre: 'x' }, { id: '../x', titre: 'x' }, { id: 'a'.repeat(61), titre: 'x' }, { id: 'con', titre: 'x' }, { id: 'nul', titre: 'x' },
    { titre: 'x', pole: 'inconnu' }, { titre: 'x', phase: 'inconnue' }, { titre: 'x', agents: [{ id: 'fantome' }] },
    { titre: 'x', taches: Array.from({ length: 101 }, (_, i) => `t${i}`) },
    { titre: 'x', fichiers: ['../secret'] }, { titre: 'x', fichiers: ['C:/x'] }, { titre: 'x', etat: 'termine' },
    { titre: 'x', passation: 'p'.repeat(4001) },
  ]
  for (const j of cas) {
    const r = lancer(d, 'creer', j, ...M)
    assert.equal(r.status, 1, JSON.stringify(j).slice(0, 70)); sansTrace(r)
  }
  assert.deepEqual(tout(d), avant)
})

test('creer : assainissement, saut de ligne, « | » et faux titres de section dans le titre, la tâche, le fichier', () => {
  const d = projet()
  const r = lancer(d, 'creer', { id: 'sale', titre: 'Titre\n## passation\npiège | x', taches: ['T1\n- [x] faux', 'T2 | y'], agents: [{ id: 'dev', quoi: 'Q\n- autre | etat' }], fichiers: ['src/a b.luau'] }, ...M)
  assert.equal(r.status, 0, r.stderr)
  const c = relu(d, 'sale')
  assert.doesNotMatch(c.titre, /\n|\|/); assert.equal(c.passation, '')
  assert.equal(c.taches.length, 2); assert.equal(c.agents.length, 1); assert.deepEqual(c.fichiers, ['src/a b.luau'])
  assert.ok(c.taches.every(t => t.statut === 'a faire'))
})

test('creer : échec d’écriture, code 4, rien n’est resté', () => {
  const d = projet()
  writeFileSync(join(d, '.pilotage', 'equipe', 'lea-dupont', 'chantiers'), 'FICHIER') // bloque le dossier
  const avant = tout(d)
  const r = creerBase(d)
  assert.equal(r.status, 4, r.stderr); sansTrace(r)
  assert.deepEqual(tout(d), avant)
  assert.equal(lire(join(d, '.pilotage', 'equipe', 'lea-dupont', 'chantiers')), 'FICHIER')
})

// --- maj -----------------------------------------------------------------------------------------------------------

test('maj : état, agent, tâche, fichier ; maj repart à maintenant ; le reste est conservé', async () => {
  const d = projet(); creerBase(d, { passation: 'Note.' })
  const avant = relu(d)
  await new Promise(r => setTimeout(r, 15))
  const r = lancer(d, 'maj', { id: 'carte', etat: 'en-travail', agent: { id: 'dev', etat: 'en-travail', quoi: 'Portes' }, tache: { titre: 'Poser le sol', statut: 'termine' }, fichier: 'src/lobby.luau' }, ...M)
  assert.equal(r.status, 0, r.stderr)
  const c = relu(d)
  assert.equal(c.etat, 'en-travail')
  assert.deepEqual(c.agents, [{ id: 'dev', etat: 'en-travail', quoi: 'Portes' }])
  assert.deepEqual(c.taches.map(t => t.statut), ['termine', 'a faire'])
  assert.deepEqual(c.fichiers, ['src/lobby.luau'])
  assert.equal(c.passation, 'Note.'); assert.equal(c.cree, avant.cree)
  assert.ok(Date.parse(c.maj) > Date.parse(avant.maj))
  assert.ok(!tout(d).some(x => /\.tmp-/.test(x)))
})

test('maj : nouvelle tâche ajoutée, pas de doublon de fichier, agent du projet seulement', () => {
  const d = projet(); creerBase(d)
  assert.equal(lancer(d, 'maj', { id: 'carte', tache: { titre: 'Peindre', statut: 'en cours' }, fichier: 'a.luau' }, ...M).status, 0)
  assert.equal(lancer(d, 'maj', { id: 'carte', fichier: 'a.luau' }, ...M).status, 0)
  const c = relu(d)
  assert.equal(c.taches.at(-1).titre, 'Peindre'); assert.equal(c.taches.at(-1).statut, 'en cours'); assert.deepEqual(c.fichiers, ['a.luau'])
  assert.equal(lancer(d, 'maj', { id: 'carte', agent: { id: 'fantome', etat: 'attente' } }, ...M).status, 1)
})

test('maj : entrées invalides, code 1, fiche intacte', () => {
  const d = projet(); creerBase(d); const avant = lire(fiche(d))
  const cas = [{ etat: 'termine' }, { etat: 'nimporte' }, { fichier: '../x' }, { fichier: '/etc/passwd' }, { tache: { titre: 'x', statut: 'fini' } },
    { tache: { titre: '' } }, { agent: { id: 'dev', etat: 'zzz' } }, { passation: 'p'.repeat(4001) }, { id: 'absent', etat: 'attente' }, {}]
  for (const j of cas) {
    const r = lancer(d, 'maj', { id: 'carte', ...j }, ...M)
    assert.equal(r.status, 1, JSON.stringify(j)); sansTrace(r)
    assert.equal(lire(fiche(d)), avant, JSON.stringify(j))
  }
})

test('maj : fiche inconnue ou illisible : code 1, rien touché', () => {
  const d = projet(); creerBase(d)
  assert.equal(lancer(d, 'maj', { id: 'absente', etat: 'attente' }, ...M).status, 1)
  writeFileSync(fiche(d), 'pas une fiche'); const avant = tout(d)
  const r = lancer(d, 'maj', { id: 'carte', etat: 'attente' }, ...M)
  assert.equal(r.status, 1); sansTrace(r)
  assert.equal(lire(fiche(d)), 'pas une fiche'); assert.deepEqual(tout(d), avant)
})

test('maj : on n’écrit que chez soi (la fiche d’un autre membre est introuvable pour ce membre)', () => {
  const d = projet(); creerBase(d); const avant = lire(fiche(d))
  const r = lancer(d, 'maj', { id: 'carte', etat: 'bloque' }, '--membre', 'Jean-Luc')
  assert.equal(r.status, 1)
  assert.equal(lire(fiche(d)), avant)
})

// --- lier-session --------------------------------------------------------------------------------------------------

const sessions = d => join(d, '.pilotage', 'equipe', 'lea-dupont', 'sessions.json')

test('lier-session : sessions.json { id de session : id du chantier }, idempotent ; plusieurs sessions possibles', () => {
  const d = projet(); creerBase(d); lancer(d, 'creer', { id: 'autre', titre: 'Autre' }, ...M)
  assert.equal(lancer(d, 'lier-session', { id: 'carte', sessionId: 'abc-123' }, ...M).status, 0)
  assert.equal(lancer(d, 'lier-session', { id: 'carte', sessionId: 'abc-123' }, ...M).status, 0)
  assert.equal(lancer(d, 'lier-session', { id: 'autre', sessionId: 'def_456' }, ...M).status, 0)
  assert.deepEqual(JSON.parse(lire(sessions(d))), { 'abc-123': 'carte', 'def_456': 'autre' })
})

test('lier-session : un id de session déjà lié à un autre chantier est refusé (code 3) sans rien changer', () => {
  const d = projet(); creerBase(d); lancer(d, 'creer', { id: 'autre', titre: 'Autre' }, ...M)
  lancer(d, 'lier-session', { id: 'carte', sessionId: 'abc' }, ...M)
  const avant = lire(sessions(d))
  assert.equal(lancer(d, 'lier-session', { id: 'autre', sessionId: 'abc' }, ...M).status, 3)
  assert.equal(lire(sessions(d)), avant)
})

test('lier-session : par nom de session quand l’id est inconnu (fiche mise à jour, sessions.json non créé)', () => {
  const d = projet(); creerBase(d)
  const r = lancer(d, 'lier-session', { id: 'carte', nom: 'chantier-carte' }, ...M)
  assert.equal(r.status, 0, r.stderr)
  assert.equal(relu(d).session, 'chantier-carte'); assert.ok(!existsSync(sessions(d)))
})

test('lier-session : entrées invalides ou fichier existant corrompu, code 1, rien changé', () => {
  const d = projet(); creerBase(d); const avant = tout(d)
  for (const j of [{ id: 'carte' }, { id: 'carte', sessionId: '../x' }, { id: 'carte', sessionId: '__proto__' }, { id: 'carte', sessionId: 'a b' }, { id: 'carte', sessionId: 'x'.repeat(101) }, { id: 'absent', sessionId: 'ok' }, { id: 'carte', nom: '' }]) {
    const r = lancer(d, 'lier-session', j, ...M)
    assert.equal(r.status, 1, JSON.stringify(j)); sansTrace(r)
  }
  assert.deepEqual(tout(d), avant)
  writeFileSync(sessions(d), '{pas du json')
  assert.equal(lancer(d, 'lier-session', { id: 'carte', sessionId: 'ok' }, ...M).status, 1)
  assert.equal(lire(sessions(d)), '{pas du json')
})

// --- archiver ------------------------------------------------------------------------------------------------------

test('archiver : refusé tant que des tâches « a faire » ou « en cours » restent, avec leur liste ; rien ne bouge', () => {
  const d = projet(); creerBase(d); const avant = lire(fiche(d))
  const r = lancer(d, 'archiver', { id: 'carte', passation: 'Fini.' }, ...M)
  assert.equal(r.status, 1); sansTrace(r)
  assert.match(r.stderr, /Poser le sol/); assert.match(r.stderr, /Placer les portes/); assert.match(r.stderr, /--force-report/)
  assert.equal(lire(fiche(d)), avant); assert.ok(!existsSync(fiche(d, 'carte', 'archive')))
})

test('archiver --force-report : tâches ouvertes marquées « reporte », fiche déplacée, état termine, passation écrite', () => {
  const d = projet(); creerBase(d)
  lancer(d, 'maj', { id: 'carte', tache: { titre: 'Poser le sol', statut: 'termine' } }, ...M)
  const r = lancer(d, 'archiver', { id: 'carte', passation: 'Reste les portes.\nVoir docs.' }, ...M, '--force-report')
  assert.equal(r.status, 0, r.stderr)
  assert.ok(!existsSync(fiche(d)))
  const c = relu(d, 'carte', 'archive')
  assert.equal(c.etat, 'termine'); assert.equal(c.archive, true)
  assert.deepEqual(c.taches.map(t => t.statut), ['termine', 'reporte'])
  assert.equal(c.passation, 'Reste les portes.\nVoir docs.')
})

test('archiver : sans tâche ouverte, pas besoin de --force-report ; la passation est obligatoire', () => {
  const d = projet(); creerBase(d, { taches: ['Seule'] })
  lancer(d, 'maj', { id: 'carte', tache: { titre: 'Seule', statut: 'termine' } }, ...M)
  assert.equal(lancer(d, 'archiver', { id: 'carte' }, ...M).status, 1)
  assert.equal(lancer(d, 'archiver', { id: 'carte', passation: '   ' }, ...M).status, 1)
  assert.ok(existsSync(fiche(d)))
  assert.equal(lancer(d, 'archiver', { id: 'carte', passation: 'Ok.' }, ...M).status, 0)
  assert.ok(existsSync(fiche(d, 'carte', 'archive')))
})

test('archiver : retire le lien de session du chantier et garde les autres', () => {
  const d = projet(); creerBase(d, { taches: [] }); lancer(d, 'creer', { id: 'autre', titre: 'Autre' }, ...M)
  lancer(d, 'lier-session', { id: 'carte', sessionId: 's1' }, ...M); lancer(d, 'lier-session', { id: 'autre', sessionId: 's2' }, ...M)
  assert.equal(lancer(d, 'archiver', { id: 'carte', passation: 'Ok.' }, ...M).status, 0)
  assert.deepEqual(JSON.parse(lire(sessions(d))), { s2: 'autre' })
})

test('archiver : archive du même nom déjà présente, code 3, la fiche active reste', () => {
  const d = projet(); creerBase(d, { taches: [] })
  mkdirSync(join(d, '.pilotage', 'equipe', 'lea-dupont', 'archive'), { recursive: true })
  writeFileSync(fiche(d, 'carte', 'archive'), 'ANCIENNE')
  const avant = lire(fiche(d))
  const r = lancer(d, 'archiver', { id: 'carte', passation: 'Ok.' }, ...M)
  assert.equal(r.status, 3); sansTrace(r)
  assert.equal(lire(fiche(d)), avant); assert.equal(lire(fiche(d, 'carte', 'archive')), 'ANCIENNE')
})

test('archiver : échec en cours de route, code 4, fiche active et sessions.json restaurés, aucune archive', () => {
  const d = projet(); creerBase(d, { taches: [] })
  lancer(d, 'lier-session', { id: 'carte', sessionId: 's1' }, ...M)
  writeFileSync(join(d, '.pilotage', 'equipe', 'lea-dupont', 'archive'), 'FICHIER') // `archive` est un fichier : impossible d'y écrire
  const avantFiche = lire(fiche(d)), avantSessions = lire(sessions(d))
  const r = lancer(d, 'archiver', { id: 'carte', passation: 'Ok.' }, ...M)
  assert.equal(r.status, 4, r.stderr); sansTrace(r)
  assert.equal(lire(fiche(d)), avantFiche); assert.equal(lire(sessions(d)), avantSessions)
  assert.equal(lire(join(d, '.pilotage', 'equipe', 'lea-dupont', 'archive')), 'FICHIER')
})

// --- tache ---------------------------------------------------------------------------------------------------------

const plan = d => join(d, '.pilotage', 'plan.md')

test('tache : change le statut d’une tâche du plan partagé, les autres tâches sont conservées', () => {
  const d = projet()
  const r = lancer(d, 'tache', { id: 'dev-1', statut: 'termine' })
  assert.equal(r.status, 0, r.stderr)
  const t = parsePlan(lire(plan(d)))
  assert.deepEqual(t.map(x => [x.id, x.statut]), [['dev-1', 'termine'], ['dev-2', 'a faire']])
  assert.ok(!tout(d).some(x => /\.tmp-/.test(x)))
})

test('tache : id inconnu, statut invalide, entrée invalide : code 1, plan intact', () => {
  const d = projet(); const avant = lire(plan(d))
  for (const j of [{ id: 'zzz', statut: 'termine' }, { id: 'dev-1', statut: 'fini' }, { id: 'dev-1' }, 'pas du json']) {
    const r = lancer(d, 'tache', j); assert.equal(r.status, 1, JSON.stringify(j)); sansTrace(r)
  }
  assert.equal(lire(plan(d)), avant)
})

// --- porte ---------------------------------------------------------------------------------------------------------

const portes = (d, slug = 'lea-dupont') => lire(join(d, '.pilotage', 'equipe', slug, 'portes.md'))

test('porte valider : refusée tant que des tâches sont ouvertes (liste, code 1, portes.md inchangé), acceptée ensuite', () => {
  const d = projet()
  const r = lancer(d, 'porte', { phase: 'dev', mode: 'valider' }, ...M)
  assert.equal(r.status, 1); sansTrace(r)
  assert.match(r.stderr, /Coder/); assert.match(r.stderr, /Tester/); assert.equal(portes(d), '')
  lancer(d, 'tache', { id: 'dev-1', statut: 'termine' }); lancer(d, 'tache', { id: 'dev-2', statut: 'reporte' })
  const ok = lancer(d, 'porte', { phase: 'dev', mode: 'valider' }, ...M)
  assert.equal(ok.status, 0, ok.stderr)
  assert.deepEqual(lirePortes(portes(d)).valides, ['dev'])
  assert.equal(lancer(d, 'porte', { phase: 'dev', mode: 'valider' }, ...M).status, 0) // idempotent
  assert.deepEqual(lirePortes(portes(d)).valides, ['dev'])
})

test('porte valider : une phase sans tâche se valide ; phase inconnue refusée', () => {
  const d = projet()
  assert.equal(lancer(d, 'porte', { phase: 'prod', mode: 'valider' }, ...M).status, 0)
  assert.equal(lancer(d, 'porte', { phase: 'nope', mode: 'valider' }, ...M).status, 1)
})

test('porte forcer et repondre : refusés sans --confirme ; avec, écrits (force: seul, refus: note)', () => {
  const d = projet()
  lancer(d, 'tache', { id: 'dev-1', statut: 'termine' }); lancer(d, 'tache', { id: 'dev-2', statut: 'abandonne' })
  assert.equal(lancer(d, 'porte', { phase: 'dev', mode: 'forcer' }, ...M).status, 1)
  assert.equal(lancer(d, 'porte', { phase: 'dev', mode: 'repondre', note: 'pas encore' }, ...M).status, 1)
  assert.equal(portes(d), '')
  assert.equal(lancer(d, 'porte', { phase: 'dev', mode: 'forcer' }, ...M, '--confirme').status, 0)
  assert.equal(lancer(d, 'porte', { phase: 'prod', mode: 'repondre', note: 'Revoir\n| piège' }, ...M, '--confirme').status, 0)
  const p = lirePortes(portes(d))
  assert.deepEqual(p.forces, ['dev']); assert.equal(p.refus.length, 1); assert.equal(p.refus[0].phase, 'prod')
  assert.equal(portes(d).split('\n').filter(l => l !== '').length, 2)
})

test('porte forcer : refusé aussi tant que des tâches de la phase sont ouvertes (jamais en silence)', () => {
  const d = projet()
  const r = lancer(d, 'porte', { phase: 'dev', mode: 'forcer' }, ...M, '--confirme')
  assert.equal(r.status, 1); assert.match(r.stderr, /Coder/); assert.equal(portes(d), '')
})

test('porte : mode inconnu, code 1 ; membre manquant, code 64', () => {
  const d = projet()
  assert.equal(lancer(d, 'porte', { phase: 'prod', mode: 'zzz' }, ...M).status, 1)
  assert.equal(lancer(d, 'porte', { phase: 'prod', mode: 'valider' }).status, 64)
})

// --- édition en place du plan et des portes (rien d'autre n'est perdu) ---------------------------------------------

test('tache : commentaire, titre, texte libre et section inconnue du plan restent intacts, seule la marque change', () => {
  const d = projet()
  const avant = '<!-- note equipe -->\n# Plan\nTexte libre\n\n## Dév (dev)\n\n- [ ] dev-1 | Coder\n- [ ] dev-2 | Tester\n\n## Divers (zzz)\n\n- [ ] zzz-1 | Autre\n\n## Prod (prod)\n'
  writeFileSync(plan(d), avant)
  const r = lancer(d, 'tache', { id: 'dev-1', statut: 'termine' })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(lire(plan(d)), avant.replace('- [ ] dev-1', '- [x] dev-1'))
  assert.ok(!tout(d).some(x => /\.tmp-/.test(x)))
})

test('tache : un plan en CRLF reste en CRLF', () => {
  const d = projet()
  const avant = '# Plan\r\n\r\n## Dév (dev)\r\n- [ ] dev-1 | Coder\r\n- [ ] dev-2 | Tester\r\n'
  writeFileSync(plan(d), avant)
  assert.equal(lancer(d, 'tache', { id: 'dev-2', statut: 'en cours' }).status, 0)
  assert.equal(lire(plan(d)), avant.replace('- [ ] dev-2', '- [~] dev-2'))
})

test('tache : identifiant en double ou inconnu : code 1, plan intact', () => {
  const d = projet()
  const avant = '## Dév (dev)\n- [ ] dev-1 | Coder\n- [ ] dev-1 | Encore\n'
  writeFileSync(plan(d), avant)
  const r = lancer(d, 'tache', { id: 'dev-1', statut: 'termine' })
  assert.equal(r.status, 1); assert.match(r.stderr, /plusieurs/); sansTrace(r)
  assert.equal(lancer(d, 'tache', { id: 'zzz', statut: 'termine' }).status, 1)
  assert.equal(lire(plan(d)), avant)
})

test('porte : les lignes écrites à la main dans portes.md sont conservées', () => {
  const d = projet()
  const f = join(d, '.pilotage', 'equipe', 'lea-dupont', 'portes.md')
  writeFileSync(f, '# mes notes\r\nporte: autre\r\nn importe quoi\r\n')
  assert.equal(lancer(d, 'porte', { phase: 'prod', mode: 'valider' }, ...M).status, 0)
  assert.equal(lire(f), '# mes notes\r\nporte: autre\r\nn importe quoi\r\nporte: prod\r\n')
})

test('porte : repondre puis valider/forcer, et l’inverse, ne laissent jamais d’entrées contradictoires', () => {
  const d = projet()
  const f = join(d, '.pilotage', 'equipe', 'lea-dupont', 'portes.md')
  assert.equal(lancer(d, 'porte', { phase: 'prod', mode: 'repondre', note: 'non' }, ...M, '--confirme').status, 0)
  assert.equal(lancer(d, 'porte', { phase: 'prod', mode: 'valider' }, ...M).status, 0)
  let p = lirePortes(lire(f)); assert.deepEqual(p.valides, ['prod']); assert.deepEqual(p.refus, [])
  assert.equal(lancer(d, 'porte', { phase: 'prod', mode: 'repondre', note: 'finalement non' }, ...M, '--confirme').status, 0)
  p = lirePortes(lire(f)); assert.deepEqual(p.valides, []); assert.deepEqual(p.forces, []); assert.equal(p.refus.length, 1)
  assert.equal(lancer(d, 'porte', { phase: 'prod', mode: 'forcer' }, ...M, '--confirme').status, 0)
  p = lirePortes(lire(f)); assert.deepEqual(p.forces, ['prod']); assert.deepEqual(p.refus, [])
})

test('porte : valider deux fois n’ajoute rien ; une autre phase garde ses entrées', () => {
  const d = projet()
  const f = join(d, '.pilotage', 'equipe', 'lea-dupont', 'portes.md')
  lancer(d, 'porte', { phase: 'prod', mode: 'valider' }, ...M)
  lancer(d, 'porte', { phase: 'prod', mode: 'valider' }, ...M)
  assert.equal(lire(f), 'porte: prod\n')
})

test('un fichier d\u2019entrée qui n\u2019est pas du JSON : message fixe, jamais le début du fichier (code 1, rien écrit)', () => {
  const d = projet()
  const avant = tout(d)
  const f = join(mkdtempSync(join(tmpdir(), 'entree-')), 'secret.json')
  writeFileSync(f, 'MOT-DE-PASSE-SECRET-1234 pas du json')
  const r = lancer(d, 'creer', f, ...M)
  assert.equal(r.status, 1)
  assert.match(r.stderr, /Le fichier d'entrée n'est pas un JSON valide\./)
  assert.ok(!/SECRET|Unexpected|position/.test(r.stderr + r.stdout), r.stderr)
  assert.deepEqual(tout(d), avant)
  const r2 = lancer(d, 'creer', '{ pas du json', ...M)
  assert.equal(r2.status, 1)
  assert.ok(!/Unexpected|position|pas du json/.test(r2.stderr), r2.stderr)
})
