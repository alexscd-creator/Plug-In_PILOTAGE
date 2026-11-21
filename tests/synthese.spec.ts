import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Tache } from '../hooks/model/plan.ts'
import type { Projet } from '../hooks/model/projet.ts'
import { DEFAUT_VOCABULAIRE } from '../hooks/model/projet.ts'
import { avancementGlobal, avancementPole, bandeauPorte, resumerPhases } from '../hooks/model/synthese.ts'

const projet: Projet = {
  version: 1, nom: 'D', but: 'b', fini: 'f', preset: 'p', equipe: ['Lea', 'Sam'], workflow: { outils: [] }, vocabulaire: { ...DEFAUT_VOCABULAIRE }, reglagesDef: [], reglages: {},
  poles: [{ id: 'code', titre: 'Code', couleur: 'bleu' }, { id: 'art', titre: 'Art' }, { id: 'vide', titre: 'Vide' }],
  phases: [{ id: 'p1', titre: 'Un', taches: [] }, { id: 'p2', titre: 'Deux', taches: [] }, { id: 'p3', titre: 'Trois', taches: [] }],
  agents: [
    { id: 'a1', titre: 'Alpha', pole: 'code', skills: [], pourquoi: '' },
    { id: 'a2', titre: 'Beta', pole: 'code', skills: [], pourquoi: '' },
    { id: 'a3', titre: 'Gamma', pole: 'art', skills: [], pourquoi: '' },
  ],
}
const t = (id: string, phase: string, statut: Tache['statut'], pole?: string): Tache => ({ id, phase, titre: id, statut, ...(pole ? { pole } : {}) })

test('avancementGlobal : abandonnées hors total, reportées dans le total mais pas faites', () => {
  const r = avancementGlobal([t('1', 'p1', 'termine'), t('2', 'p1', 'reporte'), t('3', 'p1', 'abandonne'), t('4', 'p1', 'a faire'), t('5', 'p1', 'en cours')])
  assert.deepEqual(r, { total: 4, faites: 1, pourcent: 25 })
})
test('avancementGlobal : plan vide = 0 sur 0, 0 %, et tout terminé = 100 %', () => {
  assert.deepEqual(avancementGlobal([]), { total: 0, faites: 0, pourcent: 0 })
  assert.deepEqual(avancementGlobal([t('1', 'p1', 'abandonne')]), { total: 0, faites: 0, pourcent: 0 })
  assert.equal(avancementGlobal([t('1', 'p1', 'termine')]).pourcent, 100)
  assert.equal(avancementGlobal([t('1', 'p1', 'termine'), t('2', 'p1', 'a faire'), t('3', 'p1', 'a faire')]).pourcent, 33)
})

test('resumerPhases : phase actuelle, rang sur le total, historique', () => {
  const portes = { Lea: { valides: ['p1'], forces: [], refus: [] }, Sam: { valides: ['p1'], forces: [], refus: [] } }
  const r = resumerPhases(projet, [], 'Lea', portes)
  assert.equal(r.actuelle?.id, 'p2')
  assert.equal(r.indice, 2)
  assert.equal(r.sur, 3)
  assert.deepEqual(r.historique.map(h => h.etat), ['terminee', 'en-cours', 'a-venir'])
})
test('resumerPhases : sans porte on est en phase 1 ; sans phase, rien', () => {
  const r = resumerPhases(projet, [], 'Lea', {})
  assert.equal(r.actuelle?.id, 'p1')
  assert.equal(r.indice, 1)
  const v = resumerPhases({ ...projet, phases: [] }, [], 'Lea', {})
  assert.deepEqual({ a: v.actuelle, i: v.indice, s: v.sur, h: v.historique }, { a: null, i: 0, s: 0, h: [] })
})

test('avancementPole : tâches rattachées et agents du pôle', () => {
  const l = [t('1', 'p1', 'termine', 'code'), t('2', 'p1', 'a faire', 'code'), t('3', 'p1', 'termine', 'art'), t('4', 'p1', 'a faire')]
  const code = avancementPole(projet, l, 'code')
  assert.deepEqual({ t: code.total, f: code.faites, p: code.pourcent, a: code.agents.map(x => x.id) }, { t: 2, f: 1, p: 50, a: ['a1', 'a2'] })
  const vide = avancementPole(projet, l, 'vide')
  assert.deepEqual({ t: vide.total, f: vide.faites, p: vide.pourcent, a: vide.agents }, { t: 0, f: 0, p: 0, a: [] })
  assert.equal(avancementPole(projet, l, 'inconnu').total, 0)
})

test('bandeauPorte : bloquée tant qu’une tâche est à faire ou en cours', () => {
  const l = [t('1', 'p2', 'termine'), t('2', 'p2', 'en cours'), t('3', 'p2', 'reporte'), t('4', 'p1', 'a faire')]
  const r = bandeauPorte(l, 'p2')
  assert.equal(r.bloquee, true)
  assert.deepEqual(r.ouvertes.map(x => x.id), ['2'])
  assert.deepEqual(bandeauPorte([t('1', 'p2', 'abandonne')], 'p2'), { bloquee: false, ouvertes: [] })
  assert.deepEqual(bandeauPorte([], ''), { bloquee: false, ouvertes: [] })
})
