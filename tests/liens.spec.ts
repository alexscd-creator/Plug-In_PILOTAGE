// Liens dans le projet, côté panneau : les entrées marquées `isLink` ne sont jamais lues, et le panneau n'écrit pas au travers d'un lien.
import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { FsLike } from '../hooks/model/activation.ts'
import { trouverProjet } from '../hooks/model/activation.ts'
import { lireFiches } from '../hooks/model/agents-registre.ts'
import { ecritureSure } from '../hooks/model/liens.ts'
import { lireNotes, lireProjetComplet, lireSessions } from '../hooks/model/lecture.ts'
import { serializeChantier } from '../hooks/model/chantier.ts'
import { DEFAUT_VOCABULAIRE, serializeProjet } from '../hooks/model/projet.ts'
import type { Projet } from '../hooks/model/projet.ts'
import { serializeNote } from '../hooks/model/notes.ts'

const projet: Projet = {
  version: 1, nom: 'P', but: 'b', fini: 'f', preset: 'autre', equipe: ['Léa'],
  poles: [{ id: 'code', titre: 'Code' }], phases: [{ id: 'p1', titre: 'Idées', taches: [] }],
  agents: [{ id: 'dev', titre: 'Dev', pole: 'code', skills: [], pourquoi: '' }, { id: 'vole', titre: 'Vole', pole: 'code', skills: [], pourquoi: '' }],
  workflow: { outils: [] }, vocabulaire: { ...DEFAUT_VOCABULAIRE }, reglagesDef: [], reglages: {},
}

/** Faux disque comme l'adaptateur du panneau : `list` ne rend jamais une entrée lien, et la note dans `liens`. */
function disque(fichiers: Record<string, string>, liens: string[]): FsLike & { lus: string[] } {
  const lus: string[] = []
  const vus: string[] = []
  return {
    lus,
    liens: vus,
    read: async p => { lus.push(p); if (!(p in fichiers)) throw new Error('absent'); return fichiers[p]! },
    list: async p => {
      const prefixe = p.replace(/\/$/, '') + '/'
      const noms = new Set<string>()
      for (const f of Object.keys(fichiers)) if (f.startsWith(prefixe)) noms.add(f.slice(prefixe.length).split('/')[0]!)
      for (const l of liens) if (l.startsWith(prefixe) && !l.slice(prefixe.length).includes('/')) noms.add(l.slice(prefixe.length))
      if (noms.size === 0 && !liens.some(l => p.startsWith(l))) throw new Error('absent')
      const sortie: string[] = []
      for (const n of noms) {
        if (liens.includes(prefixe + n)) vus.push(prefixe + n)
        else sortie.push(n)
      }
      return sortie
    },
  }
}

const R = 'C:/P'
const base = {
  [`${R}/.pilotage/projet.json`]: serializeProjet(projet),
  [`${R}/.pilotage/agents/dev.md`]: 'fiche dev',
  [`${R}/.pilotage/agents/vole.md`]: 'CLE SECRETE',
}

test('fiches d’agents : une fiche qui est un lien n’est jamais lue (le contenu ne va pas dans le prompt)', async () => {
  const fs = disque(base, [`${R}/.pilotage/agents/vole.md`])
  const f = await lireFiches(fs, R, projet)
  assert.deepEqual(f, { dev: 'fiche dev' })
  assert.ok(!fs.lus.includes(`${R}/.pilotage/agents/vole.md`))
})

test('fiches d’agents : un dossier agents qui est un lien n’est pas lu', async () => {
  const fs = disque(base, [`${R}/.pilotage/agents`])
  assert.deepEqual(await lireFiches(fs, R, projet), {})
  assert.ok(!fs.lus.some(p => p.includes('/agents/')))
})

test('chantiers, sessions et notes : les liens sont sautés avec un avertissement en français', async () => {
  const c = { id: 'a', titre: 'A', pole: '', phase: '', etat: 'attente' as const, session: '', agents: [], taches: [], fichiers: [], cree: '2026-01-01T00:00:00Z', maj: '2026-01-01T00:00:00Z', passation: '', archive: false, auteur: 'Léa' }
  const fichiers = {
    ...base,
    [`${R}/.pilotage/equipe/lea/chantiers/a.md`]: serializeChantier(c),
    [`${R}/.pilotage/equipe/lea/chantiers/b.md`]: serializeChantier({ ...c, id: 'b', titre: 'B' }),
    [`${R}/.pilotage/equipe/lea/sessions.json`]: '{"s1":"a"}',
    [`${R}/.pilotage/equipe/lea/idees/2026-01-01-x.md`]: serializeNote({ id: '2026-01-01-x', type: 'idee', titre: 'X', date: '2026-01-01T00:00:00Z', auteur: 'Léa', phase: '', chantier: '', lance: '', texte: 't' }),
  }
  const fs = disque(fichiers, [`${R}/.pilotage/equipe/lea/chantiers/b.md`, `${R}/.pilotage/equipe/lea/archive`])
  const l = await lireProjetComplet(fs, R, 'Léa')
  assert.deepEqual(l.chantiers.map(x => x.id), ['a'])
  assert.ok(!fs.lus.some(p => p.endsWith('/b.md')))
  assert.ok(l.erreursChantiers.some(e => /Lien ignoré/.test(e) && e.includes('.pilotage/equipe/lea/chantiers/b.md')), l.erreursChantiers.join(' | '))
  assert.ok(l.erreursChantiers.some(e => e.includes('.pilotage/equipe/lea/archive')))

  const fs2 = disque(fichiers, [`${R}/.pilotage/equipe/lea/sessions.json`, `${R}/.pilotage/equipe/lea/idees`])
  assert.equal((await lireSessions(fs2, R, ['Léa'])).size, 0)
  assert.ok(!fs2.lus.some(p => p.endsWith('sessions.json')))
  const n = await lireNotes(fs2, R, ['Léa'])
  assert.deepEqual(n.notes, [])
  assert.ok(n.erreurs.some(e => /Lien ignoré/.test(e)), n.erreurs.join(' | '))
})

test('un .pilotage ou un projet.json qui est un lien : le projet n’est pas lu, l’erreur le dit', async () => {
  for (const lien of [`${R}/.pilotage`, `${R}/.pilotage/projet.json`]) {
    const fs = disque(base, [lien])
    const t = await trouverProjet(fs, R)
    assert.ok(t && 'erreurs' in t, lien)
    assert.match((t as { erreurs: string[] }).erreurs.join(' '), /lien/)
    assert.ok(!fs.lus.includes(`${R}/.pilotage/projet.json`), lien)
  }
})

test('ecritureSure : refuse si la cible ou un dossier entre la racine et elle est un lien ou mène hors de la racine ; sans contrôle possible, accepte', async () => {
  const stat = (infos: Record<string, { isLink: boolean; realPath?: string }>) => async (p: string) => infos[p] ?? null
  const cible = `${R}/.pilotage/equipe/lea/chantiers/a.md`
  const ok = { isLink: false }
  assert.equal(await ecritureSure(stat({ [R]: { isLink: false, realPath: 'C:\\P' }, [`${R}/.pilotage`]: { isLink: false, realPath: 'C:\\P\\.pilotage' } }), R, cible), true)
  assert.equal(await ecritureSure(stat({ [R]: ok, [`${R}/.pilotage`]: ok, [`${R}/.pilotage/equipe`]: ok, [`${R}/.pilotage/equipe/lea`]: { isLink: true } }), R, cible), false)
  const dossiers = Object.fromEntries(['', '/.pilotage', '/.pilotage/equipe', '/.pilotage/equipe/lea', '/.pilotage/equipe/lea/chantiers'].map(s => [R + s, ok]))
  assert.equal(await ecritureSure(stat({ ...dossiers, [cible]: { isLink: true } }), R, cible), false)
  assert.equal(await ecritureSure(stat({ ...dossiers, [cible]: ok }), R, cible), true)
  assert.equal(await ecritureSure(stat({ [R]: { isLink: false, realPath: 'C:\\P' }, [`${R}/.pilotage`]: { isLink: false, realPath: 'C:\\Users\\x' } }), R, cible), false)
  assert.equal(await ecritureSure(stat({}), R, cible), true) // l'API ne répond pas : pas de contrôle possible
  assert.equal(await ecritureSure(stat({ [R]: ok }), R, 'C:/Autre/x.md'), false)
})
