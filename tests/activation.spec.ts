import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trouverProjet, membreCourant, lirePrenomConfig } from '../hooks/model/activation.ts'
import type { FsLike } from '../hooks/model/activation.ts'
const BS = String.fromCharCode(92)
const win = (s: string): string => s.replaceAll('/', BS)
import type { Projet } from '../hooks/model/projet.ts'

const projet: Projet = {
  version: 1, nom: 'Mon jeu', but: 'b', fini: 'f', preset: 'roblox', equipe: ['Léa', 'Sam'],
  poles: [{ id: 'code', titre: 'Code' }], phases: [{ id: 'p1', titre: 'Idées', taches: [] }],
  agents: [], workflow: { outils: [] },
}
const VALIDE = JSON.stringify(projet)

/** Faux disque : chemins en barres obliques, les dossiers se déduisent des fichiers. */
function fsDe(fichiers: Record<string, string>): FsLike {
  const sl = (p: string) => p.replaceAll(BS, '/')
  return {
    read: async p => {
      const t = fichiers[sl(p)]
      if (t === undefined) throw new Error('absent')
      return t
    },
    list: async p => {
      const pre = sl(p).replace(/\/$/, '') + '/'
      const noms = new Set<string>()
      for (const f of Object.keys(fichiers)) if (f.startsWith(pre)) noms.add(f.slice(pre.length).split('/')[0]!)
      if (noms.size === 0) throw new Error('dossier absent')
      return [...noms]
    },
  }
}

test('marqueur dans le dossier lui-même', async () => {
  const r = await trouverProjet(fsDe({ 'C:/Jeux/Mon jeu/.pilotage/projet.json': VALIDE }), 'C:/Jeux/Mon jeu')
  assert.deepEqual(r, { racine: 'C:/Jeux/Mon jeu', projet })
})

test('marqueur dans un dossier parent', async () => {
  const r = await trouverProjet(fsDe({ 'C:/Jeux/.pilotage/projet.json': VALIDE }), 'C:/Jeux/Mon jeu/src/')
  assert.deepEqual(r, { racine: 'C:/Jeux', projet })
})

test('aucun marqueur : null', async () => {
  assert.equal(await trouverProjet(fsDe({ 'C:/Autre/x.txt': 'a' }), 'C:/Jeux/Mon jeu'), null)
})

test('marqueur à la racine du disque', async () => {
  const r = await trouverProjet(fsDe({ 'C:/.pilotage/projet.json': VALIDE }), 'C:/Jeux')
  assert.deepEqual(r, { racine: 'C:', projet })
})

test('marqueur invalide : erreurs', async () => {
  const r = await trouverProjet(fsDe({ 'C:/Jeux/.pilotage/projet.json': '{"version":2}' }), 'C:/Jeux/sous')
  assert.ok(r && 'erreurs' in r)
  assert.equal(r.racine, 'C:/Jeux')
  assert.ok(r.erreurs.length > 0)
})

test('chemin Windows avec espaces et antislashs', async () => {
  const fs = fsDe({ 'D:/PRO STOCKAGE 02/Mon Jeu/.pilotage/projet.json': VALIDE })
  const r = await trouverProjet(fs, win('D:/PRO STOCKAGE 02/Mon Jeu/Scripts/Serveur'))
  assert.deepEqual(r, { racine: 'D:/PRO STOCKAGE 02/Mon Jeu', projet })
})

test('chemin POSIX, marqueur à la racine', async () => {
  const fs = fsDe({ '/home/lea/jeu/.pilotage/projet.json': VALIDE })
  assert.deepEqual(await trouverProjet(fs, '/home/lea/jeu/src'), { racine: '/home/lea/jeu', projet })
  assert.deepEqual(await trouverProjet(fsDe({ '/.pilotage/projet.json': VALIDE }), '/tmp'), { racine: '', projet })
  assert.equal(await trouverProjet(fs, '/home/sam'), null)
})

test('une copie de conflit du marqueur est ignorée', async () => {
  const seule = fsDe({ 'C:/Jeux/.pilotage/projet (1).json': VALIDE })
  assert.equal(await trouverProjet(seule, 'C:/Jeux'), null)
  const deux = fsDe({ 'C:/Jeux/.pilotage/projet.json': VALIDE, 'C:/Jeux/.pilotage/projet (1).json': '{"version":9}' })
  const r = await trouverProjet(deux, 'C:/Jeux')
  assert.deepEqual(r, { racine: 'C:/Jeux', projet })
})

test('ne lève jamais, même si le disque échoue', async () => {
  const casse: FsLike = { read: async () => { throw new Error('x') }, list: async () => { throw new Error('y') } }
  assert.equal(await trouverProjet(casse, 'C:/Jeux'), null)
  assert.equal(await trouverProjet(casse, ''), null)
})

test('membreCourant : accents, casse, absent', () => {
  assert.equal(membreCourant(projet, 'lea'), 'Léa')
  assert.equal(membreCourant(projet, ' LÉA '), 'Léa')
  assert.equal(membreCourant(projet, 'Sam'), 'Sam')
  assert.equal(membreCourant(projet, 'Paul'), null)
  assert.equal(membreCourant(projet, null), null)
})

test('lirePrenomConfig : lit le prénom, sinon null', async () => {
  const lus: string[] = []
  const ok = await lirePrenomConfig(win('C:/Users/Jo'), async p => { lus.push(p); return '{"prenom":"Léa"}' })
  assert.equal(ok, 'Léa')
  assert.equal(lus[0], win('C:/Users/Jo/.claude/pilotage/config.json'))
  assert.equal(await lirePrenomConfig('C:/Users/Jo', async () => ''), null)
  assert.equal(await lirePrenomConfig('C:/Users/Jo', async () => '{"prenom":3}'), null)
  assert.equal(await lirePrenomConfig(undefined, async () => '{"prenom":"a"}'), null)
  assert.equal(await lirePrenomConfig('C:/Users/Jo', async () => { throw new Error('x') }), null)
})
