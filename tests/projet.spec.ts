import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseProjet, serializeProjet, memeMembre } from '../hooks/model/projet.ts'
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
