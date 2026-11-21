import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseProjet, serializeProjet, memeMembre, DEFAUT_VOCABULAIRE } from '../hooks/model/projet.ts'
import type { Projet } from '../hooks/model/projet.ts'

const valide = (): Projet => ({
  version: 1,
  nom: 'Mon jeu',
  but: 'Sortir un jeu',
  fini: 'Publié',
  preset: 'roblox',
  equipe: ['Léa', 'Sam'],
  poles: [{ id: 'code', titre: 'Code' }, { id: 'art', titre: 'Art' }],
  phases: [
    { id: 'p1', titre: 'Idées', taches: ['Brainstorm'] },
    { id: 'p2', titre: 'Prototype', taches: [] },
  ],
  agents: [{ id: 'dev', titre: 'Développeur', pole: 'code', skills: ['luau'], pourquoi: 'Écrit le code' }],
  workflow: { outils: [{ role: 'éditeur', outil: 'Studio' }] },
  vocabulaire: { type: 'Site web', nomDuProjet: 'Nom du site', leProjet: 'le site', unProjet: 'un site', objectif: 'Objectif du site', fini: 'Ce que « en ligne » veut dire' },
  reglagesDef: [
    { id: 'domaine', libelle: 'Domaine', genre: 'texte', aide: 'Adresse du site' },
    { id: 'hebergement', libelle: 'Hébergement', genre: 'choix', options: ['à choisir', 'cloud'], defaut: 'à choisir' },
    { id: 'paiement', libelle: 'Paiement', genre: 'oui-non', defaut: false },
  ],
  reglages: { domaine: 'exemple.fr', hebergement: 'cloud', paiement: true },
})

const erreurs = (o: unknown): string[] => {
  const r = parseProjet(typeof o === 'string' ? o : JSON.stringify(o))
  assert.equal(r.ok, false)
  return r.ok ? [] : r.erreurs
}

test('aller-retour parse -> serialize -> parse', () => {
  const p = valide()
  const r1 = parseProjet(JSON.stringify(p))
  assert.equal(r1.ok, true)
  if (!r1.ok) return
  assert.deepEqual(r1.projet, p)
  const texte = serializeProjet(r1.projet)
  const r2 = parseProjet(texte)
  assert.equal(r2.ok, true)
  if (r2.ok) assert.deepEqual(r2.projet, p)
  assert.equal(serializeProjet(p), texte)
  assert.ok(texte.includes('\n  "version": 1'))
  assert.ok(texte.indexOf('"version"') < texte.indexOf('"nom"'))
})

test('JSON invalide refusé', () => {
  assert.ok(erreurs('{pas du json').length > 0)
  assert.ok(erreurs('[]').length > 0)
})

test('version différente de 1 refusée', () => {
  assert.ok(erreurs({ ...valide(), version: 2 }).some(e => e.includes('version')))
})

test('équipe vide ou de 4 membres refusée', () => {
  assert.ok(erreurs({ ...valide(), equipe: [] }).some(e => e.includes('équipe')))
  assert.ok(erreurs({ ...valide(), equipe: ['a', 'b', 'c', 'd'] }).some(e => e.includes('équipe')))
})

test('deux phases de même id refusées', () => {
  const p = valide()
  p.phases[1]!.id = 'p1'
  assert.ok(erreurs(p).some(e => e.includes('p1')))
})

test('agent dont le pôle est inconnu refusé', () => {
  const p = valide()
  p.agents[0]!.pole = 'musique'
  assert.ok(erreurs(p).some(e => e.includes('musique')))
})

test('phase sans titre refusée', () => {
  const p = valide()
  p.phases[0]!.titre = ''
  assert.ok(erreurs(p).some(e => e.includes('titre')))
})

test('toutes les erreurs sont listées d\'un coup, sans exception', () => {
  const p = { ...valide(), version: 3, equipe: [] }
  p.phases[0]!.titre = ''
  p.agents[0]!.pole = 'zzz'
  assert.ok(erreurs(p).length >= 4)
  assert.doesNotThrow(() => parseProjet('null'))
  assert.doesNotThrow(() => parseProjet('{"phases":5,"agents":"x","poles":null}'))
})

test('memeMembre', () => {
  assert.equal(memeMembre('Léa', 'lea'), true)
  assert.equal(memeMembre('jean-luc', 'jean luc'), true)
  assert.equal(memeMembre('Jean_Luc2', 'JEAN LUC'), true)
  assert.equal(memeMembre('alex', 'sam'), false)
})

const sansNouveaux = () => { const { vocabulaire, reglagesDef, reglages, ...reste } = valide(); void vocabulaire; void reglagesDef; void reglages; return reste }

test('compatibilité : un fichier sans vocabulaire ni réglages est accepté et complété par le défaut neutre', () => {
  const r = parseProjet(JSON.stringify(sansNouveaux()))
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.equal(r.projet.version, 1)
  assert.deepEqual(r.projet.vocabulaire, DEFAUT_VOCABULAIRE)
  assert.deepEqual(r.projet.reglagesDef, [])
  assert.deepEqual(r.projet.reglages, {})
  assert.equal(DEFAUT_VOCABULAIRE.nomDuProjet, 'Nom du projet')
  assert.equal(DEFAUT_VOCABULAIRE.leProjet, 'le projet')
  assert.equal(DEFAUT_VOCABULAIRE.unProjet, 'un projet')
  assert.equal(DEFAUT_VOCABULAIRE.objectif, 'Objectif du projet')
  assert.equal(DEFAUT_VOCABULAIRE.fini, 'Ce que « fini » veut dire')
})

test('serializeProjet écrit les nouveaux champs après workflow, dans un ordre fixe', () => {
  const t = serializeProjet(valide())
  const ordre = ['"workflow"', '"vocabulaire"', '"reglagesDef"', '"reglages"'].map(k => t.indexOf(k))
  assert.ok(ordre.every(i => i > 0), 'toutes les clés présentes')
  assert.deepEqual([...ordre].sort((a, b) => a - b), ordre)
  const v = t.indexOf('"vocabulaire"')
  const pos = ['"type"', '"nomDuProjet"', '"leProjet"', '"unProjet"', '"objectif"'].map(k => t.indexOf(k, v))
  assert.deepEqual([...pos].sort((a, b) => a - b), pos)
  assert.ok(pos.every(i => i > v))
})

test('vocabulaire invalide : erreurs françaises nommant le champ', () => {
  assert.ok(erreurs({ ...valide(), vocabulaire: 'x' }).some(e => e.includes('vocabulaire')))
  assert.ok(erreurs({ ...valide(), vocabulaire: [] }).some(e => e.includes('vocabulaire')))
  for (const cle of ['type', 'nomDuProjet', 'leProjet', 'unProjet', 'objectif', 'fini']) {
    const v: Record<string, unknown> = { ...valide().vocabulaire }
    v[cle] = ''
    assert.ok(erreurs({ ...valide(), vocabulaire: v }).some(e => e.includes('vocabulaire') && e.includes(cle)), cle)
    delete v[cle]
    assert.ok(erreurs({ ...valide(), vocabulaire: v }).some(e => e.includes('vocabulaire') && e.includes(cle)), cle)
  }
})

test('reglagesDef invalide : forme, id, doublon, genre, options, défaut', () => {
  const def = (o: Record<string, unknown>) => ({ ...valide(), reglagesDef: [o], reglages: {} })
  assert.ok(erreurs({ ...valide(), reglagesDef: 'x', reglages: {} }).some(e => e.includes('reglagesDef')))
  assert.ok(erreurs(def({ id: 'Bad Id', libelle: 'X', genre: 'texte' })).some(e => e.includes('Bad Id')))
  assert.ok(erreurs(def({ id: '', libelle: 'X', genre: 'texte' })).some(e => e.includes('identifiant')))
  assert.ok(erreurs(def({ id: 'a', libelle: '', genre: 'texte' })).some(e => e.includes('libellé')))
  assert.ok(erreurs(def({ id: 'a', libelle: 'X', genre: 'nombre' })).some(e => e.includes('genre')))
  assert.ok(erreurs(def({ id: 'a', libelle: 'X', genre: 'choix' })).some(e => e.includes('options')))
  assert.ok(erreurs(def({ id: 'a', libelle: 'X', genre: 'choix', options: [] })).some(e => e.includes('options')))
  assert.ok(erreurs(def({ id: 'a', libelle: 'X', genre: 'choix', options: ['x'], defaut: 'y' })).some(e => e.includes('défaut')))
  assert.ok(erreurs(def({ id: 'a', libelle: 'X', genre: 'oui-non', defaut: 'oui' })).some(e => e.includes('défaut')))
  assert.ok(erreurs(def({ id: 'a', libelle: 'X', genre: 'texte', defaut: true })).some(e => e.includes('défaut')))
  assert.ok(erreurs(def({ id: 'a', libelle: 'X', genre: 'texte', options: ['x'] })).some(e => e.includes('options')))
  assert.ok(erreurs(def({ id: 'a', libelle: 'X', genre: 'texte', aide: 3 })).some(e => e.includes('aide')))
  const deux = { ...valide(), reglagesDef: [{ id: 'a', libelle: 'A', genre: 'texte' }, { id: 'a', libelle: 'B', genre: 'texte' }], reglages: {} }
  assert.ok(erreurs(deux).some(e => e.includes('« a »') && e.includes('deux fois')))
})

test('reglages invalide : id inconnu, type qui ne convient pas, valeur hors options', () => {
  const avec = (reglages: unknown) => ({ ...valide(), reglages })
  assert.ok(erreurs(avec([])).some(e => e.includes('reglages')))
  assert.ok(erreurs(avec({ inconnu: 'x' })).some(e => e.includes('inconnu')))
  assert.ok(erreurs(avec({ paiement: 'oui' })).some(e => e.includes('paiement')))
  assert.ok(erreurs(avec({ domaine: true })).some(e => e.includes('domaine')))
  assert.ok(erreurs(avec({ hebergement: 'mutualisé' })).some(e => e.includes('hebergement')))
  assert.ok(erreurs(avec({ hebergement: 3 })).some(e => e.includes('hebergement')))
})

test('toutes les erreurs de vocabulaire et de réglages sont listées ensemble, jamais d\'exception', () => {
  const r = parseProjet(JSON.stringify({ ...valide(), vocabulaire: { type: '' }, reglagesDef: [{ id: 'A b' }], reglages: { z: 1 } }))
  assert.equal(r.ok, false)
  if (!r.ok) assert.ok(r.erreurs.length >= 4)
  for (const bad of [null, 5, 'x', [], {}]) {
    assert.doesNotThrow(() => parseProjet(JSON.stringify({ ...valide(), vocabulaire: bad, reglagesDef: bad, reglages: bad })))
  }
})

test('agent : « outils » facultatif, lu tel quel, refusé s\'il n\'est pas une liste de textes, gardé à l\'écriture', () => {
  const p = valide()
  p.agents[0]!.outils = ['Read', 'Edit']
  const r = parseProjet(serializeProjet(p))
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(r.projet.agents[0]!.outils, ['Read', 'Edit'])
  const sans = parseProjet(serializeProjet(valide()))
  assert.ok(sans.ok)
  if (sans.ok) assert.equal('outils' in sans.projet.agents[0]!, false)
  assert.equal(parseProjet(JSON.stringify({ ...valide(), agents: [{ ...valide().agents[0], outils: 'Read' }] })).ok, false)
})

test('plafonds : pourquoi 500, skill 60, 20 skills, rôle/outil de workflow 120, 30 lignes de workflow, avec des erreurs en français', () => {
  const a = (x: object) => ({ ...valide(), agents: [{ ...valide().agents[0], ...x }] })
  const e1 = erreurs(a({ pourquoi: 'p'.repeat(501) }))
  assert.ok(e1.some(e => e.includes('pourquoi') && e.includes('500')), e1.join('|'))
  const e2 = erreurs(a({ skills: ['s'.repeat(61)] }))
  assert.ok(e2.some(e => e.includes('skill') && e.includes('60')), e2.join('|'))
  const e3 = erreurs(a({ skills: Array.from({ length: 21 }, (_, i) => `s${i}`) }))
  assert.ok(e3.some(e => e.includes('20')), e3.join('|'))
  const wf = (o: object[]) => ({ ...valide(), workflow: { outils: o } })
  assert.ok(erreurs(wf([{ role: 'r'.repeat(121), outil: 'x' }])).some(e => e.includes('120')))
  assert.ok(erreurs(wf([{ role: 'r', outil: 'o'.repeat(121) }])).some(e => e.includes('120')))
  assert.ok(erreurs(wf(Array.from({ length: 31 }, () => ({ role: 'r', outil: 'o' })))).some(e => e.includes('30')))
  assert.equal(parseProjet(JSON.stringify(a({ pourquoi: 'p'.repeat(500), skills: ['s'.repeat(60)] }))).ok, true)
})
