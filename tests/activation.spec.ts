import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trouverProjet, membreCourant, lirePrenomConfig, ecrireConfigPrenom } from '../hooks/model/activation.ts'
import type { FsLike } from '../hooks/model/activation.ts'
const BS = String.fromCharCode(92)
const win = (s: string): string => s.replaceAll('/', BS)
import type { Projet } from '../hooks/model/projet.ts'
import { DEFAUT_VOCABULAIRE } from '../hooks/model/projet.ts'

const projet: Projet = {
  version: 1, nom: 'Mon jeu', but: 'b', fini: 'f', preset: 'roblox', equipe: ['Léa', 'Sam'],
  poles: [{ id: 'code', titre: 'Code' }], phases: [{ id: 'p1', titre: 'Idées', taches: [] }],
  agents: [], workflow: { outils: [] }, vocabulaire: { ...DEFAUT_VOCABULAIRE }, reglagesDef: [], reglages: {},
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

// ---- « Qui êtes-vous ? » : choisir son prénom écrit ~/.claude/pilotage/config.json ----
const moyens = (existant: string | null) => {
  const ecrits: { chemin: string; texte: string }[] = []
  return {
    ecrits,
    fs: {
      read: async (_p: string) => { if (existant === null) throw new Error('absent'); return existant },
      write: async (chemin: string, texte: string) => { ecrits.push({ chemin, texte }) },
    },
  }
}

test('ecrireConfigPrenom : écrit {"prenom"} pour un membre de l\'équipe, sans fichier existant', async () => {
  const m = moyens(null)
  const r = await ecrireConfigPrenom(m.fs, 'C:/Users/Jo', ['Léa', 'Sam'], 'Sam', async () => { throw new Error('pas de question') })
  assert.deepEqual(r, { ok: true })
  assert.equal(m.ecrits.length, 1)
  assert.equal(m.ecrits[0]!.chemin, 'C:/Users/Jo/.claude/pilotage/config.json')
  assert.deepEqual(JSON.parse(m.ecrits[0]!.texte), { prenom: 'Sam' })
  assert.equal(await lirePrenomConfig('C:/Users/Jo', async () => m.ecrits[0]!.texte), 'Sam') // se relit
})

test('ecrireConfigPrenom : refuse un prénom hors équipe ou au nom non sûr, rien n\'est écrit', async () => {
  const m = moyens(null)
  for (const mauvais of ['Paul', '', 'Sa"m', 'a/b']) {
    const r = await ecrireConfigPrenom(m.fs, 'C:/Users/Jo', ['Léa', 'Sam', 'Sa"m', 'a/b'].filter(x => x !== 'Paul'), mauvais, async () => true)
    assert.equal(r.ok, false, mauvais)
  }
  assert.equal(m.ecrits.length, 0)
})

test('ecrireConfigPrenom : sans dossier personnel, refuse', async () => {
  const m = moyens(null)
  assert.equal((await ecrireConfigPrenom(m.fs, '', ['Léa'], 'Léa', async () => true)).ok, false)
  assert.equal(m.ecrits.length, 0)
})

test('ecrireConfigPrenom : un autre prénom déjà enregistré demande confirmation (refus : rien ne change)', async () => {
  const m = moyens('{"prenom":"Alex"}')
  const questions: string[] = []
  const non = await ecrireConfigPrenom(m.fs, 'C:/Users/Jo', ['Léa'], 'Léa', async q => { questions.push(q); return false })
  assert.equal(non.ok, false)
  assert.equal(m.ecrits.length, 0)
  assert.match(questions[0]!, /Alex/)
  assert.match(questions[0]!, /Léa/)
  const oui = await ecrireConfigPrenom(m.fs, 'C:/Users/Jo', ['Léa'], 'Léa', async () => true)
  assert.deepEqual(oui, { ok: true })
  assert.equal(m.ecrits.length, 1)
})

test('ecrireConfigPrenom : même prénom déjà enregistré : aucune question', async () => {
  const m = moyens('{"prenom":"lea"}')
  const r = await ecrireConfigPrenom(m.fs, 'C:/Users/Jo', ['Léa'], 'Léa', async () => { throw new Error('pas de question') })
  assert.deepEqual(r, { ok: true })
})

test('ecrireConfigPrenom : un fichier existant illisible est remplacé sans question ; une écriture qui échoue est dite', async () => {
  const m = moyens('pas du json')
  assert.deepEqual(await ecrireConfigPrenom(m.fs, 'C:/Users/Jo', ['Léa'], 'Léa', async () => { throw new Error('non') }), { ok: true })
  const casse = { read: async () => { throw new Error('absent') }, write: async () => { throw new Error('disque plein') } }
  const r = await ecrireConfigPrenom(casse, 'C:/Users/Jo', ['Léa'], 'Léa', async () => true)
  assert.equal(r.ok, false)
})
