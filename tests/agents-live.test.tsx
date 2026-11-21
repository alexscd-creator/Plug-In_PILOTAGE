import { expect, mock, test } from 'claude-code/testing'

import { parseChantier, serializeChantier } from '../hooks/model/chantier.ts'
import type { Chantier } from '../hooks/model/chantier.ts'
import { demarrer } from './banc'
import { HOME, sl } from './disque'
import { dossierPages } from './fixture-pages'

const D = 'C:/Projet/.pilotage/equipe/lea'
const FICHE = `${D}/chantiers/lobby.md`
const T0 = Date.parse('2026-11-21T10:00:00Z')

const fiche = (extra: Partial<Chantier> = {}): Chantier => ({
  id: 'lobby', titre: 'Carte du lobby', pole: 'code', phase: 'p2', etat: 'arrete', session: 'sous-session', agents: [], taches: [],
  fichiers: [], cree: '2026-11-21T08:00:00Z', maj: '2026-11-21T09:00:00Z', passation: '', archive: false, auteur: 'Léa', ...extra,
})
type Fichiers = Record<string, string>
const lie = (sessions: Record<string, string> = { s1: 'lobby' }): Fichiers => ({
  ...dossierPages(),
  [FICHE]: serializeChantier(fiche()),
  [`${D}/sessions.json`]: JSON.stringify(sessions),
})

type Pannes = { lecture: boolean; etat: boolean }
/** Monde simulé : disque et état qui peuvent se figer (`pannes`), écritures comptées, session s1, horloge arrêtée, appel d'outil tenu par une porte. */
function monde(on: Function, fichiers: Fichiers, options: { ecriture?: (p: string) => boolean } = {}) {
  const pannes: Pannes = { lecture: false, etat: false }
  on('env.get', () => ({ value: HOME }))
  on('fs.read', (_: unknown, e: { path: string }) => (pannes.lecture ? new Promise(() => undefined) : { value: fichiers[sl(e.path)] ?? '' }))
  on('fs.list', (_: unknown, e: { path: string }) => {
    const prefixe = sl(e.path).replace(/\/$/, '') + '/'
    const noms = new Map<string, 'file' | 'dir'>()
    for (const f of Object.keys(fichiers)) {
      if (!f.startsWith(prefixe)) continue
      const [premier, ...suite] = f.slice(prefixe.length).split('/')
      noms.set(premier!, suite.length ? 'dir' : 'file')
    }
    return { value: [...noms].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })) }
  })
  const ecrits: string[] = []
  on('fs.write', (_: unknown, e: { path: string; text: string }) => {
    if (options.ecriture?.(sl(e.path))) throw new Error('écriture refusée')
    ecrits.push(sl(e.path))
    fichiers[sl(e.path)] = e.text
    return { value: undefined }
  })
  on('command.register', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/Projet' }))
  on('session.id', () => ({ value: 's1' }))
  on('prompt.compose', () => ({ sections: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const etat: Record<string, unknown> = {}
  const enveloppes: Record<string, { shape?: string; value: unknown }> = {}
  on('state.get', (_: unknown, e: { key: string }) => ({ value: { value: enveloppes[e.key], version: 1 } }))
  on('state.set', (_: unknown, e: { key: string; value: { shape?: string; value: unknown } }) => {
    if (pannes.etat && e.key === 'agentsLive') return new Promise(() => undefined)
    enveloppes[e.key] = e.value
    etat[e.key] = e.value.value
    return { value: { isSet: true, version: 2 } }
  })
  const horloge = mock.clock(on, { now: T0 })
  // L'outil lui-même : chaque appel attend qu'on ouvre sa porte, puis rend ce qu'on lui donne (rien, un texte, un objet...).
  const portes: { ouvrir: (...r: unknown[]) => void; fermer: (e: Error) => void }[] = []
  on('tool.call', (_: unknown, e: { tool: string }) => {
    if (e.tool !== 'Agent' && e.tool !== 'AskUserQuestion') return { result: 'ok' }
    return new Promise((ok, ko) => portes.push({ ouvrir: (...r) => ok(r.length ? r[0] : { result: 'ok' }), fermer: ko }))
  })
  return { ecrits, etat, horloge, portes, pannes }
}
const agent = (sousType: string, description = 'Écrire le lobby') => ({ tool: 'Agent', description, prompt: 'p', subagent_type: sousType }) as const
const lire = (f: Fichiers, chemin = FICHE) => {
  const r = parseChantier(f[chemin]!, 'Léa')
  if (!r.ok) throw new Error(r.erreurs.join(' '))
  return r.chantier
}
const live = (etat: Record<string, unknown>) => (etat.agentsLive ?? { appels: [], derniers: [], attentes: [] }) as {
  appels: { agent: string; quoi: string }[]; derniers: { agent: string; etat: string }[]; attentes: string[]
}

test('appel Agent : l’agent travaille pendant l’appel (atome), puis « prêt » ; le hook passe toujours par next et rend son résultat', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  const appel = $.tool.call(agent('a1'))
  await m.horloge.settle()
  expect(live(m.etat).appels.map(a => [a.agent, a.quoi])).toEqual([['a1', 'Écrire le lobby']])
  m.portes[0]!.ouvrir({ result: 'fini' })
  const r = await appel
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  expect(r.result).toBe('fini')
  expect(live(m.etat).appels).toEqual([])
  expect(live(m.etat).derniers.map(d => [d.agent, d.etat])).toEqual([['a1', 'pret']])
})

test('sous-type préfixé du plugin : même agent ; agent hors projet et outil intégré ignorés (ni atome, ni écriture)', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  const a = $.tool.call(agent('pilotage:a2'))
  await m.horloge.settle()
  expect(live(m.etat).appels.map(x => x.agent)).toEqual(['a2'])
  m.portes[0]!.ouvrir()
  await a
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  const avant = m.ecrits.length
  for (const t of ['general-purpose', 'Explore', 'autre-plugin:inconnu']) {
    const p = $.tool.call(agent(t))
    await m.horloge.settle()
    expect(live(m.etat).appels).toEqual([])
    m.portes.at(-1)!.ouvrir()
    await p
  }
  expect(live(m.etat).derniers.map(d => d.agent)).toEqual(['a2'])
  expect(m.ecrits.length).toBe(avant)
})

test('session liée : « en travail » écrit au début, « prêt » à la fin (fusionnée, 2 s plus tard), jamais « termine »', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  const appel = $.tool.call(agent('a1', 'Écrire le lobby'))
  await m.horloge.settle()
  expect(m.ecrits).toEqual([`${FICHE}.bak`, FICHE])
  let c = lire(f)
  expect(c.etat).toBe('en-travail')
  expect(c.agents).toEqual([{ id: 'a1', etat: 'en-travail', quoi: 'Écrire le lobby' }])
  expect(c.maj).toBe('2026-11-21T10:00:00.000Z')
  m.portes[0]!.ouvrir()
  await appel
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  expect(m.ecrits.length).toBe(2)
  await m.horloge.advance(2000)
  expect(m.ecrits.length).toBe(4)
  c = lire(f)
  expect(c.agents).toEqual([{ id: 'a1', etat: 'pret', quoi: 'Écrire le lobby' }])
  expect(c.etat).toBe('en-travail')
  expect(c.archive).toBe(false)
  expect(f[`${FICHE}.bak`]).toContain('etat: en-travail')
})

for (const sortie of ['erreur', 'refus', 'leve'] as const) {
  test(`appel en erreur (${sortie}) : « bloqué »`, async ($, on) => {
    const f = lie()
    const m = monde(on, f)
    await demarrer($)
    const appel = $.tool.call(agent('a1')).catch(() => undefined)
    await m.horloge.settle()
    if (sortie === 'erreur') m.portes[0]!.ouvrir({ result: 'x', isError: true })
    else if (sortie === 'refus') m.portes[0]!.ouvrir({ deny: 'non' })
    else m.portes[0]!.fermer(new Error('plantage'))
    await appel
    await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
    expect(live(m.etat).derniers.map(d => [d.agent, d.etat])).toEqual([['a1', 'bloque']])
    expect(live(m.etat).appels).toEqual([])
    await m.horloge.advance(2000)
    expect(lire(f).agents[0]!.etat).toBe('bloque')
  })
}

test('deux appels en parallèle du même agent : une seule issue, à la fin du dernier', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  const a = $.tool.call(agent('a1', 'Premier'))
  const b = $.tool.call(agent('a1', 'Second'))
  await m.horloge.settle()
  expect(live(m.etat).appels.length).toBe(2)
  m.portes[0]!.ouvrir({ result: 'x', isError: true })
  await a
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  expect(live(m.etat).appels.length).toBe(1)
  expect(live(m.etat).derniers).toEqual([])
  await m.horloge.advance(2000)
  expect(lire(f).agents[0]!.etat).toBe('en-travail')
  m.portes[1]!.ouvrir()
  await b
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  await m.horloge.advance(2000)
  expect(live(m.etat).derniers.map(d => d.etat)).toEqual(['pret'])
  expect(lire(f).agents[0]!.etat).toBe('pret')
})

test('limite : au plus une écriture par chantier toutes les 2 s, les agents rapprochés sont fusionnés', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  const a = $.tool.call(agent('a1'))
  await m.horloge.settle()
  const b = $.tool.call(agent('a2', 'Autre'))
  const c = $.tool.call(agent('a3', 'Encore'))
  await m.horloge.settle()
  expect(m.ecrits.filter(p => p === FICHE).length).toBe(1)
  await m.horloge.advance(1000)
  expect(m.ecrits.filter(p => p === FICHE).length).toBe(1)
  await m.horloge.advance(1000)
  expect(m.ecrits.filter(p => p === FICHE).length).toBe(2)
  expect(lire(f).agents.map(x => [x.id, x.etat])).toEqual([['a1', 'en-travail'], ['a2', 'en-travail'], ['a3', 'en-travail']])
  for (const p of m.portes) p.ouvrir()
  await Promise.all([a, b, c])
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
})

for (const sessions of [{ autre: 'lobby' }, { s1: 'inexistant' }]) {
  test(`session non liée (${JSON.stringify(sessions)}) : l’atome vit, aucun fichier n’est écrit`, async ($, on) => {
    const f = lie(sessions)
    const m = monde(on, f)
    await demarrer($)
    const a = $.tool.call(agent('a1'))
    await m.horloge.settle()
    expect(live(m.etat).appels.length).toBe(1)
    m.portes[0]!.ouvrir()
    await a
    await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
    await m.horloge.advance(5000)
    expect(m.ecrits).toEqual([])
  })
}

test('chantier d’un autre membre : jamais d’écriture hors du dossier du membre courant', async ($, on) => {
  const f: Fichiers = {
    ...dossierPages(),
    'C:/Projet/.pilotage/equipe/sam/chantiers/lobby.md': serializeChantier(fiche({ auteur: 'Sam' })),
    'C:/Projet/.pilotage/equipe/sam/sessions.json': JSON.stringify({ s1: 'lobby' }),
  }
  const m = monde(on, f)
  await demarrer($)
  const a = $.tool.call(agent('a1'))
  await m.horloge.settle()
  m.portes[0]!.ouvrir()
  await a
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  await m.horloge.advance(5000)
  expect(m.ecrits).toEqual([])
  expect(live(m.etat).derniers.length).toBe(1)
})

test('chantier archivé : aucune écriture', async ($, on) => {
  const f = lie()
  f[FICHE] = serializeChantier(fiche({ archive: true }))
  const m = monde(on, f)
  await demarrer($)
  const a = $.tool.call(agent('a1'))
  await m.horloge.settle()
  m.portes[0]!.ouvrir()
  await a
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  await m.horloge.advance(5000)
  expect(m.ecrits).toEqual([])
})

test('écriture refusée : l’appel se déroule normalement, l’erreur est gardée dans erreurEcriture, rien ne lève', async ($, on) => {
  const f = lie()
  const m = monde(on, f, { ecriture: () => true })
  await demarrer($)
  const a = $.tool.call(agent('a1'))
  await m.horloge.settle()
  expect(String(m.etat.erreurEcriture ?? '')).toMatch(/écriture/)
  m.portes[0]!.ouvrir({ result: 'fini' })
  expect((await a).result).toBe('fini')
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  expect(live(m.etat).derniers.map(d => d.etat)).toEqual(['pret'])
  expect(m.ecrits).toEqual([])
})

test('écriture qui réussit ensuite : l’erreur précédente est effacée', async ($, on) => {
  const f = lie()
  let refuser = true
  const m = monde(on, f, { ecriture: () => refuser })
  await demarrer($)
  const a = $.tool.call(agent('a1'))
  await m.horloge.settle()
  expect(String(m.etat.erreurEcriture ?? '')).not.toBe('')
  refuser = false
  m.portes[0]!.ouvrir()
  await a
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  await m.horloge.advance(2000)
  expect(m.etat.erreurEcriture).toBe('')
})

test('question à la personne (AskUserQuestion) : le chantier est « en attente » pendant la question, puis revient à « en travail »', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  const q = $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Lequel ?', header: 'Choix', options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }], multiSelect: false }] } as never)
  await m.horloge.settle()
  expect(live(m.etat).attentes.length).toBe(1)
  expect(lire(f).etat).toBe('attente')
  m.portes[0]!.ouvrir()
  await q
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  expect(live(m.etat).attentes).toEqual([])
  await m.horloge.advance(2000)
  expect(lire(f).etat).toBe('en-travail')
  expect(lire(f).agents).toEqual([])
})

test('sans projet ouvert : le hook passe son chemin, rien dans l’atome, rien d’écrit', async ($, on) => {
  const f: Fichiers = { 'C:/Projet/x.txt': 'a' }
  const m = monde(on, f)
  await demarrer($)
  const a = $.tool.call(agent('a1'))
  await m.horloge.settle()
  m.portes[0]!.ouvrir({ result: 'ok' })
  expect((await a).result).toBe('ok')
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  expect(live(m.etat).appels).toEqual([])
  expect(live(m.etat).derniers).toEqual([])
  expect(m.ecrits).toEqual([])
})

test('projet qui change ou devient invalide : les agents suivis sont retirés et les écritures en attente abandonnées', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  const a = $.tool.call(agent('a1'))
  const b = $.tool.call(agent('a2'))
  await m.horloge.settle()
  expect(live(m.etat).appels.length).toBe(2)
  const avant = m.ecrits.length
  f['C:/Projet/.pilotage/projet.json'] = '{"version":2}'
  await $.command.run({ command: 'pilotage' })
  expect(m.etat.actif).toBe(false)
  expect(live(m.etat)).toEqual({ appels: [], derniers: [], attentes: [] })
  await m.horloge.advance(5000)
  expect(m.ecrits.length).toBe(avant)
  m.portes[0]!.ouvrir()
  m.portes[1]!.ouvrir()
  await Promise.all([a, b])
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
  expect(live(m.etat).appels).toEqual([])
  await m.horloge.advance(5000)
  expect(m.ecrits.length).toBe(avant)
})

test('/pilotage relancé sur le même projet : les appels en cours ne sont pas perdus', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  const a = $.tool.call(agent('a1'))
  await m.horloge.settle()
  await $.command.run({ command: 'pilotage' })
  expect(live(m.etat).appels.length).toBe(1)
  m.portes[0]!.ouvrir()
  await a
  await m.horloge.settle() // le suivi se fait sans retarder l’outil : on le laisse finir
})

// ---- Le suivi ne casse, ne retarde et ne change jamais un appel d'outil ----

// (Un résultat vide, un texte ou un objet sans champ : le socle de test refuse ces réponses de l'outil, on ne peut pas les faire
// rendre par `next` ; `classerResultat` et `cleDAppel` les couvrent dans agents-live.spec.ts, et le hook les appelle sans lever.)

test('sous-type absent ou d’un autre plugin : aucun suivi (ni atome, ni écriture)', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  for (const entree of [{ tool: 'Agent', description: 'x', prompt: 'p' }, agent('autre-plugin:a1')]) {
    const a = $.tool.call(entree as never)
    await m.horloge.settle()
    m.portes.at(-1)!.ouvrir()
    await a
    await m.horloge.settle()
  }
  expect(live(m.etat)).toEqual({ appels: [], derniers: [], attentes: [] })
  expect(m.ecrits).toEqual([])
})

test('disque qui ne répond jamais : l’appel d’outil se termine quand même, les suivants sont suivis', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  m.pannes.lecture = true
  const a = $.tool.call(agent('a1'))
  await m.horloge.settle()
  m.portes[0]!.ouvrir({ result: 'fini' })
  expect((await a).result).toBe('fini')
  m.pannes.lecture = false
  const b = $.tool.call(agent('a2'))
  await m.horloge.settle()
  expect(live(m.etat).appels.map(x => x.agent)).toEqual(['a2'])
  m.portes[1]!.ouvrir()
  await b
})

test('écriture d’état qui ne répond jamais : l’appel se termine, l’étape est abandonnée après 2 s et la file continue', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  m.pannes.etat = true
  const a = $.tool.call(agent('a1'))
  await m.horloge.settle()
  m.portes[0]!.ouvrir({ result: 'fini' })
  expect((await a).result).toBe('fini')
  m.pannes.etat = false
  const b = $.tool.call(agent('a2'))
  await m.horloge.settle()
  expect(live(m.etat).appels).toEqual([])
  await m.horloge.advance(2000)
  await m.horloge.advance(2000)
  expect(live(m.etat).appels.map(x => x.agent)).toEqual(['a2'])
  m.portes[1]!.ouvrir()
  await b
})

test('question à la personne : un suivi figé ne retarde pas la réponse', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  m.pannes.lecture = true
  const q = $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never)
  await m.horloge.settle()
  m.portes[0]!.ouvrir({ result: 'A' })
  expect((await q).result).toBe('A')
  expect(m.ecrits).toEqual([])
})

test('appel en arrière-plan : « en travail » écrit au début, jamais « prêt » à son retour', async ($, on) => {
  const f = lie()
  const m = monde(on, f)
  await demarrer($)
  const a = $.tool.call({ ...agent('a1'), run_in_background: true } as never)
  await m.horloge.settle()
  m.portes[0]!.ouvrir({ result: 'lancé' })
  await a
  await m.horloge.advance(5000)
  expect(lire(f).agents).toEqual([{ id: 'a1', etat: 'en-travail', quoi: 'Écrire le lobby' }])
  expect(live(m.etat).derniers).toEqual([])
  expect(live(m.etat).appels).toEqual([])
})
