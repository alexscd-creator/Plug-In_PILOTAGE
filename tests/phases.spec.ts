import assert from 'node:assert/strict'
import { test } from 'node:test'

import { etatPorte, historique, lirePortes, phaseActuelle, serializePortes } from '../hooks/model/phases.ts'
import type { Portes } from '../hooks/model/phases.ts'
import type { PhaseDef } from '../hooks/model/projet.ts'

const phases: PhaseDef[] = [
  { id: 'cadrage', titre: 'Cadrage', taches: [] },
  { id: 'maquettes', titre: 'Maquettes', taches: [] },
  { id: 'livraison', titre: 'Livraison', taches: [] },
]
const vide: Portes = { valides: [], forces: [], refus: [] }
const a = (o: Partial<Portes>): Portes => ({ ...vide, ...o })

test('aller-retour : validées, forcées et refus avec notes', () => {
  const p: Portes = { valides: ['cadrage'], forces: ['maquettes'], refus: [{ phase: 'cadrage', note: 'il manque une source' }] }
  assert.deepEqual(lirePortes(serializePortes(p)), p)
  assert.equal(serializePortes(p), 'porte: cadrage\nforce: maquettes | seul\nrefus: cadrage | il manque une source\n')
})

test('fichier tronqué, vide ou avec lignes inconnues : ignoré sans exception', () => {
  assert.deepEqual(lirePortes(''), vide)
  assert.deepEqual(lirePortes('n’importe quoi'), vide)
  assert.deepEqual(lirePortes('porte:\nforce\nrefus: | x\nzzz: cadrage\nporte: a | b | c'), a({ valides: ['a'] }))
  assert.deepEqual(lirePortes('porte: cadrage\r\nporte: cadrage\r\nrefus: mockup'), a({ valides: ['cadrage'], refus: [{ phase: 'mockup', note: '' }] }))
})

test('la note d’un refus reste du texte brut (aucune interprétation)', () => {
  const p = lirePortes('refus: cadrage | <b>${x}</b> | suite')
  assert.equal(p.refus[0]!.note, '<b>${x}</b> | suite')
  assert.deepEqual(lirePortes(serializePortes(p)), p)
})

test('phases d’un autre projet : seul, valider suffit', () => {
  assert.equal(phaseActuelle('alex', phases, { alex: vide }), 'cadrage')
  assert.equal(phaseActuelle('alex', phases, { alex: a({ valides: ['cadrage'] }) }), 'maquettes')
  assert.equal(phaseActuelle('alex', [], { alex: vide }), '')
})

test('équipe d’un seul membre : seule sa porte compte, même si le dossier d’un autre existe vide', () => {
  assert.equal(etatPorte('alex', 'cadrage', phases, { alex: a({ valides: ['cadrage'] }) }), 'validee-a-deux')
  assert.equal(etatPorte('alex', 'cadrage', phases, { alex: vide }), 'a-valider')
})

test('à deux : il faut l’autre ou forcer ; chacun a sa phase', () => {
  const alexOk = a({ valides: ['cadrage'] })
  assert.equal(phaseActuelle('alex', phases, { alex: alexOk, sam: vide }), 'cadrage')
  assert.equal(phaseActuelle('alex', phases, { alex: alexOk, sam: alexOk }), 'maquettes')
  assert.equal(phaseActuelle('sam', phases, { alex: alexOk, sam: vide }), 'cadrage')
  assert.equal(phaseActuelle('alex', phases, { alex: a({ forces: ['cadrage'] }), sam: vide }), 'maquettes')
})

test('une porte plus loin vaut franchie pour les phases précédentes', () => {
  assert.equal(phaseActuelle('alex', phases, { alex: a({ valides: ['livraison'] }), sam: vide }), 'livraison')
  assert.equal(phaseActuelle('alex', phases, { alex: a({ valides: ['maquettes'] }) }), 'livraison')
  assert.equal(phaseActuelle('alex', phases, { alex: a({ forces: ['maquettes'] }), sam: vide }), 'livraison')
})

test('un forçage compte comme validation pour l’associé', () => {
  const alex = a({ forces: ['cadrage'] })
  assert.equal(phaseActuelle('sam', phases, { alex, sam: a({ valides: ['cadrage'] }) }), 'maquettes')
  assert.equal(etatPorte('alex', 'cadrage', phases, { alex, sam: a({ valides: ['cadrage'] }) }), 'validee-a-deux')
  assert.equal(etatPorte('alex', 'cadrage', phases, { alex, sam: vide }), 'forcee-sans-l-autre')
})

test('etatPorte : les cinq états', () => {
  assert.equal(etatPorte('alex', 'cadrage', phases, { alex: vide, sam: vide }), 'a-valider')
  assert.equal(etatPorte('alex', 'cadrage', phases, { alex: a({ valides: ['cadrage'] }), sam: vide }), 'en-attente-de-l-autre')
  assert.equal(etatPorte('alex', 'cadrage', phases, { alex: a({ valides: ['cadrage'] }), sam: a({ valides: ['cadrage'] }) }), 'validee-a-deux')
  assert.equal(
    etatPorte('alex', 'cadrage', phases, { alex: a({ valides: ['cadrage'] }), sam: a({ refus: [{ phase: 'cadrage', note: 'x' }] }) }),
    'refusee-par-l-autre',
  )
})

test('les noms de membres sont appariés avec memeMembre', () => {
  const par = { 'jean luc': a({ valides: ['cadrage'] }), sam: a({ valides: ['cadrage'] }) }
  assert.equal(phaseActuelle('Jean-Luc', phases, par), 'maquettes')
  assert.equal(etatPorte('SAM', 'cadrage', phases, par), 'validee-a-deux')
})

test('historique : terminée / en cours / à venir et franchie', () => {
  const par = { alex: a({ valides: ['cadrage'], forces: ['maquettes'] }), sam: a({ valides: ['cadrage'] }) }
  assert.deepEqual(historique('alex', phases, par), [
    { phase: phases[0], etat: 'terminee', franchie: 'a-deux' },
    { phase: phases[1], etat: 'terminee', franchie: 'forcee' },
    { phase: phases[2], etat: 'en-cours', franchie: null },
  ])
  assert.deepEqual(historique('alex', phases, { alex: vide }).map(h => h.etat), ['en-cours', 'a-venir', 'a-venir'])
})

test('historique : après la dernière phase, tout est terminé', () => {
  const tout = a({ valides: ['cadrage', 'maquettes', 'livraison'] })
  assert.deepEqual(historique('alex', phases, { alex: tout }).map(h => h.etat), ['terminee', 'terminee', 'terminee'])
  assert.equal(phaseActuelle('alex', phases, { alex: tout }), 'livraison')
})

test('serializePortes : aucun identifiant ne peut créer une ligne ou une entrée de plus', () => {
  const n = (p: Portes): number => p.valides.length + p.forces.length + p.refus.length
  const cas: Portes[] = [
    a({ valides: ['a\nporte: x'] }),
    a({ forces: ['a\nporte: x'] }),
    a({ refus: [{ phase: 'a\nporte: x', note: 'n' }] }),
    a({ refus: [{ phase: 'a | b', note: 'n' }] }),
    a({ valides: ['a\r\nforce: y | seul'] }),
  ]
  for (const p of cas) {
    const lu = lirePortes(serializePortes(p))
    assert.equal(n(lu), n(p))
    assert.equal(lu.valides.length, p.valides.length)
    assert.equal(lu.forces.length, p.forces.length)
    assert.equal(lu.refus.length, p.refus.length)
    assert.equal(serializePortes(p).trimEnd().split('\n').length, n(p))
  }
})

test('historique : une phase passée seulement grâce à une porte plus loin est « sautee »', () => {
  const h = historique('alex', phases, { alex: a({ valides: ['livraison'] }), sam: vide })
  assert.deepEqual(h.map(x => [x.etat, x.franchie]), [['terminee', 'sautee'], ['terminee', 'sautee'], ['en-cours', null]])
  const seul = historique('alex', phases, { alex: a({ valides: ['maquettes'] }) })
  assert.deepEqual(seul.map(x => [x.etat, x.franchie]), [['terminee', 'sautee'], ['terminee', 'a-deux'], ['en-cours', null]])
})
