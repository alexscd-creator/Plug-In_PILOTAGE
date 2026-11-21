import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseChantier, serializeChantier } from '../hooks/model/chantier.ts'
import type { Chantier } from '../hooks/model/chantier.ts'
import { creerEcrivain, majFiche } from '../hooks/model/ecriture-chantier.ts'
import type { Cible, FsEcriture, MajFiche, Moyens } from '../hooks/model/ecriture-chantier.ts'

const RACINE = 'C:/Projet'
const D = `${RACINE}/.pilotage/equipe/lea`
const MAINT = '2026-11-21T10:30:00Z'
const AGENTS = ['a1', 'a2', 'gardien']

const fiche = (extra: Partial<Chantier> = {}): Chantier => ({
  id: 'lobby', titre: 'Carte du lobby', pole: 'code', phase: 'p1', etat: 'arrete', session: 'sous-session', agents: [{ id: 'a2', etat: 'pret', quoi: 'Avant' }],
  taches: [{ titre: 'Poser les murs', statut: 'en cours' }], fichiers: ['docs/lobby.md'], cree: '2026-11-21T08:00:00Z', maj: '2026-11-21T09:00:00Z',
  passation: 'Texte de passation.', archive: false, auteur: 'Léa', ...extra,
})

/** Faux disque en mémoire : lectures, écritures et listes de noms ; les pannes se règlent par fonction. */
function disque(fichiers: Record<string, string>, panne: { lire?: boolean; ecrire?: (p: string) => boolean; lister?: boolean } = {}) {
  const ecrits: string[] = []
  const fs: FsEcriture = {
    read: async p => {
      if (panne.lire) throw new Error('lecture impossible')
      if (!(p in fichiers)) throw new Error('absent')
      return fichiers[p]!
    },
    write: async (p, t) => {
      if (panne.ecrire?.(p)) throw new Error('écriture refusée')
      ecrits.push(p)
      fichiers[p] = t
    },
    list: async p => {
      if (panne.lister) throw new Error('liste impossible')
      const prefixe = `${p.replace(/\/$/, '')}/`
      return [...new Set(Object.keys(fichiers).filter(f => f.startsWith(prefixe)).map(f => f.slice(prefixe.length).split('/')[0]!))]
    },
  }
  return { fs, fichiers, ecrits }
}
const cible = (extra: Partial<Cible> = {}): Cible => ({ racine: RACINE, membre: 'Léa', chantier: 'lobby', ...extra })
const travail: MajFiche = { chantierEtat: 'en-travail', agents: [{ id: 'a1', etat: 'en-travail', quoi: 'Écrit le lobby' }] }
const base = (extra: Record<string, string> = {}) => ({
  [`${D}/chantiers/lobby.md`]: serializeChantier(fiche()),
  [`${RACINE}/.pilotage/equipe/sam/portes.md`]: 'porte: p1\n',
  ...extra,
})

test('majFiche : agent et état du chantier mis à jour, le reste de la fiche intact, ancienne version gardée en .bak', async () => {
  const d = disque(base())
  const avant = d.fichiers[`${D}/chantiers/lobby.md`]!
  const r = await majFiche(d.fs, cible(), travail, AGENTS, MAINT)
  assert.deepEqual(r, { ok: true })
  const f = parseChantier(d.fichiers[`${D}/chantiers/lobby.md`]!, 'Léa')
  assert.ok(f.ok)
  if (!f.ok) return
  assert.equal(f.chantier.etat, 'en-travail')
  assert.equal(f.chantier.maj, MAINT)
  assert.deepEqual(f.chantier.agents, [{ id: 'a2', etat: 'pret', quoi: 'Avant' }, { id: 'a1', etat: 'en-travail', quoi: 'Écrit le lobby' }])
  assert.deepEqual(f.chantier.taches, [{ titre: 'Poser les murs', statut: 'en cours' }])
  assert.equal(f.chantier.passation, 'Texte de passation.')
  assert.equal(f.chantier.titre, 'Carte du lobby')
  assert.equal(f.chantier.cree, '2026-11-21T08:00:00Z')
  assert.equal(d.fichiers[`${D}/chantiers/lobby.md.bak`], avant)
  assert.deepEqual(d.ecrits, [`${D}/chantiers/lobby.md.bak`, `${D}/chantiers/lobby.md`])
})

test('majFiche : un agent déjà présent est mis à jour sur place, sans doublon', async () => {
  const d = disque(base())
  await majFiche(d.fs, cible(), { agents: [{ id: 'a2', etat: 'bloque', quoi: 'Souci' }] }, AGENTS, MAINT)
  const f = parseChantier(d.fichiers[`${D}/chantiers/lobby.md`]!, 'Léa')
  assert.ok(f.ok && f.chantier.agents.length === 1 && f.chantier.agents[0]!.etat === 'bloque' && f.chantier.etat === 'arrete')
})

test('majFiche : l’état « termine » n’est jamais posé (chantier ni agent) : rien n’est écrit', async () => {
  for (const maj of [{ chantierEtat: 'termine' as const, agents: [] }, { agents: [{ id: 'a1', etat: 'termine' as const, quoi: '' }] }]) {
    const d = disque(base())
    const r = await majFiche(d.fs, cible(), maj, AGENTS, MAINT)
    assert.equal(r.ok, false)
    assert.deepEqual(d.ecrits, [])
  }
})

test('majFiche : agent hors projet, chantier archivé, fiche de l’associé, mise à jour vide : refus sans écriture', async () => {
  const cas: [string, Record<string, string>, Cible, MajFiche][] = [
    ['agent hors projet', base(), cible(), { agents: [{ id: 'inconnu', etat: 'en-travail', quoi: '' }] }],
    ['archivé', base({ [`${D}/chantiers/lobby.md`]: serializeChantier(fiche({ archive: true })) }), cible(), travail],
    ['chantier absent', base(), cible({ chantier: 'autre' }), travail],
    ['chez l’associé', { [`${RACINE}/.pilotage/equipe/sam/chantiers/lobby.md`]: serializeChantier(fiche({ auteur: 'Sam' })), [`${D}/portes.md`]: 'x' }, cible(), travail],
    ['membre sans dossier', base(), cible({ membre: 'Zoé' }), travail],
    ['rien à changer', base(), cible(), { agents: [] }],
  ]
  for (const [nom, f, c, maj] of cas) {
    const d = disque(f)
    const r = await majFiche(d.fs, c, maj, AGENTS, MAINT)
    assert.equal(r.ok, false, nom)
    if (!r.ok) assert.ok(r.erreur.length > 0, nom)
    assert.deepEqual(d.ecrits, [], nom)
  }
})

test('majFiche : identifiant ou membre qui sortent du dossier du membre : refus, jamais d’écriture ailleurs', async () => {
  const pieges: Partial<Cible>[] = [
    { chantier: '../../projet' }, { chantier: 'a/b' }, { chantier: 'a\\b' }, { chantier: '' }, { chantier: 'Lobby' },
    { membre: '../sam' }, { membre: '' }, { racine: '' },
  ]
  for (const p of pieges) {
    const d = disque(base())
    const r = await majFiche(d.fs, cible(p), travail, AGENTS, MAINT)
    assert.equal(r.ok, false, JSON.stringify(p))
    assert.deepEqual(d.ecrits, [], JSON.stringify(p))
  }
  const d = disque(base())
  await majFiche(d.fs, cible(), travail, AGENTS, MAINT)
  assert.ok(d.ecrits.every(p => p.startsWith(`${D}/chantiers/`)), 'tout reste dans le dossier du membre')
})

test('majFiche : fiche illisible ou invalide, date de mise à jour invalide : refus sans écriture', async () => {
  for (const [f, panne, maint] of [
    [base({ [`${D}/chantiers/lobby.md`]: 'pas une fiche' }), {}, MAINT],
    [base(), { lire: true }, MAINT],
    [base(), {}, '2026-02-31T10:00:00Z'],
    [base(), {}, 'hier'],
    [base(), { lister: true }, MAINT],
  ] as const) {
    const d = disque({ ...f }, panne)
    const r = await majFiche(d.fs, cible(), travail, AGENTS, maint)
    assert.equal(r.ok, false)
    assert.deepEqual(d.ecrits, [])
  }
})

test('majFiche : trop d’agents (20 au plus) refusé', async () => {
  const beaucoup = Array.from({ length: 20 }, (_, i) => ({ id: `ag${i}`, etat: 'pret' as const, quoi: '' }))
  const d = disque(base({ [`${D}/chantiers/lobby.md`]: serializeChantier(fiche({ agents: beaucoup })) }))
  const r = await majFiche(d.fs, cible(), travail, [...AGENTS, 'a1'], MAINT)
  assert.equal(r.ok, false)
  assert.deepEqual(d.ecrits, [])
})

test('majFiche : échec d’écriture de la copie .bak = fiche intacte ; échec sur la fiche = erreur rendue, jamais de levée', async () => {
  const d1 = disque(base(), { ecrire: p => p.endsWith('.bak') })
  const avant = d1.fichiers[`${D}/chantiers/lobby.md`]
  const r1 = await majFiche(d1.fs, cible(), travail, AGENTS, MAINT)
  assert.equal(r1.ok, false)
  assert.equal(d1.fichiers[`${D}/chantiers/lobby.md`], avant)
  const d2 = disque(base(), { ecrire: p => p.endsWith('.md') })
  const r2 = await majFiche(d2.fs, cible(), travail, AGENTS, MAINT)
  assert.equal(r2.ok, false)
  assert.equal(d2.fichiers[`${D}/chantiers/lobby.md`], avant, 'la fiche d’origine reste, la copie .bak aussi')
})

test('majFiche : entrées absurdes sans levée', async () => {
  const d = disque(base())
  for (const args of [[undefined, undefined, undefined, undefined], [null, null, null, null], [{}, {}, {}, 3]] as const) {
    const r = await (majFiche as (...a: unknown[]) => Promise<{ ok: boolean }>)(d.fs, ...args)
    assert.equal(r.ok, false)
  }
  assert.deepEqual(d.ecrits, [])
})

// ---- Écrivain limité : au plus une écriture par chantier toutes les 2 s, les mises à jour rapprochées sont fusionnées ----

function banc(opts: { ecrire?: (l: { cible: Cible; maj: MajFiche }) => Promise<{ ok: boolean; erreur?: string }> } = {}) {
  let t = 1_000_000
  const lots: { cible: Cible; maj: MajFiche }[] = []
  const minuteurs: { ms: number; fn: () => void; annule: boolean }[] = []
  const erreurs: string[] = []
  const brut = creerEcrivain({ delai: 2000 })
  const moyens: Moyens = {
    maintenant: async () => t,
    apres: (ms, fn) => {
      const m = { ms, fn, annule: false }
      minuteurs.push(m)
      return { cancel: () => { m.annule = true } }
    },
    ecrire: async l => {
      lots.push(JSON.parse(JSON.stringify(l)))
      return opts.ecrire ? opts.ecrire(l) : { ok: true }
    },
    surEtat: m => { erreurs.push(m) },
  }
  const e = { ...brut, soumettre: (cle: string, c: Cible, m: MajFiche, a: string[]) => brut.soumettre(cle, c, m, a, moyens), oublier: brut.oublier, repos: brut.repos }
  const tirer = async () => {
    const m = minuteurs.find(x => !x.annule)!
    m.annule = true
    m.fn()
    await e.repos()
  }
  return { e, lots, minuteurs, erreurs, tirer, avancer: (ms: number) => { t += ms } }
}
const ag = (id: string, etat: 'en-travail' | 'pret' | 'bloque', quoi = '') => ({ id, etat, quoi })

test('écrivain : la première mise à jour part tout de suite', async () => {
  const b = banc()
  await b.e.soumettre('c1', cible(), { chantierEtat: 'en-travail', agents: [ag('a1', 'en-travail', 'x')] }, AGENTS)
  assert.equal(b.lots.length, 1)
  assert.deepEqual(b.lots[0]!.maj.agents, [ag('a1', 'en-travail', 'x')])
  assert.equal(b.minuteurs.length, 0)
})

test('écrivain : dans les 2 s, rien ne part ; les mises à jour rapprochées sont fusionnées (dernier état par agent) en une écriture', async () => {
  const b = banc()
  await b.e.soumettre('c1', cible(), { chantierEtat: 'en-travail', agents: [ag('a1', 'en-travail', 'x')] }, AGENTS)
  b.avancer(500)
  await b.e.soumettre('c1', cible(), { agents: [ag('a2', 'en-travail', 'y')] }, AGENTS)
  b.avancer(500)
  await b.e.soumettre('c1', cible(), { agents: [ag('a1', 'pret', 'x')] }, AGENTS)
  assert.equal(b.lots.length, 1, 'pas de nouvelle écriture avant l’échéance')
  assert.equal(b.minuteurs.filter(m => !m.annule).length, 1, 'un seul minuteur d’attente')
  assert.equal(b.minuteurs[0]!.ms, 1500, 'il attend le reste du délai (2 s moins 0,5 s écoulée à la pose du minuteur)')
  b.avancer(1000)
  await b.tirer()
  assert.equal(b.lots.length, 2)
  assert.deepEqual(b.lots[1]!.maj.agents.map(a => [a.id, a.etat]).sort(), [['a1', 'pret'], ['a2', 'en-travail']])
  assert.equal(b.lots[1]!.maj.chantierEtat, undefined)
})

test('écrivain : chantiers indépendants ; après le délai la mise à jour suivante repart tout de suite', async () => {
  const b = banc()
  await b.e.soumettre('c1', cible(), { agents: [ag('a1', 'en-travail')] }, AGENTS)
  await b.e.soumettre('c2', cible({ chantier: 'autre' }), { agents: [ag('a1', 'en-travail')] }, AGENTS)
  assert.equal(b.lots.length, 2)
  b.avancer(2000)
  await b.e.soumettre('c1', cible(), { agents: [ag('a1', 'pret')] }, AGENTS)
  assert.equal(b.lots.length, 3)
})

test('écrivain : écriture refusée (résultat ou levée) = signalée, jamais de levée, la suite continue', async () => {
  let n = 0
  const b = banc({
    ecrire: async () => {
      n++
      if (n === 1) return { ok: false, erreur: 'refusée' }
      if (n === 2) throw new Error('disque plein')
      return { ok: true }
    },
  })
  await b.e.soumettre('c1', cible(), { agents: [ag('a1', 'en-travail')] }, AGENTS)
  assert.deepEqual(b.erreurs, ['refusée'])
  b.avancer(2000)
  await b.e.soumettre('c1', cible(), { agents: [ag('a1', 'bloque')] }, AGENTS)
  assert.equal(b.erreurs.length, 2)
  assert.match(b.erreurs[1]!, /disque plein/)
  b.avancer(2000)
  await b.e.soumettre('c1', cible(), { agents: [ag('a1', 'pret')] }, AGENTS)
  assert.deepEqual(b.erreurs.at(-1), '', 'une écriture réussie efface l’erreur')
})

test('écrivain : oublier() annule les minuteurs et abandonne ce qui attendait', async () => {
  const b = banc()
  await b.e.soumettre('c1', cible(), { agents: [ag('a1', 'en-travail')] }, AGENTS)
  await b.e.soumettre('c1', cible(), { agents: [ag('a1', 'pret')] }, AGENTS)
  assert.equal(b.minuteurs.filter(m => !m.annule).length, 1)
  b.e.oublier()
  assert.equal(b.minuteurs.filter(m => !m.annule).length, 0)
  b.minuteurs[0]!.fn()
  await b.e.repos()
  assert.equal(b.lots.length, 1, 'rien n’est écrit après l’oubli')
})

test('écrivain : sans minuteur disponible, la mise à jour part quand même (jamais perdue ni levée)', async () => {
  let t = 5
  const lots: unknown[] = []
  const e = creerEcrivain({ delai: 2000 })
  const moyens: Moyens = {
    maintenant: async () => t, apres: () => { throw new Error('pas d’horloge') },
    ecrire: async l => { lots.push(l); return { ok: true } }, surEtat: () => undefined,
  }
  await e.soumettre('c', cible(), { agents: [ag('a1', 'en-travail')] }, AGENTS, moyens)
  t += 10
  await e.soumettre('c', cible(), { agents: [ag('a1', 'pret')] }, AGENTS, moyens)
  assert.equal(lots.length, 2)
})
