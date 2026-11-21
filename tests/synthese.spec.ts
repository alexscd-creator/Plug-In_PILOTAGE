import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Tache } from '../hooks/model/plan.ts'
import type { Projet } from '../hooks/model/projet.ts'
import { DEFAUT_VOCABULAIRE } from '../hooks/model/projet.ts'
import { avancementGlobal, avancementPole, bandeauPorte, detailPhase, resumerPhases } from '../hooks/model/synthese.ts'

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

test('resumerPhases : toutes les phases franchies = aucune phase actuelle, rang 0', () => {
  const tout = { valides: ['p1', 'p2', 'p3'], forces: [], refus: [] }
  const r = resumerPhases(projet, [], 'Lea', { Lea: tout, Sam: tout })
  assert.equal(r.actuelle, null)
  assert.equal(r.indice, 0)
  assert.equal(r.sur, 3)
  assert.ok(r.historique.every(h => h.etat === 'terminee'))
})
test('resumerPhases : membre inconnu ou vide = aucune porte à son nom, donc phase 1 par défaut', () => {
  const p = { valides: ['p1'], forces: [], refus: [] }
  for (const moi of ['', 'Zoe']) {
    const r = resumerPhases(projet, [], moi, { Lea: p, Sam: p })
    assert.equal(r.actuelle?.id, 'p1', moi)
    assert.equal(r.indice, 1)
  }
})

const f = (id: string, phase: string, statut: Tache['statut'], fichier?: string): Tache => ({ id, phase, titre: id, statut, ...(fichier ? { fichier } : {}) })
const v = (...ids: string[]) => ({ valides: ids, forces: [] as string[], refus: [] as { phase: string; note: string }[] })

test('detailPhase : phase terminée à deux, tâches fermées comprises, fichiers distincts, reportées et abandonnées', () => {
  const l = [f('1', 'p1', 'termine', 'a.md'), f('2', 'p1', 'reporte', 'a.md'), f('3', 'p1', 'abandonne', 'b.md'), f('4', 'p1', 'reporte'), f('5', 'p2', 'a faire', 'c.md')]
  const d = detailPhase(projet, l, 'p1', 'Lea', { Lea: v('p1'), Sam: v('p1') })!
  assert.equal(d.phase.id, 'p1')
  assert.equal(d.indice, 1)
  assert.equal(d.etat, 'terminee')
  assert.equal(d.franchie, 'a-deux')
  assert.equal(d.porte, 'a-deux')
  assert.deepEqual(d.taches.map(x => x.id), ['1', '2', '3', '4'])
  assert.deepEqual(d.fichiers, ['a.md', 'b.md'])
  assert.deepEqual({ r: d.reportees, a: d.abandonnees }, { r: 2, a: 1 })
  assert.deepEqual(d.avancement, { total: 3, faites: 1, pourcent: 33 })
})
test('detailPhase : forcée, passée (porte plus loin), en attente, à valider', () => {
  const forcee = { valides: [], forces: ['p1'], refus: [] }
  assert.equal(detailPhase(projet, [], 'p1', 'Lea', { Lea: forcee, Sam: v() })!.porte, 'forcee')
  assert.equal(detailPhase(projet, [], 'p1', 'Lea', { Lea: v('p2'), Sam: v('p2') })!.porte, 'passee')
  assert.equal(detailPhase(projet, [], 'p1', 'Lea', { Lea: v('p1'), Sam: v() })!.porte, 'en-attente')
  assert.equal(detailPhase(projet, [], 'p2', 'Lea', { Lea: v('p1'), Sam: v('p1') })!.porte, 'a-valider')
  const refus = { valides: [], forces: [], refus: [{ phase: 'p1', note: 'x' }] }
  assert.equal(detailPhase(projet, [], 'p1', 'Lea', { Lea: v('p1'), Sam: refus })!.porte, 'refusee')
})
test('detailPhase : identifiant vide ou inconnu = phase actuelle ; tout franchi = dernière ; sans phase = null', () => {
  const p = { Lea: v('p1'), Sam: v('p1') }
  assert.equal(detailPhase(projet, [], '', 'Lea', p)!.phase.id, 'p2')
  assert.equal(detailPhase(projet, [], 'zzz', 'Lea', p)!.phase.id, 'p2')
  const tout = { Lea: v('p1', 'p2', 'p3'), Sam: v('p1', 'p2', 'p3') }
  assert.equal(detailPhase(projet, [], '', 'Lea', tout)!.phase.id, 'p3')
  assert.equal(detailPhase({ ...projet, phases: [] }, [], '', 'Lea', {}), null)
})
test('detailPhase : membre inconnu = porte « inconnu »', () => {
  assert.equal(detailPhase(projet, [], 'p1', '', {})!.porte, 'inconnu')
})

test('detailPhase : équipe d’un seul membre, une porte validée seul est « validee », jamais « a-deux »', () => {
  const solo = { ...projet, equipe: ['Lea'] }
  const d = detailPhase(solo, [], 'p1', 'Lea', { Lea: v('p1') })!
  assert.equal(d.etat, 'terminee')
  assert.equal(d.porte, 'validee')
})
test('detailPhase : équipe d’un seul membre, porte forcée reste « forcee »', () => {
  const solo = { ...projet, equipe: ['Lea'] }
  assert.equal(detailPhase(solo, [], 'p1', 'Lea', { Lea: { valides: [], forces: ['p1'], refus: [] } })!.porte, 'forcee')
})
test('detailPhase : équipe de deux, validée par un seul = en attente de l’associé (pas « a-deux »)', () => {
  const d = detailPhase(projet, [], 'p1', 'Lea', { Lea: v('p1'), Sam: v() })!
  assert.equal(d.porte, 'en-attente')
  assert.equal(d.etat, 'en-cours')
})
test('detailPhase : un membre qui n’est pas dans l’équipe = porte « inconnu », rien de franchi', () => {
  const tout = { Lea: v('p1', 'p2'), Sam: v('p1', 'p2'), Zoe: v('p1', 'p2') }
  for (const moi of ['Zoe', '']) {
    const d = detailPhase(projet, [], 'p1', moi, tout)!
    assert.equal(d.porte, 'inconnu', moi)
    assert.equal(d.franchie, null, moi)
    assert.equal(d.etat, 'en-cours', moi)
  }
})
