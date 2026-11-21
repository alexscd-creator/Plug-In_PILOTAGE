import assert from 'node:assert/strict'
import { test } from 'node:test'

import { etatAffiche, parseChantier, progressionChantier, serializeChantier, validerChantier } from '../hooks/model/chantier.ts'
import type { Chantier } from '../hooks/model/chantier.ts'

const base: Chantier = {
  id: 'carte-du-lobby', titre: 'Carte du lobby', pole: 'code', phase: 'p2', etat: 'en-travail', session: 'sous-session 1',
  agents: [{ id: 'developpeur', etat: 'en-travail', quoi: 'Script du lobby' }, { id: 'gardien', etat: 'attente', quoi: '' }],
  taches: [{ titre: 'Poser le sol', statut: 'termine' }, { titre: 'Placer les portes', statut: 'en cours' }, { titre: 'Peindre', statut: 'a faire' }],
  fichiers: ['src/lobby.luau', 'docs/lobby.md'], cree: '2026-11-21T10:00:00.000Z', maj: '2026-11-21T11:00:00.000Z',
  passation: 'Reste les portes.\nVoir docs.', archive: false, auteur: 'Léa',
}
const ok = (t: string, a = 'Léa'): Chantier => {
  const r = parseChantier(t, a)
  assert.equal(r.ok, true, JSON.stringify(r))
  return (r as { ok: true; chantier: Chantier }).chantier
}
const erreurs = (t: string): string[] => {
  const r = parseChantier(t, 'Léa')
  assert.equal(r.ok, false)
  return (r as { ok: false; erreurs: string[] }).erreurs
}

test('aller-retour : serialize puis parse rend la même fiche', () => {
  assert.deepEqual(ok(serializeChantier(base)), base)
})

test('aller-retour : fiche minimale (listes vides, passation vide, archivée)', () => {
  const c: Chantier = { ...base, agents: [], taches: [], fichiers: [], passation: '', archive: true, pole: '', phase: '', session: '' }
  assert.deepEqual(ok(serializeChantier(c)), c)
})

test('l’auteur vient de l’appelant, jamais du fichier', () => {
  const t = serializeChantier(base).replace('---\n', '---\nauteur: Mallory\n')
  assert.equal(ok(t, 'Jean-Luc').auteur, 'Jean-Luc')
})

test('injection : retour à la ligne, | et .. dans titre, agent, tâche, fichier', () => {
  const sale: Chantier = {
    ...base, titre: 'Titre\netat: termine\n## agents', session: 'a\r\nb | c',
    agents: [{ id: 'dev\n- x | arrete | y', etat: 'en-travail', quoi: 'fait\n- pirate | pret | z' }],
    taches: [{ titre: 'tâche\n- [x] fausse | autre', statut: 'a faire' }],
    fichiers: ['../secret.txt', 'ok/../../pas.txt', '/etc/passwd', 'C:\\Windows\\x', 'bon\nmauvais.md', 'a|b.md', 'src/ok.luau'],
  }
  const texte = serializeChantier(sale)
  const lignes = texte.split('\n')
  assert.equal(lignes.filter(l => l.startsWith('## ')).length, 4)
  assert.equal(lignes.filter(l => l.startsWith('etat:')).length, 1)
  const c = ok(texte)
  assert.equal(c.etat, 'en-travail')
  assert.equal(c.taches.length, 1)
  assert.equal(c.taches[0]!.statut, 'a faire')
  assert.equal(c.agents.length, 1)
  assert.match(c.agents[0]!.id, /^[a-z0-9-]+$/)
  assert.ok(c.fichiers.every(f => !f.split('/').includes('..') && !f.startsWith('/') && !/[\r\n|\\:]/.test(f)))
  assert.ok(c.fichiers.includes('src/ok.luau'))
  assert.ok(!/[\r\n|]/.test(c.titre + c.session + c.agents[0]!.quoi))
})

test('injection : un identifiant de chantier invalide est assaini en identifiant sûr', () => {
  const c = ok(serializeChantier({ ...base, id: 'Mon Chantier/../x\nid: y' }))
  assert.match(c.id, /^[a-z0-9-]+$/)
  assert.ok(c.id.length <= 60)
})

test('passation plafonnée à 4000 caractères, injection de section sans effet', () => {
  assert.equal(ok(serializeChantier({ ...base, passation: 'x'.repeat(5000) })).passation.length, 4000)
  const p = ok(serializeChantier({ ...base, passation: 'avant\n## taches\n- [x] pirate\n---\netat: termine' }))
  assert.equal(p.taches.length, 3)
  assert.equal(p.etat, 'en-travail')
  assert.ok(p.passation.includes('pirate'))
})

test('fiche écrite à la main : lue, avec fins de ligne Windows', () => {
  const t = '---\r\nid: abc\r\ntitre: Un chantier\r\netat: pret\r\ncree: 2026-11-21T10:00:00.000Z\r\nmaj: 2026-11-21T10:05:00.000Z\r\n---\r\n## taches\r\n- [x] Fini\r\n- [ ] A faire\r\n## agents\r\n- dev | bloque | attend une clé\r\n## fichiers\r\n- a/b.md\r\n## passation\r\nBonjour\r\n'
  const c = ok(t)
  assert.equal(c.etat, 'pret')
  assert.deepEqual(c.taches, [{ titre: 'Fini', statut: 'termine' }, { titre: 'A faire', statut: 'a faire' }])
  assert.deepEqual(c.agents, [{ id: 'dev', etat: 'bloque', quoi: 'attend une clé' }])
  assert.deepEqual(c.fichiers, ['a/b.md'])
  assert.equal(c.passation, 'Bonjour')
  assert.equal(c.archive, false)
})

test('états inconnus : erreur en français, jamais d’exception', () => {
  const e = erreurs(serializeChantier(base).replace('etat: en-travail', 'etat: explose'))
  assert.ok(e.some(x => x.includes('explose') && x.includes('état')))
  const e2 = erreurs(serializeChantier(base).replace('- developpeur | en-travail', '- developpeur | zzz'))
  assert.ok(e2.some(x => x.includes('zzz')))
})

test('fiche vide, texte non-texte, champs obligatoires, dates invalides', () => {
  assert.deepEqual(erreurs(''), ['La fiche est vide.'])
  assert.deepEqual(erreurs('   \n\n'), ['La fiche est vide.'])
  assert.ok(erreurs('pas d’en-tête').length > 0)
  assert.equal(parseChantier(undefined as unknown as string, 'x').ok, false)
  const e = erreurs('---\netat: pret\n---\n')
  assert.ok(e.some(x => x.includes('id')) && e.some(x => x.includes('titre')))
  assert.ok(erreurs(serializeChantier(base).replace('maj: 2026-11-21T11:00:00.000Z', 'maj: hier')).some(x => x.includes('maj')))
  assert.ok(erreurs(serializeChantier(base).replace('id: carte-du-lobby', 'id: Pas Bon!')).some(x => x.includes('id')))
  assert.ok(erreurs(serializeChantier(base).replace('id: carte-du-lobby', `id: ${'a'.repeat(61)}`)).some(x => x.includes('id')))
})

test('fichier hors du projet dans une fiche écrite à la main : fiche gardée, chemin écarté, avertissement', () => {
  const t = serializeChantier(base).replace('- src/lobby.luau', '- ../hors.txt')
  const r = parseChantier(t, 'Léa')
  assert.equal(r.ok, true)
  if (!r.ok) return
  assert.deepEqual(r.chantier.fichiers, ['docs/lobby.md'])
  assert.equal(r.avertissements.length, 1)
  assert.ok(r.avertissements[0]!.includes('hors.txt'))
  assert.deepEqual(ok(serializeChantier(base)).fichiers, base.fichiers)
  const propre = parseChantier(serializeChantier(base), 'Léa')
  assert.ok(propre.ok && propre.avertissements.length === 0)
})

test('BOM en tête de fiche : lue', () => {
  assert.equal(ok('﻿' + serializeChantier(base)).id, base.id)
})

test('toutes les tâches abandonnées : 0 %', () => {
  const c = { ...base, taches: [{ titre: 'a', statut: 'abandonne' as const }, { titre: 'b', statut: 'abandonne' as const }] }
  assert.deepEqual(progressionChantier(c), { total: 0, faites: 0, pourcent: 0 })
})

test('un titre « ## passation finale » ouvre la passation', () => {
  const t = serializeChantier({ ...base, passation: '' }).replace('## passation', '## passation finale') + 'Le mot de la fin' + String.fromCharCode(10)
  assert.equal(ok(t).passation, 'Le mot de la fin')
})

test('validerChantier : une fiche valide ne rend aucune erreur', () => {
  assert.deepEqual(validerChantier(base), [])
})

test('validerChantier : id, titre, dates, états, session', () => {
  const dit = (extra: Partial<Chantier>): string[] => validerChantier({ ...base, ...extra })
  assert.ok(dit({ id: '' }).some(e => e.includes('id')))
  assert.ok(dit({ id: 'Pas Bon' }).some(e => e.includes('id')))
  assert.ok(dit({ id: 'a'.repeat(61) }).some(e => e.includes('id')))
  assert.ok(dit({ titre: '  ' }).some(e => e.includes('titre')))
  assert.ok(dit({ cree: 'hier' }).some(e => e.includes('cree')))
  assert.ok(dit({ maj: '2026-02-31T10:00:00.000Z' }).some(e => e.includes('maj')))
  assert.ok(dit({ etat: 'explose' as never }).some(e => e.includes('explose')))
  assert.ok(dit({ agents: [{ id: 'dev', etat: 'zzz' as never, quoi: '' }] }).some(e => e.includes('zzz')))
  assert.ok(dit({ session: 'x'.repeat(201) }).some(e => e.includes('session')))
  assert.deepEqual(dit({ cree: '2026-02-28T10:00:00Z', maj: '2026-11-21T10:00:00.5Z' }), [])
})

test('deux membres avec le même id : les deux fiches restent distinctes', () => {
  const t = serializeChantier(base)
  const a = ok(t, 'Léa'), b = ok(t, 'Jean-Luc')
  assert.equal(a.id, b.id)
  assert.notEqual(a.auteur, b.auteur)
})

test('progression : abandonnées exclues, pourcent arrondi, zéro sans tâche', () => {
  assert.deepEqual(progressionChantier(base), { total: 3, faites: 1, pourcent: 33 })
  assert.deepEqual(progressionChantier({ ...base, taches: [] }), { total: 0, faites: 0, pourcent: 0 })
  const c = { ...base, taches: [{ titre: 'a', statut: 'termine' as const }, { titre: 'b', statut: 'abandonne' as const }, { titre: 'c', statut: 'reporte' as const }] }
  assert.deepEqual(progressionChantier(c), { total: 2, faites: 1, pourcent: 50 })
})

test('état affiché : en-travail/attente sans nouvelle depuis plus de 15 min passent à pret', () => {
  const maj = Date.parse('2026-11-21T11:00:00.000Z')
  const min = 60_000
  assert.equal(etatAffiche(base, maj + 15 * min), 'en-travail')
  assert.equal(etatAffiche(base, maj + 15 * min + 1), 'pret')
  assert.equal(etatAffiche({ ...base, etat: 'attente' }, maj + 16 * min), 'pret')
  for (const e of ['arrete', 'pret', 'bloque', 'termine'] as const) assert.equal(etatAffiche({ ...base, etat: e }, maj + 99 * min), e)
  assert.equal(etatAffiche({ ...base, archive: true }, maj + 99 * min), 'en-travail')
  assert.equal(etatAffiche(base, maj - 5 * min), 'en-travail')
  assert.equal(etatAffiche({ ...base, maj: 'nimporte' }, maj), 'en-travail')
  assert.equal(etatAffiche(base, Number.NaN), 'en-travail')
})
