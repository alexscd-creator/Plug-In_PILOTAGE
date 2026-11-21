import { expect, test } from 'claude-code/testing'

import { HOME, PANE, disque, etatSimule } from './disque'

const PROJET = JSON.stringify({
  version: 1, nom: 'Mon jeu', but: 'b', fini: 'f', preset: 'roblox', equipe: ['Léa'],
  poles: [{ id: 'code', titre: 'Code' }], phases: [{ id: 'p1', titre: 'Idées', taches: [] }],
  agents: [], workflow: { outils: [] },
})
const FAITS = { model: 'm', promptModel: 'm', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as const

/** Socle simulé : enregistrement de commande, cwd de la session, composition du prompt, ouverture de panneau. */
function socle(on: Function, cwd: string | (() => string), commandeEnPanne = false): string[] {
  on('command.register', () => {
    if (commandeEnPanne) throw new Error('refusé')
    return { value: undefined }
  })
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: typeof cwd === 'string' ? cwd : cwd() }))
  on('prompt.compose', () => ({ sections: [] }))
  const ouverts: string[] = []
  on('ui.open', (_: unknown, e: { id: string }) => {
    ouverts.push(e.id)
    return { value: { isPlaced: true } }
  })
  return ouverts
}
const demarrer = ($: any, cwd: string) => $.session.start({ cwd, surface: 'terminal', isInteractive: true })
const ids = async ($: any): Promise<string[]> => (await $.prompt.compose(FAITS)).sections.map((s: { id: string }) => s.id)

test('session sans marqueur : aucun panneau, aucune section de prompt', async ($, on) => {
  disque(on, { 'C:/Projet/x.txt': 'a' })
  const ouverts = socle(on, 'C:/Projet')
  await demarrer($, 'C:/Projet')
  expect(ouverts).toEqual([])
  expect(await ids($)).toEqual([])
})

test('session avec marqueur valide : panneau ouvert dès le départ, prompt inchangé', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET })
  const ouverts = socle(on, 'C:/Projet')
  await demarrer($, 'C:/Projet')
  expect(ouverts).toEqual([PANE.requestId])
  expect(await ids($)).toEqual([])
})

test('marqueur dans un dossier parent : panneau ouvert', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET })
  const ouverts = socle(on, 'C:/Projet/src')
  await demarrer($, 'C:/Projet/src')
  expect(ouverts).toEqual([PANE.requestId])
})

test('marqueur invalide : pas de panneau, /pilotage répond avec les erreurs', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': '{"version":2}' })
  const ouverts = socle(on, 'C:/Projet')
  await demarrer($, 'C:/Projet')
  expect(ouverts).toEqual([])
  const r = await $.command.run({ command: 'pilotage' })
  expect(r.text).toMatch(/invalide/)
  expect(r.text).toMatch(/version/)
  expect(ouverts).toEqual([])
})

test('/pilotage sans marqueur : propose /demarrer', async ($, on) => {
  disque(on, {})
  const ouverts = socle(on, 'C:/Projet')
  await demarrer($, 'C:/Projet')
  const r = await $.command.run({ command: 'pilotage' })
  expect(r.text).toMatch(/Aucun projet/)
  expect(r.text).toMatch(/\/demarrer/)
  expect(ouverts).toEqual([])
})

test('/pilotage avec marqueur valide : ouvre le panneau', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET })
  const ouverts = socle(on, 'C:/Projet')
  const r = await $.command.run({ command: 'pilotage' })
  expect(r.text).toBe('Projet « Mon jeu » ouvert.')
  expect(ouverts).toEqual([PANE.requestId])
  expect(await ids($)).toEqual([])
})

test('la config du membre est lue sans bloquer l\'ouverture', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET, [`${HOME}/.claude/pilotage/config.json`]: '{"prenom":"lea"}' })
  const ouverts = socle(on, 'C:/Projet')
  await demarrer($, 'C:/Projet')
  expect(ouverts).toEqual([PANE.requestId])
})

const CONFIG_LEA = `${HOME}/.claude/pilotage/config.json`
const avecEtat = (on: Function, cwd: string | (() => string), enPanne = false) => ({
  ouverts: socle(on, cwd, enPanne),
  etat: etatSimule(on),
})

test('marqueur valide : actif, projetTrouve et membre (config) relus', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET, [CONFIG_LEA]: '{"prenom":"lea"}' })
  const { etat } = avecEtat(on, 'C:/Projet')
  await demarrer($, 'C:/Projet')
  expect(etat.actif).toBe(true)
  expect(etat.projetTrouve).toBe('C:/Projet')
  expect(etat.membre).toBe('Léa')
  expect(etat.erreursMarqueur).toEqual([])
})

test('config absente ou corrompue : membre vide, projet tout de même ouvert', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET })
  const a = avecEtat(on, 'C:/Projet')
  await demarrer($, 'C:/Projet')
  expect(a.etat.actif).toBe(true)
  expect(a.etat.membre).toBe('')
})

test('config corrompue : membre vide', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET, [CONFIG_LEA]: '{pas du json' })
  const { etat } = avecEtat(on, 'C:/Projet')
  await demarrer($, 'C:/Projet')
  expect(etat.actif).toBe(true)
  expect(etat.membre).toBe('')
})

test('marqueur invalide : actif faux, erreursMarqueur remplies', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': '{"version":2}' })
  const { etat } = avecEtat(on, 'C:/Projet')
  await demarrer($, 'C:/Projet')
  expect(etat.actif).toBeFalsy()
  expect((etat.erreursMarqueur as string[]).length).toBeGreaterThan(0)
})

test('le dossier change vers un dossier sans marqueur : /pilotage remet tout à zéro', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET, [CONFIG_LEA]: '{"prenom":"Léa"}', 'C:/Autre/x.txt': 'a' })
  let cwd = 'C:/Projet'
  const { etat } = avecEtat(on, () => cwd)
  await demarrer($, 'C:/Projet')
  expect(etat.actif).toBe(true)
  cwd = 'C:/Autre'
  const r = await $.command.run({ command: 'pilotage' })
  expect(r.text).toMatch(/Aucun projet/)
  expect(etat.actif).toBe(false)
  expect(etat.projetTrouve).toBe('')
  expect(etat.membre).toBe('')
})

test('le dossier change vers un marqueur invalide : /pilotage remet tout à zéro', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET, 'C:/Mauvais/.pilotage/projet.json': '{"version":2}' })
  let cwd = 'C:/Projet'
  const { etat } = avecEtat(on, () => cwd)
  await demarrer($, 'C:/Projet')
  cwd = 'C:/Mauvais'
  const r = await $.command.run({ command: 'pilotage' })
  expect(r.text).toMatch(/invalide/)
  expect(etat.actif).toBe(false)
  expect(etat.projetTrouve).toBe('')
  expect(etat.membre).toBe('')
  expect((etat.erreursMarqueur as string[]).length).toBeGreaterThan(0)
})

test('un disque qui échoue : la session démarre quand même, aucun panneau', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET }, true)
  const { ouverts } = avecEtat(on, 'C:/Projet')
  const r = await demarrer($, 'C:/Projet')
  expect(r.cwd).toBe('C:/Projet')
  expect(ouverts).toEqual([])
})

test('un hook qui lève : la session démarre quand même', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET })
  const { ouverts } = avecEtat(on, 'C:/Projet', true)
  const r = await demarrer($, 'C:/Projet')
  expect(r.cwd).toBe('C:/Projet')
  expect(ouverts).toEqual([])
})

test('un échec après un changement de dossier remet tout à zéro (actif, projetTrouve, membre)', async ($, on) => {
  disque(on, { 'C:/Projet/.pilotage/projet.json': PROJET, 'C:/Autre/.pilotage/projet.json': PROJET, [CONFIG_LEA]: '{"prenom":"Léa"}' })
  let cwd = 'C:/Projet'
  let panne = false
  on('command.register', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: cwd }))
  on('prompt.compose', () => ({ sections: [] }))
  on('ui.open', () => {
    if (panne) throw new Error('disque en panne')
    return { value: { isPlaced: true } }
  })
  const etat = etatSimule(on)
  await demarrer($, 'C:/Projet')
  expect(etat.actif).toBe(true)
  expect(etat.membre).toBe('Léa')
  cwd = 'C:/Autre'
  panne = true
  const r = await $.command.run({ command: 'pilotage' })
  expect(r.text).toMatch(/pas pu/)
  expect(etat.actif).toBe(false)
  expect(etat.projetTrouve).toBe('')
  expect(etat.membre).toBe('')
})
