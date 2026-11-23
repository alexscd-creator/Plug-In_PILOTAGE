import { expect, test } from 'claude-code/testing'

import { CONFIG_LEA, TOUTES } from './banc'
import { disque, PANE, sl } from './disque'
import { PLAN_PAGES, PROJET_PAGES } from './fixture-pages'

const D = 'C:/Projet/.pilotage'
const PROJET = {
  ...PROJET_PAGES,
  poles: [{ id: 'code', titre: 'Technique', couleur: 'bleu' }],
  agents: [{ id: 'a1', titre: 'Alpha', pole: 'code', skills: ['luau', 'partage'], pourquoi: 'Écrit le code.' }],
}

type Opts = { config?: string; skills?: string[]; reponse?: string; remplir?: boolean }
function banc(on: Function, o: Opts = {}) {
  const fichiers: Record<string, string> = {
    [`${D}/projet.json`]: JSON.stringify(PROJET),
    [`${D}/plan.md`]: PLAN_PAGES,
    [`${D}/equipe/lea/portes.md`]: 'porte: p1\n',
    ...Object.fromEntries((o.skills ?? []).map(s => [`${D}/skills/${s}.md`, `# ${s}`])),
    ...(o.config === undefined ? {} : { [CONFIG_LEA]: o.config }),
  }
  disque(on, fichiers)
  const ecrits: string[] = []
  const toasts: string[] = []
  const questions: string[] = []
  const soumis: string[] = []
  const remplis: string[] = []
  on('fs.write', (_: unknown, e: { path: string; text: string }) => { ecrits.push(sl(e.path)); fichiers[sl(e.path)] = e.text; return { value: undefined } })
  on('fs.exists', (_: unknown, e: { path: string }) => ({ value: sl(e.path) in fichiers }))
  on('command.register', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/Projet' }))
  on('prompt.compose', () => ({ sections: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => new Promise(() => undefined))
  on('ui.toast', (_: unknown, e: { text: string }) => { toasts.push(e.text); return { value: undefined } })
  on('prompt.submit', (_: unknown, e: { text: string }) => { soumis.push(e.text); return { text: e.text, context: [] } })
  on('prompt.fill', (_: unknown, e: { text: string }) => { remplis.push(e.text); return { isFilled: o.remplir !== false } })
  on('tool.call', (_: unknown, e: { questions?: { question: string }[] }) => {
    const q = e.questions?.[0]?.question ?? ''
    questions.push(q)
    return { result: { questions: e.questions ?? [], answers: { [q]: o.reponse ?? '' } } }
  })
  return { fichiers, ecrits, toasts, questions, soumis, remplis }
}
const demarrer = ($: any) => $.session.start({ cwd: 'C:/Projet', surface: 'terminal', isInteractive: true })
const tout = async (ui: any) => JSON.stringify(await ui.find({ key: 'navigation' }) ?? '') + JSON.stringify(await ui.find({ type: 'Box' }) ?? '')

test('sans prénom enregistré : la carte « Qui êtes-vous ? » propose chaque membre, sur chaque surface', async ($, on) => {
  banc(on)
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'Qui êtes-vous ?' })).toBeTruthy()
    for (const m of PROJET.equipe) expect((await ui.find({ key: `identite-${m}` }))?.props.label).toBe(m)
    await ui.unmount()
  }
})

test('avec un prénom de l\'équipe enregistré : pas de carte', async ($, on) => {
  banc(on, { config: '{"prenom":"lea"}' })
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Qui êtes-vous ?' })).toBeFalsy()
  await ui.unmount()
})

test('choisir son prénom écrit config.json, la carte disparaît et les réglages s\'ouvrent', async ($, on) => {
  const b = banc(on)
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const membre = PROJET.equipe[1]!
  await ui.press({ key: `identite-${membre}` })
  expect(b.ecrits).toEqual([CONFIG_LEA])
  expect(JSON.parse(b.fichiers[CONFIG_LEA]!)).toEqual({ prenom: membre })
  expect(await ui.find({ type: 'Text', text: 'Qui êtes-vous ?' })).toBeFalsy()
  expect(b.toasts.join(' ')).toMatch(new RegExp(membre))
  await ui.unmount()
})

test('un autre prénom déjà enregistré (hors équipe) : la carte s\'affiche, remplacer demande confirmation', async ($, on) => {
  const b = banc(on, { config: '{"prenom":"Alex"}', reponse: 'Non' })
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const membre = PROJET.equipe[0]!
  await ui.press({ key: `identite-${membre}` })
  expect(b.questions.some(q => /Alex/.test(q))).toBe(true)
  expect(b.ecrits).toEqual([]) // refus : rien n'est écrit
  expect(await ui.find({ type: 'Text', text: 'Qui êtes-vous ?' })).toBeTruthy()
  await ui.unmount()
})

test('« Installer les skills du preset » : visible quand un skill d\'agent manque, envoie la demande à Claude, jamais d\'écriture directe', async ($, on) => {
  const b = banc(on, { config: '{"prenom":"lea"}', skills: ['luau'] })
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.press({ key: 'nav-agents' })
    expect((await ui.find({ key: 'skills-installer' }))?.props.label).toBe('Installer les skills du preset')
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'nav-agents' })
  await ui.press({ key: 'skills-installer' })
  expect(b.soumis.length + b.remplis.length).toBe(1)
  expect([...b.soumis, ...b.remplis][0]).toMatch(/installer-skills\.mjs/)
  expect(b.ecrits).toEqual([])
  await ui.unmount()
})

test('« Installer les skills du preset » : absent quand tout est installé, ou sans prénom connu', async ($, on) => {
  banc(on, { config: '{"prenom":"lea"}', skills: ['luau', 'partage'] })
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'nav-agents' })
  expect(await ui.find({ key: 'skills-installer' })).toBeFalsy()
  await ui.unmount()
})

test('sans prénom connu : pas de bouton d\'installation (lecture seule)', async ($, on) => {
  banc(on, { skills: ['luau'] })
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'nav-agents' })
  expect(await ui.find({ key: 'skills-installer' })).toBeFalsy()
  await ui.unmount()
})

test('Paramètres > Équipe : « Ajouter un membre » inscrit un prénom dans projet.json (3 membres au plus)', async ($, on) => {
  const b = banc(on, { config: '{"prenom":"lea"}' })
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'nav-reglages' })
  await ui.input({ key: 'membre-ajout', text: 'Mika' })
  expect(JSON.parse(b.fichiers[`${D}/projet.json`]!).equipe).toEqual([...PROJET.equipe, 'Mika'])
  expect(await ui.find({ key: 'membre-ajout' })).toBeFalsy() // l'équipe est au complet
  await ui.unmount()
})

test('Paramètres > Équipe : un doublon est refusé et rien n\'est écrit ; sans prénom connu, pas de champ', async ($, on) => {
  const b = banc(on, { config: '{"prenom":"lea"}' })
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'nav-reglages' })
  await ui.input({ key: 'membre-ajout', text: PROJET.equipe[0]!.toLowerCase() })
  expect(b.ecrits).toEqual([])
  await ui.unmount()
})
