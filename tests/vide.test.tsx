import { expect, test } from 'claude-code/testing'

import { banc, CONFIG_LEA, demarrer, PLAN, PROJET, TOUTES } from './banc'
import { PANE } from './disque'

const dossier = (j: object, plan = PLAN) => ({
  'C:/Projet/.pilotage/projet.json': JSON.stringify(j), 'C:/Projet/.pilotage/plan.md': plan, [CONFIG_LEA]: '{"prenom":"lea"}',
})

test('démarrage vide : « Aucun projet ici » et le bouton, sur chaque surface', async ($, on) => {
  const { ouverts } = banc(on, {})
  await demarrer($)
  expect(ouverts).toEqual([])
  for (const surface of TOUTES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'Aucun projet ici' })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /quelques questions, une à la fois/ })).toBeTruthy()
    expect((await ui.find({ key: 'demarrer' }))?.props.label).toBe('Démarrer un projet')
    expect(await ui.find({ type: 'Text', text: /\/demarrer/ })).toBeTruthy()
    expect(await ui.find({ key: 'navigation' })).toBeFalsy()
    await ui.unmount()
  }
})

test('« Démarrer un projet » : la commande part dans la conversation, rien d’autre n’est dit', async ($, on) => {
  banc(on, {})
  const envoyes: string[] = []
  on('command.run', (_: unknown, e: { command: string; args: string }) => { envoyes.push('/' + e.command + e.args); return { text: '' } })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'demarrer' })
  expect(envoyes).toEqual(['/demarrer'])
  expect(await ui.find({ type: 'Text', text: /zone de saisie|copiée|Collez/ })).toBeFalsy()
  await ui.unmount()
})

test('envoi impossible : la commande est préparée dans la zone de saisie', async ($, on) => {
  banc(on, {})
  const remplis: string[] = []
  on('prompt.fill', (_: unknown, e: { text: string }) => { remplis.push(e.text); return { isFilled: true } })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'demarrer' })
  expect(remplis).toEqual(['/demarrer'])
  expect(await ui.find({ type: 'Text', text: /prête dans la zone de saisie/ })).toBeTruthy()
  await ui.unmount()
})

test('ni envoi ni remplissage : la commande est copiée sur la surface de l’appui', async ($, on) => {
  banc(on, {})
  on('prompt.fill', () => ({ isFilled: false }))
  const copies: { text: string; surface?: string }[] = []
  on('ui.copy', (_: unknown, e: { text: string; surface?: string }) => { copies.push({ text: e.text, surface: e.surface }); return { value: { isCopied: true } } })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'demarrer' })
    expect(copies.at(-1)).toEqual({ text: '/demarrer', surface })
    expect(await ui.find({ type: 'Text', text: /Commande copiée/ })).toBeTruthy()
    await ui.unmount()
  }
})

test('tout échoue : la commande est affichée à taper, avec « Copier la commande »', async ($, on) => {
  banc(on, {})
  on('prompt.fill', () => ({ isFilled: false }))
  on('ui.copy', () => ({ value: { isCopied: false, reason: 'no-clipboard' } }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'demarrer' })
  expect(await ui.find({ type: 'Text', text: /Collez ou tapez cette commande/ })).toBeTruthy()
  expect(await ui.find({ key: 'commande-copier' })).toBeTruthy()
  await ui.press({ key: 'commande-copier' })
  expect(await ui.find({ type: 'Text', text: /Sélectionnez la commande/ })).toBeTruthy()
  await ui.unmount()
})

test('projet invalide : « Fichier de projet illisible », les erreurs en français, le fichier à copier', async ($, on) => {
  const { ouverts } = banc(on, { 'C:/Projet/.pilotage/projet.json': '{"version":2}' })
  await demarrer($)
  expect(ouverts).toEqual([])
  for (const surface of TOUTES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'Fichier de projet illisible' })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /\.pilotage\/projet\.json/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: /La version doit valoir 1/ })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: 'Que faire ?' })).toBeTruthy()
    expect((await ui.find({ key: 'copier-projet' }))?.props.label).toBe('Copier le chemin')
    expect((await ui.find({ key: 'reessayer' }))?.props.label).toBe('Réessayer')
    expect(await ui.find({ key: 'demarrer' })).toBeFalsy()
    await ui.unmount()
  }
})

test('projet invalide : copier le chemin le copie et le dit ; liste longue raccourcie', async ($, on) => {
  const beaucoup = JSON.stringify({ version: 2, equipe: 'x', poles: 1, phases: 1, agents: 1, workflow: 1, vocabulaire: 1, reglagesDef: 1, reglages: 1 })
  banc(on, { 'C:/Projet/.pilotage/projet.json': beaucoup })
  const copies: string[] = []
  const toasts: string[] = []
  on('ui.copy', (_: unknown, e: { text: string; surface?: string }) => { copies.push(e.text + '@' + e.surface); return { value: { isCopied: true } } })
  on('ui.toast', (_: unknown, e: { text: string }) => { toasts.push(e.text); return { value: undefined } })
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /et \d+ autre/ })).toBeTruthy()
  await ui.press({ key: 'copier-projet' })
  expect(copies).toEqual(['.pilotage/projet.json@desktop'])
  expect(toasts.at(-1)).toMatch(/Copié/)
  await ui.unmount()
})

test('« Réessayer » relit le fichier corrigé et ouvre le projet', async ($, on) => {
  const fichiers: Record<string, string> = { 'C:/Projet/.pilotage/projet.json': '{"version":2}' }
  banc(on, fichiers)
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Fichier de projet illisible' })).toBeTruthy()
  Object.assign(fichiers, dossier(PROJET))
  await ui.press({ key: 'reessayer' })
  expect(await ui.find({ type: 'Text', text: 'Fichier de projet illisible' })).toBeFalsy()
  expect(await ui.find({ key: 'navigation' })).toBeTruthy()
  await ui.unmount()
})

test('disque en panne après l’ouverture : l’écran d’erreur s’affiche, le panneau ne plante pas', async ($, on) => {
  const fichiers = dossier(PROJET)
  banc(on, fichiers)
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'navigation' })).toBeTruthy()
  delete (fichiers as Record<string, string>)['C:/Projet/.pilotage/projet.json']
  await ui.press({ key: 'nav-rafraichir' })
  expect(await ui.find({ type: 'Text', text: 'Fichier de projet illisible' })).toBeTruthy()
  await ui.unmount()
})
