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

// --- chantiers ---
import { lireChantiers } from '../hooks/model/lecture.ts'
import { serializeChantier } from '../hooks/model/chantier.ts'
import type { Chantier } from '../hooks/model/chantier.ts'

const chantier = (id: string, extra: Partial<Chantier> = {}): Chantier => ({
  id, titre: `Chantier ${id}`, pole: 'code', phase: 'p1', etat: 'en-travail', session: 's', agents: [], taches: [], fichiers: [],
  cree: '2026-11-21T10:00:00.000Z', maj: '2026-11-21T10:00:00.000Z', passation: '', archive: false, auteur: '', ...extra,
})

test('chantiers : fiches en cours et archives de chaque membre, auteur = prénom du projet', async () => {
  const r = await lireProjetComplet(fsDe(base({
    [`${R}/equipe/lea/chantiers/a.md`]: serializeChantier(chantier('a')),
    [`${R}/equipe/lea/archive/vieux.md`]: serializeChantier(chantier('vieux', { etat: 'termine' })),
    [`${R}/equipe/jean-luc/chantiers/a.md`]: serializeChantier(chantier('a', { titre: 'Même id' })),
  })), 'C:/Projet', 'Léa')
  assert.deepEqual(r.erreursChantiers, [])
  assert.deepEqual(r.chantiers.map(c => [c.id, c.auteur, c.archive]).sort(), [['a', 'Jean-Luc', false], ['a', 'Léa', false], ['vieux', 'Léa', true]])
})

test('chantiers : copies de conflit ignorées, fiche invalide listée sans casser les autres', async () => {
  const r = await lireProjetComplet(fsDe(base({
    [`${R}/equipe/lea/chantiers/a.md`]: serializeChantier(chantier('a')),
    [`${R}/equipe/lea/chantiers/a (1).md`]: serializeChantier(chantier('copie')),
    [`${R}/equipe/lea/chantiers/b - Copie.md`]: serializeChantier(chantier('copie2')),
    [`${R}/equipe/lea/chantiers/cassee.md`]: '---\netat: explose\n---\n',
    [`${R}/equipe/lea/chantiers/vide.md`]: '',
    [`${R}/equipe/lea/chantiers/notes.txt`]: 'pas une fiche',
    [`${R}/equipe/lea (1)/chantiers/c.md`]: serializeChantier(chantier('dossier-copie')),
  })), 'C:/Projet', 'Léa')
  assert.deepEqual(r.chantiers.map(c => c.id), ['a'])
  assert.equal(r.erreursChantiers.length, 2)
  assert.ok(r.erreursChantiers.some(e => e.includes('cassee.md') && e.includes('explose')))
  assert.ok(r.erreursChantiers.some(e => e.includes('vide.md')))
})

test('chantiers : fiche illisible ou dossier en panne = erreur, pas d’exception ; absent = rien', async () => {
  const fiche = `${R}/equipe/lea/chantiers/a.md`
  const r = await lireProjetComplet(fsDe(base({ [fiche]: 'x', [`${R}/equipe/lea/chantiers/b.md`]: serializeChantier(chantier('b')) }), [fiche]), 'C:/Projet', 'Léa')
  assert.deepEqual(r.chantiers.map(c => c.id), ['b'])
  assert.equal(r.erreursChantiers.length, 1)
  const p = await lireProjetComplet(fsDe(base({ [`${R}/equipe/lea/chantiers/a.md`]: 'x' }), [], [`${R}/equipe/lea/chantiers`]), 'C:/Projet', 'Léa')
  assert.deepEqual(p.chantiers, [])
  assert.equal(p.erreursChantiers.length, 1)
  const v = await lireProjetComplet(fsDe(base({ [`${R}/equipe/lea/portes.md`]: 'porte: p1\n' })), 'C:/Projet', 'Léa')
  assert.deepEqual(v.chantiers, [])
  assert.deepEqual(v.erreursChantiers, [])
})

test('lireChantiers : membre inconnu du projet = nom du dossier ; ne lève jamais', async () => {
  const c = await lireChantiers(fsDe({ [`${R}/equipe/zoe/chantiers/a.md`]: serializeChantier(chantier('a')) }), 'C:/Projet', ['Léa'])
  assert.deepEqual(c.map(x => x.auteur), ['zoe'])
  assert.deepEqual(await lireChantiers(fsDe({}), 'C:/Projet', ['Léa']), [])
  assert.deepEqual(await lireChantiers(fsDe({}), '', ['Léa']), [])
})

test('chantiers : fiche trop volumineuse écartée, listée', async () => {
  const gros = serializeChantier(chantier('gros')) + 'x'.repeat(262_145)
  const r = await lireProjetComplet(fsDe(base({
    [`${R}/equipe/lea/chantiers/gros.md`]: gros,
    [`${R}/equipe/lea/chantiers/petit.md`]: serializeChantier(chantier('petit')),
  })), 'C:/Projet', 'Léa')
  assert.deepEqual(r.chantiers.map(c => c.id), ['petit'])
  assert.deepEqual(r.erreursChantiers, ['Fiche trop volumineuse (> 256 Ko) : gros.md'])
})

test('chantiers : au plus 100 archives lues par membre (les noms les plus grands), les autres comptées', async () => {
  const fichiers: Record<string, string> = {}
  for (let i = 0; i < 105; i++) {
    const id = `a${String(i).padStart(3, '0')}`
    fichiers[`${R}/equipe/lea/archive/${id}.md`] = serializeChantier(chantier(id))
  }
  fichiers[`${R}/equipe/lea/chantiers/actif.md`] = serializeChantier(chantier('actif'))
  const r = await lireProjetComplet(fsDe(base(fichiers)), 'C:/Projet', 'Léa')
  assert.equal(r.chantiers.filter(c => c.archive).length, 100)
  assert.ok(r.chantiers.some(c => c.id === 'a104') && !r.chantiers.some(c => c.id === 'a004') && r.chantiers.some(c => c.id === 'a005'))
  assert.ok(r.chantiers.some(c => c.id === 'actif'))
  assert.deepEqual(r.erreursChantiers, ['5 fiches archivées plus anciennes non lues.'])
})

test('chantiers : les chantiers actifs sont tous lus, même au-delà de 100', async () => {
  const fichiers: Record<string, string> = {}
  for (let i = 0; i < 120; i++) fichiers[`${R}/equipe/lea/chantiers/c${i}.md`] = serializeChantier(chantier(`c${i}`))
  const r = await lireProjetComplet(fsDe(base(fichiers)), 'C:/Projet', 'Léa')
  assert.equal(r.chantiers.length, 120)
  assert.deepEqual(r.erreursChantiers, [])
})

test('chantiers : avertissement de fiche gardée remonté dans erreursChantiers', async () => {
  const t = serializeChantier(chantier('a', { fichiers: ['ok.md'] })).replace('- ok.md', '- ../mauvais.md')
  const r = await lireProjetComplet(fsDe(base({ [`${R}/equipe/lea/chantiers/a.md`]: t })), 'C:/Projet', 'Léa')
  assert.deepEqual(r.chantiers.map(c => c.id), ['a'])
  assert.equal(r.erreursChantiers.length, 1)
  assert.ok(r.erreursChantiers[0]!.startsWith('(avertissement) ') && r.erreursChantiers[0]!.includes('mauvais.md'))
})
