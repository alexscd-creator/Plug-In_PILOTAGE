import assert from 'node:assert/strict'
import { test } from 'node:test'

import { avancementPhase, estCopieDeConflit, genererPlan, parsePlan, portePossible, serializePlan } from '../hooks/model/plan.ts'
import type { Tache } from '../hooks/model/plan.ts'
import type { Projet } from '../hooks/model/projet.ts'

const projet: Projet = {
  version: 1, nom: 'Demo', but: 'b', fini: 'f', preset: 'p', equipe: ['Lea'], poles: [], agents: [], workflow: { outils: [] },
  phases: [
    { id: 'cadrage', titre: 'Cadrage', taches: ['Ecrire le but', 'Lister les risques'] },
    { id: 'maquettes', titre: 'Maquettes', taches: ['Dessiner l’écran'] },
    { id: 'vide', titre: 'Vide', taches: [] },
  ],
}
const t = (id: string, phase: string, statut: Tache['statut'], extra: Partial<Tache> = {}): Tache => ({ id, phase, titre: id, statut, ...extra })

test('genererPlan : un titre par phase, une tâche par entrée du preset, tout « a faire », ids stables', () => {
  const md = genererPlan(projet)
  assert.match(md, /^## Cadrage \(cadrage\)$/m)
  assert.match(md, /^- \[ \] cadrage-1 \| Ecrire le but$/m)
  assert.match(md, /^- \[ \] cadrage-2 \| Lister les risques$/m)
  assert.match(md, /^- \[ \] maquettes-1 \| Dessiner l’écran$/m)
  const taches = parsePlan(md)
  assert.equal(taches.length, 3)
  assert.ok(taches.every(x => x.statut === 'a faire'))
  assert.deepEqual(taches.map(x => x.phase), ['cadrage', 'cadrage', 'maquettes'])
})

test('aller-retour : genererPlan -> parsePlan -> serializePlan -> parsePlan à l’identique', () => {
  const taches = parsePlan(genererPlan(projet))
  assert.deepEqual(parsePlan(serializePlan(taches, projet.phases)), taches)
  assert.equal(serializePlan(taches, projet.phases), genererPlan(projet))
})

test('les cinq statuts, fichier et auteur sont relus', () => {
  const md = [
    '## Cadrage (cadrage)', '',
    '- [ ] cadrage-1 | A', '- [~] cadrage-2 | B | auteur: Lea', '- [x] cadrage-3 | C | fichier: docs/c.md | auteur: Max',
    '- [>] cadrage-4 | D', '- [-] cadrage-5 | E',
  ].join('\n')
  const r = parsePlan(md)
  assert.deepEqual(r.map(x => x.statut), ['a faire', 'en cours', 'termine', 'reporte', 'abandonne'])
  assert.equal(r[1]!.auteur, 'Lea')
  assert.equal(r[2]!.fichier, 'docs/c.md')
  assert.equal(r[2]!.auteur, 'Max')
  assert.deepEqual(parsePlan(serializePlan(r, projet.phases)), r)
})

test('l’édition à la main garde les ids ; les lignes mal formées sont ignorées sans exception', () => {
  const md = ['## Cadrage (cadrage)', '- [x] cadrage-2 | Fait', 'n’importe quoi', '- [?] z | inconnu', '- [ ] | sans id', '- [ ] sans-titre', '- [ ] cadrage-2 | doublon'].join('\n')
  assert.deepEqual(parsePlan(md), [{ id: 'cadrage-2', phase: 'cadrage', titre: 'Fait', statut: 'termine' }])
  assert.deepEqual(parsePlan('- [ ] a | avant tout titre'), [])
  assert.deepEqual(parsePlan(''), [])
  assert.deepEqual(parsePlan('\u0000\r\n## (\n- [ '), [])
})

test('le texte du fichier est une donnée : pas d’injection par « | » ou saut de ligne à l’écriture', () => {
  const sale = t('a|b\n- [x] faux-1', 'cadrage', 'a faire', { titre: 'x | auteur: pirate\n- [x] faux-2 | y', fichier: 'f.md\n## Pirate (z)', auteur: 'Lea | fichier: z' })
  const md = serializePlan([sale], projet.phases)
  const r = parsePlan(md)
  assert.equal(r.length, 1)
  assert.equal(r[0]!.statut, 'a faire')
  assert.equal(r[0]!.phase, 'cadrage')
  assert.ok(!md.split('\n').some(l => l.startsWith('## Pirate')))
})

test('avancementPhase : reportées et abandonnées ne comptent pas comme ouvertes', () => {
  const l = [t('1', 'cadrage', 'termine'), t('2', 'cadrage', 'en cours'), t('3', 'cadrage', 'reporte'), t('4', 'cadrage', 'abandonne'), t('5', 'cadrage', 'a faire'), t('6', 'maquettes', 'a faire')]
  const a = avancementPhase(l, 'cadrage')
  assert.equal(a.total, 5)
  assert.equal(a.faites, 1)
  assert.deepEqual(a.ouvertes.map(x => x.id), ['2', '5'])
  assert.deepEqual(avancementPhase(l, 'inconnue'), { total: 0, faites: 0, ouvertes: [] })
})

test('portePossible : refuse avec les tâches ouvertes, accepte si tout est terminé, reporté ou abandonné', () => {
  const l = [t('1', 'cadrage', 'termine'), t('2', 'cadrage', 'en cours'), t('3', 'cadrage', 'a faire')]
  const r = portePossible(l, 'cadrage')
  assert.equal(r.ok, false)
  assert.deepEqual(r.ouvertes.map(x => x.id), ['2', '3'])
  const ok = portePossible([t('1', 'cadrage', 'termine'), t('2', 'cadrage', 'reporte'), t('3', 'cadrage', 'abandonne')], 'cadrage')
  assert.deepEqual(ok, { ok: true, ouvertes: [] })
  assert.equal(portePossible([], 'vide').ok, true)
})

test('le plan ne coche rien tout seul : une phase neuve n’a aucune tâche terminée', () => {
  const taches = parsePlan(genererPlan(projet))
  assert.equal(portePossible(taches, 'cadrage').ok, false)
  assert.equal(avancementPhase(taches, 'cadrage').faites, 0)
})

test('estCopieDeConflit : copies Drive/Git détectées, noms ordinaires non', () => {
  for (const n of ['a (1).md', 'a (2).md', 'plan (conflit).md', 'plan (conflict).md', 'plan (copie).md', 'plan (conflit de Lea).md', 'a - Copy.md', 'a - Copie.md', 'a - Copy (2).md', 'Copy of a.md', 'a (CONFLICT).MD', 'dossier/a (1).md', 'dossier\\a (copie).md', 'a (1)'])
    assert.equal(estCopieDeConflit(n), true, n)
  for (const n of ['a.md', 'plan.md', 'plan (v2).md', 'copy.md', 'a (1)b.md', 'Notes (brouillon).md', 'Copyright.md', ''])
    assert.equal(estCopieDeConflit(n), false, n)
})
