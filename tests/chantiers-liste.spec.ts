import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { FsLike } from '../hooks/model/activation.ts'
import type { Chantier } from '../hooks/model/chantier.ts'
import { chantierDeSession, etatAgentAffiche, etatStatut, grouperChantiers, nomAgent, resumePassation, separerAvis } from '../hooks/model/chantiers.ts'
import { lireSessions } from '../hooks/model/lecture.ts'
import type { Projet } from '../hooks/model/projet.ts'
import { avancementPole } from '../hooks/model/synthese.ts'

const c = (id: string, extra: Partial<Chantier> = {}): Chantier => ({
  id, titre: `Chantier ${id}`, pole: 'code', phase: 'p1', etat: 'en-travail', session: `sess-${id}`, agents: [], taches: [],
  fichiers: [], cree: '2026-11-01T10:00:00Z', maj: '2026-11-02T10:00:00Z', passation: '', archive: false, auteur: 'Léa', ...extra,
})

test('grouperChantiers : en cours / archivés, du plus récemment mis à jour au plus ancien', () => {
  const g = grouperChantiers([
    c('a', { maj: '2026-11-02T10:00:00Z' }), c('b', { maj: '2026-11-05T10:00:00Z' }), c('z', { archive: true, maj: '2026-10-01T10:00:00Z' }),
    c('y', { archive: true, maj: '2026-10-09T10:00:00Z' }), c('x', { maj: 'illisible' }),
  ])
  assert.deepEqual(g.enCours.map(x => x.id), ['b', 'a', 'x'])
  assert.deepEqual(g.archives.map(x => x.id), ['y', 'z'])
})

test('grouperChantiers : liste vide, entrée non tableau, égalité de date départagée par id', () => {
  assert.deepEqual(grouperChantiers([]), { enCours: [], archives: [] })
  assert.deepEqual(grouperChantiers(null as never), { enCours: [], archives: [] })
  assert.deepEqual(grouperChantiers([c('b'), c('a')]).enCours.map(x => x.id), ['a', 'b'])
})

test('chantierDeSession : par id de session, jamais un chantier archivé, jamais d’erreur', () => {
  const liste = [c('a'), c('b'), c('old', { archive: true })]
  const carte = new Map([['s1', 'b'], ['s2', 'old'], ['s3', 'absent'], ['__proto__', 'a']])
  assert.equal(chantierDeSession(liste, carte, 's1')?.id, 'b')
  assert.equal(chantierDeSession(liste, carte, 's2'), null)
  assert.equal(chantierDeSession(liste, carte, 's3'), null)
  assert.equal(chantierDeSession(liste, carte, 'inconnue'), null)
  assert.equal(chantierDeSession(liste, carte, ''), null)
  assert.equal(chantierDeSession(liste, carte, undefined as never), null)
  assert.equal(chantierDeSession(liste, new Map(), 's1'), null)
  assert.equal(chantierDeSession(liste, carte, 'constructor'), null)
})

test('etatStatut : chaque état de fiche a son état de pastille (pret = Prêt à reprendre)', () => {
  assert.deepEqual(
    (['en-travail', 'attente', 'arrete', 'pret', 'bloque', 'termine'] as const).map(etatStatut),
    ['travail', 'attente', 'arrete', 'reprendre', 'bloque', 'termine'],
  )
})

test('etatAgentAffiche : un agent actif d’un chantier sans nouvelle depuis 15 minutes est « prêt »', () => {
  const maintenant = Date.parse('2026-11-21T12:00:00Z')
  const vieux = c('a', { maj: '2026-11-21T11:00:00Z' })
  const frais = c('a', { maj: '2026-11-21T11:55:00Z' })
  assert.equal(etatAgentAffiche(vieux, 'en-travail', maintenant), 'pret')
  assert.equal(etatAgentAffiche(vieux, 'bloque', maintenant), 'bloque')
  assert.equal(etatAgentAffiche(frais, 'en-travail', maintenant), 'en-travail')
})

test('separerAvis : les lignes « (avertissement) » se séparent des erreurs', () => {
  const r = separerAvis(['La fiche x est écartée.', '(avertissement) chemin : fichier écarté', 'autre'])
  assert.deepEqual(r.erreurs, ['La fiche x est écartée.', 'autre'])
  assert.deepEqual(r.avertissements, ['chemin : fichier écarté'])
  assert.deepEqual(separerAvis(undefined as never), { erreurs: [], avertissements: [] })
})

test('resumePassation : une ligne, bornée, texte vide dit honnêtement', () => {
  assert.equal(resumePassation('  Reste\nles   portes. '), 'Reste les portes.')
  assert.equal(resumePassation(''), 'Aucune passation écrite.')
  const long = resumePassation('mot '.repeat(200))
  assert.ok(long.length <= 281 && long.endsWith('…'))
})

test('nomAgent : titre de l’agent du projet, sinon l’identifiant', () => {
  const projet = { agents: [{ id: 'developpeur', titre: 'Développeur', pole: 'code', skills: [], pourquoi: '' }] } as unknown as Projet
  assert.equal(nomAgent(projet, 'developpeur'), 'Développeur')
  assert.equal(nomAgent(projet, 'gardien'), 'gardien')
})

test('avancementPole : les tâches d’un chantier comptent avec le pôle du chantier', () => {
  const projet = { poles: [], agents: [] } as unknown as Projet
  const plan = [{ id: 'p1-1', titre: 'a', statut: 'termine', phase: 'p1', pole: 'code' }] as never
  const ch = [
    c('a', { taches: [{ titre: 'x', statut: 'termine' }, { titre: 'y', statut: 'a faire' }, { titre: 'z', statut: 'abandonne' }] }),
    c('b', { pole: 'art', taches: [{ titre: 'w', statut: 'termine' }] }),
  ]
  const r = avancementPole(projet, plan, 'code', ch)
  assert.deepEqual([r.total, r.faites, r.pourcent], [3, 2, 67])
  assert.equal(avancementPole(projet, plan, 'code').total, 1)
})

const R = 'C:/Projet/.pilotage'
const fsDe = (fichiers: Record<string, string>): FsLike => ({
  read: async p => {
    const t = fichiers[p.replaceAll(String.fromCharCode(92), '/')]
    if (t === undefined) throw new Error('absent')
    return t
  },
  list: async p => {
    const pre = p.replace(/\/$/, '') + '/'
    const n = new Set<string>()
    for (const f of Object.keys(fichiers)) if (f.startsWith(pre)) n.add(f.slice(pre.length).split('/')[0]!)
    if (n.size === 0) throw new Error('absent')
    return [...n]
  },
})

test('lireSessions : fusionne les sessions.json de l’équipe, ignore le reste, ne lève jamais', async () => {
  const fs = fsDe({
    [`${R}/equipe/lea/sessions.json`]: JSON.stringify({ s1: 'carte', s2: 12, s3: 'autre' }),
    [`${R}/equipe/sam/sessions.json`]: '{ pas du json',
    [`${R}/equipe/jo/sessions.json`]: '["liste"]',
    [`${R}/equipe/zoe/sessions.json`]: JSON.stringify({ s1: 'doublon', s4: 'paiement' }),
    [`${R}/equipe/zoe/chantiers/x.md`]: '',
  })
  const m = await lireSessions(fs, 'C:/Projet')
  assert.deepEqual([...m].sort(), [['s1', 'carte'], ['s3', 'autre'], ['s4', 'paiement']])
  assert.equal((await lireSessions(fs, '')).size, 0)
  assert.equal((await lireSessions(fsDe({}), 'C:/Projet')).size, 0)
  const panne: FsLike = { read: async () => { throw new Error('x') }, list: async () => { throw new Error('x') } }
  assert.equal((await lireSessions(panne, 'C:/Projet')).size, 0)
})
