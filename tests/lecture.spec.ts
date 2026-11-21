import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { FsLike } from '../hooks/model/activation.ts'
import { lireProjetComplet } from '../hooks/model/lecture.ts'
import { DEFAUT_VOCABULAIRE } from '../hooks/model/projet.ts'
import type { Projet } from '../hooks/model/projet.ts'

const projet: Projet = {
  version: 1, nom: 'Mon projet', but: 'b', fini: 'f', preset: 'autre', equipe: ['Léa', 'Jean-Luc'],
  poles: [{ id: 'code', titre: 'Code', couleur: 'bleu' }], phases: [{ id: 'p1', titre: 'Idées', taches: ['a'] }],
  agents: [], workflow: { outils: [] }, vocabulaire: { ...DEFAUT_VOCABULAIRE }, reglagesDef: [], reglages: {},
}
const PLAN = '## Idées (p1)\n\n- [x] p1-1 | Faire a | fichier: docs/a.md | auteur: Léa\n- [ ] p1-2 | Faire b\n'
const R = 'C:/Projet/.pilotage'

/** Faux disque : chemins en barres obliques ; `casses` lèvent à la lecture, `panneListe` à la liste. */
function fsDe(fichiers: Record<string, string>, casses: string[] = [], panneListe: string[] = []): FsLike {
  const sl = (p: string) => p.replaceAll(String.fromCharCode(92), '/')
  return {
    read: async p => {
      const c = sl(p)
      if (casses.includes(c)) throw new Error('illisible')
      const t = fichiers[c]
      if (t === undefined) throw new Error('absent')
      return t
    },
    list: async p => {
      const c = sl(p).replace(/\/$/, '')
      if (panneListe.includes(c)) throw new Error('liste en panne')
      const pre = c + '/'
      const noms = new Set<string>()
      for (const f of [...Object.keys(fichiers), ...casses]) if (f.startsWith(pre)) noms.add(f.slice(pre.length).split('/')[0]!)
      if (noms.size === 0) throw new Error('dossier absent')
      return [...noms]
    },
  }
}
const base = (extra: Record<string, string> = {}) => ({ [`${R}/projet.json`]: JSON.stringify(projet), [`${R}/plan.md`]: PLAN, ...extra })

test('projet, plan et portes de deux membres : lecture complète', async () => {
  const r = await lireProjetComplet(fsDe(base({
    [`${R}/equipe/lea/portes.md`]: 'porte: p1\n',
    [`${R}/equipe/jean-luc/portes.md`]: 'refus: p1 | pas encore\n',
  })), 'C:/Projet', 'Léa')
  assert.deepEqual(r.erreurs, [])
  assert.equal(r.projet?.nom, 'Mon projet')
  assert.deepEqual(r.taches.map(t => [t.id, t.statut]), [['p1-1', 'termine'], ['p1-2', 'a faire']])
  assert.deepEqual(r.portes['Léa'], { valides: ['p1'], forces: [], refus: [] })
  assert.deepEqual(r.portes['Jean-Luc'], { valides: [], forces: [], refus: [{ phase: 'p1', note: 'pas encore' }] })
  assert.equal(Object.keys(r.portes)[0], 'Léa')
})

test('dossiers de membres : accents, casse et tirets se rapprochent du prénom du projet', async () => {
  const r = await lireProjetComplet(fsDe(base({
    [`${R}/equipe/LEA/portes.md`]: 'porte: p1\n',
    [`${R}/equipe/jean luc/portes.md`]: 'porte: p1\n',
  })), 'C:/Projet', 'Jean-Luc')
  assert.deepEqual(r.portes['Léa']?.valides, ['p1'])
  assert.deepEqual(r.portes['Jean-Luc']?.valides, ['p1'])
  assert.equal(Object.keys(r.portes)[0], 'Jean-Luc')
})

test('copies de conflit ignorées : dossier de membre et fichier de portes', async () => {
  const r = await lireProjetComplet(fsDe(base({
    [`${R}/equipe/lea/portes.md`]: 'porte: p1\n',
    [`${R}/equipe/lea/portes (1).md`]: 'porte: p9\n',
    [`${R}/equipe/lea (1)/portes.md`]: 'porte: p8\n',
    [`${R}/equipe/Copie de lea/portes.md`]: 'porte: p7\n',
  })), 'C:/Projet', 'Léa')
  assert.deepEqual(r.portes['Léa']?.valides, ['p1'])
  assert.deepEqual(r.erreurs, [])
})

test('dossiers manquants : portes vides pour chaque membre, aucune erreur', async () => {
  const r = await lireProjetComplet(fsDe(base()), 'C:/Projet', 'Léa')
  assert.deepEqual(r.portes, { 'Léa': { valides: [], forces: [], refus: [] }, 'Jean-Luc': { valides: [], forces: [], refus: [] } })
  assert.deepEqual(r.erreurs, [])
})

test('plan absent : aucune tâche, sans erreur', async () => {
  const r = await lireProjetComplet(fsDe({ [`${R}/projet.json`]: JSON.stringify(projet) }), 'C:/Projet', 'Léa')
  assert.deepEqual(r.taches, [])
  assert.deepEqual(r.erreurs, [])
})

test('plan et portes illisibles : vides, avec les erreurs en français', async () => {
  const r = await lireProjetComplet(
    fsDe(base({ [`${R}/equipe/lea/portes.md`]: 'x' }), [`${R}/plan.md`, `${R}/equipe/lea/portes.md`]),
    'C:/Projet', 'Léa',
  )
  assert.deepEqual(r.taches, [])
  assert.deepEqual(r.portes['Léa'], { valides: [], forces: [], refus: [] })
  assert.equal(r.erreurs.length, 2)
  assert.match(r.erreurs[0]!, /plan\.md/)
  assert.match(r.erreurs[1]!, /portes/)
  assert.match(r.erreurs[1]!, /Léa/)
})

test('liste du dossier des membres en panne : portes vides et une erreur', async () => {
  const r = await lireProjetComplet(fsDe(base({ [`${R}/equipe/lea/portes.md`]: 'porte: p1\n' }), [], [`${R}/equipe`]), 'C:/Projet', 'Léa')
  assert.deepEqual(r.portes['Léa']?.valides, [])
  assert.equal(r.erreurs.length, 1)
})

test('projet invalide : erreurs du modèle, rien d’autre n’est lu', async () => {
  const r = await lireProjetComplet(fsDe({ [`${R}/projet.json`]: '{"version":2}', [`${R}/plan.md`]: PLAN }), 'C:/Projet', 'Léa')
  assert.equal(r.projet, null)
  assert.ok(r.erreurs.length > 0)
  assert.deepEqual(r.taches, [])
  assert.deepEqual(r.portes, {})
})

test('projet absent ou disque en panne : projet nul, jamais d’exception', async () => {
  const vide = await lireProjetComplet(fsDe({ 'C:/Autre/x.txt': 'a' }), 'C:/Projet', 'Léa')
  assert.equal(vide.projet, null)
  const panne: FsLike = { read: async () => { throw new Error('x') }, list: async () => { throw new Error('x') } }
  const r = await lireProjetComplet(panne, 'C:/Projet', 'Léa')
  assert.equal(r.projet, null)
  assert.ok(r.erreurs.length >= 1)
  const mauvais = await lireProjetComplet(fsDe({}), '', '')
  assert.equal(mauvais.projet, null)
})
