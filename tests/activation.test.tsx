import { expect, test } from 'claude-code/testing'

import { HOME, PANE, disque } from './disque'

const PROJET = JSON.stringify({
  version: 1, nom: 'Mon jeu', but: 'b', fini: 'f', preset: 'roblox', equipe: ['Léa'],
  poles: [{ id: 'code', titre: 'Code' }], phases: [{ id: 'p1', titre: 'Idées', taches: [] }],
  agents: [], workflow: { outils: [] },
})
const FAITS = { model: 'm', promptModel: 'm', surfaces: ['terminal'], tools: [], outputStyle: null, traits: [] } as const

/** Socle simulé : enregistrement de commande, cwd de la session, composition du prompt, ouverture de panneau. */
function socle(on: Function, cwd: string): string[] {
  on('command.register', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: cwd }))
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
