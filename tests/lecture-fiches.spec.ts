import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { FsLike } from '../hooks/model/activation.ts'
import { lireProjetComplet } from '../hooks/model/lecture.ts'
import { DEFAUT_VOCABULAIRE } from '../hooks/model/projet.ts'
import type { Projet } from '../hooks/model/projet.ts'

const projet: Projet = {
  version: 1, nom: 'Mon projet', but: 'b', fini: 'f', preset: 'autre', equipe: ['Léa'],
  poles: [{ id: 'code', titre: 'Code', couleur: 'bleu' }], phases: [{ id: 'p1', titre: 'Idées', taches: ['a'] }],
  agents: [
    { id: 'dev', titre: 'Développeur', pole: 'code', skills: ['luau', 'secu', 'Mauvais Nom'], pourquoi: 'x' },
    { id: 'autre', titre: 'Autre', pole: 'code', skills: ['luau'], pourquoi: '' },
  ],
  workflow: { outils: [] }, vocabulaire: { ...DEFAUT_VOCABULAIRE }, reglagesDef: [], reglages: {},
}
const R = 'C:/Projet/.pilotage'
const sl = (p: string) => p.replaceAll(String.fromCharCode(92), '/')

function fsDe(fichiers: Record<string, string>, panneListe: string[] = []): FsLike {
  return {
    read: async p => {
      const t = fichiers[sl(p)]
      if (t === undefined) throw new Error('absent')
      return t
    },
    list: async p => {
      const c = sl(p).replace(/\/$/, '')
      if (panneListe.includes(c)) throw new Error('liste en panne')
      const noms = new Set<string>()
      for (const f of Object.keys(fichiers)) if (f.startsWith(c + '/')) noms.add(f.slice(c.length + 1).split('/')[0]!)
      if (noms.size === 0) throw new Error('dossier absent')
      return [...noms]
    },
  }
}
const base = (extra: Record<string, string> = {}) => ({ [`${R}/projet.json`]: JSON.stringify(projet), ...extra })

test('fiches : seuls les fichiers présents sont vrais, un agent ou skill sans fiche est faux', async () => {
  const r = await lireProjetComplet(fsDe(base({ [`${R}/agents/dev.md`]: '# dev', [`${R}/skills/luau.md`]: '# luau' })), 'C:/Projet', 'Léa')
  assert.deepEqual(r.fichesAgents, { dev: true, autre: false })
  assert.deepEqual(r.fichesSkills, { luau: true, secu: false, 'Mauvais Nom': false })
})

test('fiches : aucun dossier agents ni skills, tout est faux sans erreur', async () => {
  const r = await lireProjetComplet(fsDe(base()), 'C:/Projet', 'Léa')
  assert.deepEqual(r.fichesAgents, { dev: false, autre: false })
  assert.deepEqual(r.fichesSkills, { luau: false, secu: false, 'Mauvais Nom': false })
  assert.deepEqual(r.erreurs, [])
})

test('fiches : un identifiant d’agent invalide est refusé dès parseProjet ; un skill au nom invalide n’est jamais vrai, même si le fichier existe', async () => {
  const invalide = { ...projet, agents: [...projet.agents, { id: 'Bad_Id', titre: 'Mauvais', pole: 'code', skills: [], pourquoi: '' }] }
  const refus = await lireProjetComplet(fsDe({ [`${R}/projet.json`]: JSON.stringify(invalide) }), 'C:/Projet', 'Léa')
  assert.equal(refus.projet, null)
  assert.match(refus.erreurs.join(' '), /Agent 3 : l'identifiant « Bad_Id »/)
  const r = await lireProjetComplet(fsDe(base({ [`${R}/skills/Mauvais Nom.md`]: 'x' })), 'C:/Projet', 'Léa')
  assert.equal(r.fichesSkills['Mauvais Nom'], false)
})

test('fiches : copies de conflit ignorées', async () => {
  const r = await lireProjetComplet(fsDe(base({ [`${R}/agents/dev (1).md`]: 'x', [`${R}/skills/secu (conflit).md`]: 'x', [`${R}/skills/Copie de luau.md`]: 'x' })), 'C:/Projet', 'Léa')
  assert.equal(r.fichesAgents['dev'], false)
  assert.equal(r.fichesSkills['secu'], false)
  assert.equal(r.fichesSkills['luau'], false)
})

test('fiches : une liste en panne ne lève jamais et rend tout faux', async () => {
  const r = await lireProjetComplet(fsDe(base({ [`${R}/agents/dev.md`]: 'x' }), [`${R}/agents`, `${R}/skills`]), 'C:/Projet', 'Léa')
  assert.equal(r.fichesAgents['dev'], false)
  assert.ok(r.projet)
})

test('fiches : sans projet, deux tables vides', async () => {
  const r = await lireProjetComplet(fsDe({}), 'C:/Projet', 'Léa')
  assert.deepEqual([r.fichesAgents, r.fichesSkills], [{}, {}])
})

test('skillsDisponibles : tous les fichiers .md valides de .pilotage/skills (cités ou non), triés ; sauvegardes, noms invalides et copies de conflit écartés', async () => {
  const f = base({
    [`${R}/skills/luau.md`]: '#', [`${R}/skills/zeta.md`]: '#', [`${R}/skills/alpha.md`]: '#',
    [`${R}/skills/alpha.md.bak`]: '#', [`${R}/skills/Mauvais Nom.md`]: '#', [`${R}/skills/notes.txt`]: '#',
    [`${R}/skills/${'x'.repeat(61)}.md`]: '#',
  })
  const r = await lireProjetComplet(fsDe(f), 'C:/Projet', 'Léa')
  assert.deepEqual(r.skillsDisponibles, ['alpha', 'luau', 'zeta'])
})

test('skillsDisponibles : dossier absent ou liste en panne : liste vide, rien ne lève', async () => {
  assert.deepEqual((await lireProjetComplet(fsDe(base()), 'C:/Projet', 'Léa')).skillsDisponibles, [])
  const r = await lireProjetComplet(fsDe(base({ [`${R}/skills/a.md`]: '#' }), [`${R}/skills`]), 'C:/Projet', 'Léa')
  assert.deepEqual(r.skillsDisponibles, [])
})
