import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { FsLike } from '../hooks/model/activation.ts'
import type { Chantier } from '../hooks/model/chantier.ts'
import { chantierDeSession, etatAgentAffiche, etatStatut, grouperChantiers, nomAgent, resumeErreurs, resumePassation, separerAvis } from '../hooks/model/chantiers.ts'
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
  const l = (id: string) => ({ chantier: id, auteur: 'Léa' })
  const carte = new Map([['s1', l('b')], ['s2', l('old')], ['s3', l('absent')], ['__proto__', l('a')]])
  assert.equal(chantierDeSession(liste, carte, 's1')?.id, 'b')
  assert.equal(chantierDeSession(liste, carte, 's2'), null)
  assert.equal(chantierDeSession(liste, carte, 's3'), null)
  assert.equal(chantierDeSession(liste, carte, 'inconnue'), null)
  assert.equal(chantierDeSession(liste, carte, ''), null)
  assert.equal(chantierDeSession(liste, carte, undefined as never), null)
  assert.equal(chantierDeSession(liste, new Map(), 's1'), null)
  assert.equal(chantierDeSession(liste, carte, 'constructor'), null)
})

test('chantierDeSession : deux membres, même id de chantier : celui du propriétaire du lien', () => {
  const liste = [c('carte', { auteur: 'Léa', titre: 'De Léa' }), c('carte', { auteur: 'Sam', titre: 'De Sam' })]
  assert.equal(chantierDeSession(liste, new Map([['s', { chantier: 'carte', auteur: 'Sam' }]]), 's')?.titre, 'De Sam')
  assert.equal(chantierDeSession(liste, new Map([['s', { chantier: 'carte', auteur: 'Léa' }]]), 's')?.titre, 'De Léa')
  // Propriétaire inconnu et deux candidats : on ne devine pas.
  assert.equal(chantierDeSession(liste, new Map([['s', { chantier: 'carte', auteur: 'Zoé' }]]), 's'), null)
  // Un seul chantier porte cet id : repli sur l'id seul, même si le propriétaire du lien est un autre membre.
  assert.equal(chantierDeSession([c('seul', { auteur: 'Léa' })], new Map([['s', { chantier: 'seul', auteur: 'Sam' }]]), 's')?.auteur, 'Léa')
  // Le chantier du propriétaire est archivé : pas de bandeau, pas de repli sur celui de l'autre.
  assert.equal(chantierDeSession([c('carte', { auteur: 'Léa', archive: true }), c('carte', { auteur: 'Sam' })], new Map([['s', { chantier: 'carte', auteur: 'Léa' }]]), 's'), null)
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
  const r = separerAvis(['La fiche x est écartée.', '(avertissement) chemin : fichier écarté', '(info) 12 fiches archivées plus anciennes ne sont pas affichées.', 'autre'])
  assert.deepEqual(r.erreurs, ['La fiche x est écartée.', 'autre'])
  assert.deepEqual(r.avertissements, ['chemin : fichier écarté'])
  assert.deepEqual(r.infos, ['12 fiches archivées plus anciennes ne sont pas affichées.'])
  assert.deepEqual(separerAvis(undefined as never), { erreurs: [], avertissements: [], infos: [] })
})

test('resumeErreurs : fiches et dossiers ont chacun leur formule', () => {
  const fiche = 'La fiche de chantier .pilotage/equipe/lea/chantiers/x.md est écartée : titre manquant.'
  assert.equal(resumeErreurs([fiche]), '1 fiche de chantier n’a pas pu être lue')
  assert.equal(resumeErreurs([fiche, 'Fiche trop volumineuse (> 256 Ko) : y.md']), '2 fiches de chantier n’ont pas pu être lues')
  assert.equal(resumeErreurs(['Le dossier archive de Léa (.pilotage/equipe/lea/archive) n’a pas pu être lu.']), 'Un dossier de chantiers n’a pas pu être lu.')
  assert.equal(resumeErreurs(['Les chantiers n’ont pas pu être lus.']), 'Un dossier de chantiers n’a pas pu être lu.')
  assert.equal(resumeErreurs([fiche, 'Le dossier archive de Léa (x) n’a pas pu être lu.']), '1 fiche de chantier n’a pas pu être lue. Un dossier de chantiers n’a pas pu être lu.')
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
  assert.deepEqual([r.total, r.faites, r.pourcent, r.dansChantiers], [3, 2, 67, 2])
  const sans = avancementPole(projet, plan, 'code')
  assert.deepEqual([sans.total, sans.dansChantiers], [1, 0])
})

test('avancementPole : une tâche de chantier au même titre qu’une tâche du plan du même pôle n’est pas comptée deux fois', () => {
  const projet = { poles: [], agents: [] } as unknown as Projet
  const plan = [
    { id: 'p1-1', titre: 'Poser le sol', statut: 'termine', phase: 'p1', pole: 'code' },
    { id: 'p1-2', titre: 'Peindre', statut: 'a faire', phase: 'p1', pole: 'art' },
  ] as never
  const ch = [
    c('a', { taches: [{ titre: '  poser LE  sol ', statut: 'termine' }, { titre: 'Écrire', statut: 'a faire' }] }),
    c('b', { taches: [{ titre: 'PEINDRE', statut: 'termine' }, { titre: 'Peindre', statut: 'termine' }] }),
  ]
  // Pôle code : « Poser le sol » (doublon, accents, casse et espaces ignorés) est écarté ; « Écrire » et les deux « Peindre » (le plan les range dans le pôle art) comptent.
  const r = avancementPole(projet, plan, 'code', ch)
  assert.deepEqual([r.total, r.faites, r.dansChantiers], [4, 3, 3])
  const plan2 = [{ id: 'p', titre: 'Écrire', statut: 'termine', phase: 'p1', pole: 'code' }] as never
  const accents = avancementPole(projet, plan2, 'code', [c('a', { taches: [{ titre: 'ecrire', statut: 'a faire' }] })])
  assert.deepEqual([accents.total, accents.dansChantiers], [1, 0])
})

test('avancementPole : un pôle qui n’a que des tâches de chantier', () => {
  const projet = { poles: [], agents: [] } as unknown as Projet
  const r = avancementPole(projet, [], 'code', [c('a', { taches: [{ titre: 'x', statut: 'termine' }, { titre: 'y', statut: 'a faire' }] })])
  assert.deepEqual([r.total, r.faites, r.pourcent, r.dansChantiers], [2, 1, 50, 2])
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

test('lireSessions : fusionne les sessions.json de l’équipe avec leur propriétaire, ignore le reste, ne lève jamais', async () => {
  const fs = fsDe({
    [`${R}/equipe/lea/sessions.json`]: JSON.stringify({ s1: 'carte', s2: 12, s3: 'autre' }),
    [`${R}/equipe/sam/sessions.json`]: '{ pas du json',
    [`${R}/equipe/jo/sessions.json`]: '["liste"]',
    [`${R}/equipe/zoe/sessions.json`]: JSON.stringify({ s1: 'doublon', s4: 'paiement' }),
    [`${R}/equipe/zoe/chantiers/x.md`]: '',
  })
  const m = await lireSessions(fs, 'C:/Projet', ['Léa', 'Zoé'])
  // Conflit : le premier dossier par ordre alphabétique (lea) garde s1. Propriétaire = nom du membre du projet, sinon le nom du dossier.
  assert.deepEqual([...m].sort(), [['s1', { chantier: 'carte', auteur: 'Léa' }], ['s3', { chantier: 'autre', auteur: 'Léa' }], ['s4', { chantier: 'paiement', auteur: 'Zoé' }]])
  assert.equal((await lireSessions(fs, '', [])).size, 0)
  assert.equal((await lireSessions(fsDe({}), 'C:/Projet', [])).size, 0)
  const panne: FsLike = { read: async () => { throw new Error('x') }, list: async () => { throw new Error('x') } }
  assert.equal((await lireSessions(panne, 'C:/Projet', [])).size, 0)
  assert.equal((await lireSessions(fs, 'C:/Projet')).get('s4')?.auteur, 'zoe')
})
