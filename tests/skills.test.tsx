import { expect, test } from 'claude-code/testing'

import { CONFIG_LEA, TOUTES } from './banc'
import { disque, PANE, sl } from './disque'
import { PLAN_PAGES, PROJET_PAGES } from './fixture-pages'

const D = 'C:/Projet/.pilotage'
const PROJET_JSON = `${D}/projet.json`
const PROJET = {
  ...PROJET_PAGES,
  poles: [{ id: 'code', titre: 'Technique', couleur: 'bleu' }],
  agents: [
    { id: 'a1', titre: 'Alpha', pole: 'code', skills: ['luau', 'partage'], pourquoi: 'Écrit le code.' },
    { id: 'a2', titre: 'Beta', pole: 'code', skills: ['partage'], pourquoi: '' },
  ],
}
const SKILLS = (...ids: string[]) => Object.fromEntries(ids.map(i => [`${D}/skills/${i}.md`, `# ${i}`]))

type Opts = { sansMembre?: boolean; reponse?: (question: string, options: string[]) => string; remplir?: boolean }
function banc(on: Function, skills: string[], o: Opts = {}) {
  const fichiers: Record<string, string> = {
    [PROJET_JSON]: JSON.stringify(PROJET),
    [`${D}/plan.md`]: PLAN_PAGES,
    [`${D}/equipe/lea/portes.md`]: 'porte: p1\n',
    ...SKILLS(...skills),
    ...(o.sansMembre ? {} : { [CONFIG_LEA]: '{"prenom":"lea"}' }),
  }
  disque(on, fichiers)
  const ecrits: string[] = []
  const toasts: string[] = []
  const questions: { question: string; options: string[] }[] = []
  const remplis: string[] = []
  const soumis: string[] = []
  const copies: string[] = []
  on('fs.write', (_: unknown, e: { path: string; text: string }) => { ecrits.push(sl(e.path)); fichiers[sl(e.path)] = e.text; return { value: undefined } })
  on('fs.exists', (_: unknown, e: { path: string }) => ({ value: sl(e.path) in fichiers }))
  on('command.register', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/Projet' }))
  on('prompt.compose', () => ({ sections: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => new Promise(() => undefined))
  on('ui.toast', (_: unknown, e: { text: string }) => { toasts.push(e.text); return { value: undefined } })
  on('prompt.fill', (_: unknown, e: { text: string }) => { remplis.push(e.text); return { isFilled: o.remplir !== false } })
  on('prompt.submit', (_: unknown, e: { text: string }) => { soumis.push(e.text); return { text: e.text, context: [] } })
  on('ui.copy', (_: unknown, e: { text: string }) => { copies.push(e.text); return { value: { isCopied: true } } })
  on('tool.call', (_: unknown, e: { tool: string; questions?: { question: string; options?: ({ label: string } | string)[] }[] }) => {
    const q = e.questions?.[0]
    const options = (q?.options ?? []).map(x => (typeof x === 'string' ? x : x.label))
    questions.push({ question: q?.question ?? '', options })
    const rep = o.reponse?.(q?.question ?? '', options) ?? ''
    return { result: { questions: e.questions ?? [], answers: { [q?.question ?? '']: rep } } }
  })
  return { fichiers, ecrits, toasts, questions, remplis, soumis, copies, projet: () => JSON.parse(fichiers[PROJET_JSON]!) }
}
const demarrer = ($: any) => $.session.start({ cwd: 'C:/Projet', surface: 'terminal', isInteractive: true })
const detail = async ($: any, surface: string, agent = 'a1') => {
  const ui = await $.ui.mount({ ...PANE, surface })
  await ui.press({ key: 'nav-agents' })
  // Le détail reste ouvert d'un montage à l'autre (état du panneau) : l'appui ne sert qu'au premier.
  try { await ui.press({ key: `ouvrir-${agent}` }) } catch { /* déjà ouvert */ }
  return ui
}
const dans = async (ui: any, cle: string) => JSON.stringify(await ui.find({ key: cle }))
const trouve = async (ui: any, cle: string) => (await ui.find({ key: cle })) !== null && (await ui.find({ key: cle })) !== undefined
const tout = async (ui: any) => JSON.stringify(await ui.find({ key: 'skills-agent-a1' }))

test('boutons selon l’état, sur chaque surface : ajouter, retirer, modifier, copier ; supprimer seulement pour un skill sans agent', async ($, on) => {
  const b = banc(on, ['luau', 'partage', 'libre'])
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await detail($, surface)
    const t = await tout(ui)
    expect(t).toContain('Ajouter un skill')
    expect(t).toContain('Retirer de cet agent')
    expect(t).toContain('Demander à Claude de le modifier')
    expect(t).toContain('Copier le chemin')
    expect(t).toContain('Supprimer le skill')
    expect(await trouve(ui, 'skill-supprimer-libre')).toBe(true)
    expect(await trouve(ui, 'skill-supprimer-luau')).toBe(false) // rattaché à un agent
    expect(await trouve(ui, 'skill-supprimer-partage')).toBe(false) // utilisé par deux agents
    expect(t).toContain('Aussi utilisé par : Beta')
    await ui.unmount()
  }
  expect(b.ecrits).toEqual([])
})

test('un skill non installé n’a ni « Copier le chemin » ni « Demander à Claude de le modifier », mais peut être retiré', async ($, on) => {
  banc(on, ['partage'])
  await demarrer($)
  const ui = await detail($, 'desktop')
  expect(await trouve(ui, 'skill-modifier-a1-0')).toBe(false) // luau : pas de fichier
  expect(await trouve(ui, 'skill-retirer-a1-0')).toBe(true)
  expect(await tout(ui)).toContain('skill non installé')
  await ui.unmount()
})

test('lecture seule sans prénom connu : le message, aucun bouton de gestion, rien d’écrit', async ($, on) => {
  const b = banc(on, ['luau', 'partage', 'libre'], { sansMembre: true })
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await detail($, surface)
    const t = await tout(ui)
    expect(t).toContain('Indiquez votre prénom pour modifier les skills')
    for (const m of ['Ajouter un skill', 'Retirer de cet agent', 'Demander à Claude de le modifier', 'Supprimer le skill']) expect(t).not.toContain(m)
    expect(t).toContain('Copier le chemin') // la lecture reste possible
    await ui.unmount()
  }
  expect(b.ecrits).toEqual([])
})

test('Retirer de cet agent : seul cet agent perd le skill, par l’écriture gardée (.bak), le fichier du skill reste', async ($, on) => {
  const b = banc(on, ['luau', 'partage'])
  await demarrer($)
  const ui = await detail($, 'desktop')
  await ui.press({ key: 'skill-retirer-a1-1' }) // partage
  expect(b.projet().agents[0].skills).toEqual(['luau'])
  expect(b.projet().agents[1].skills).toEqual(['partage'])
  expect(b.ecrits).toContain(`${D}/projet.json.bak`)
  expect(b.ecrits.some(p => p.includes('/skills/'))).toBe(false)
  expect(b.fichiers[`${D}/skills/partage.md`]).toBe('# partage')
  await ui.unmount()
})

test('Ajouter un skill : choix parmi les skills non rattachés ($.ui.ask), 2 à 4 options, rattaché à cet agent seulement', async ($, on) => {
  const b = banc(on, ['luau', 'partage', 'libre', 'zeta'], { reponse: (_q, o) => (o.includes('libre') ? 'libre' : '') })
  await demarrer($)
  const ui = await detail($, 'desktop')
  await ui.press({ key: 'skill-ajouter-a1' })
  expect(b.questions).toHaveLength(1)
  expect(b.questions[0]!.question).toContain('Alpha')
  expect(b.questions[0]!.options).toEqual(['libre', 'zeta', 'Nouveau skill'])
  expect(b.projet().agents[0].skills).toEqual(['luau', 'partage', 'libre'])
  expect(b.projet().agents[1].skills).toEqual(['partage'])
  await ui.unmount()
})

test('Ajouter un skill : plus de trois candidats : trois puis « Autre » mène à la suite', async ($, on) => {
  const b = banc(on, ['luau', 'partage', 'c1', 'c2', 'c3', 'c4', 'c5'], { reponse: (_q, o) => (o.includes('Autre') ? 'Autre' : 'c5') })
  await demarrer($)
  const ui = await detail($, 'desktop')
  await ui.press({ key: 'skill-ajouter-a1' })
  expect(b.questions.map(q => q.options)).toEqual([['c1', 'c2', 'c3', 'Autre'], ['c4', 'c5', 'Nouveau skill']])
  expect(b.projet().agents[0].skills).toEqual(['luau', 'partage', 'c5'])
  await ui.unmount()
})

test('Ajouter un skill : annuler ne change rien ; sans candidat : « Nouveau skill » et « Annuler »', async ($, on) => {
  const b = banc(on, ['luau', 'partage'], { reponse: () => 'Annuler' })
  await demarrer($)
  const ui = await detail($, 'desktop')
  await ui.press({ key: 'skill-ajouter-a1' })
  expect(b.questions[0]!.options).toEqual(['Nouveau skill', 'Annuler'])
  expect(b.ecrits).toEqual([])
  expect(b.remplis).toEqual([])
  await ui.unmount()
})

test('Nouveau skill : une demande prête à compléter est préparée dans la zone de saisie (jamais envoyée toute seule), rien n’est écrit', async ($, on) => {
  const b = banc(on, ['luau', 'partage'], { reponse: () => 'Nouveau skill' })
  await demarrer($)
  const ui = await detail($, 'desktop')
  await ui.press({ key: 'skill-ajouter-a1' })
  expect(b.remplis).toHaveLength(1)
  expect(b.remplis[0]).toMatch(/^Crée un nouveau skill pour l'agent Alpha du projet avec le script pilotage-skill\.mjs/)
  expect(b.remplis[0]).toContain('<décrivez le skill voulu>')
  expect(b.soumis).toEqual([])
  expect(b.ecrits).toEqual([])
  await ui.unmount()
})

test('Demander à Claude de le modifier : demande prête avec l’identifiant du skill, préremplie ; sinon copiée', async ($, on) => {
  const b = banc(on, ['luau', 'partage'])
  await demarrer($)
  const ui = await detail($, 'desktop')
  await ui.press({ key: 'skill-modifier-a1-0' })
  expect(b.remplis).toEqual(['Modifie le skill luau du projet avec le script pilotage-skill.mjs : <décrivez le changement>'])
  expect(b.soumis).toEqual([])
  expect(b.toasts.join(' ')).toContain('zone de saisie')
  await ui.unmount()
})

test('Demander à Claude de le modifier : zone de saisie refusée : la demande est copiée', async ($, on) => {
  const b = banc(on, ['luau', 'partage'], { remplir: false })
  await demarrer($)
  const ui = await detail($, 'desktop')
  await ui.press({ key: 'skill-modifier-a1-0' })
  expect(b.copies).toEqual(['Modifie le skill luau du projet avec le script pilotage-skill.mjs : <décrivez le changement>'])
  await ui.unmount()
})

test('Copier le chemin copie le chemin du skill', async ($, on) => {
  const b = banc(on, ['luau', 'partage'])
  await demarrer($)
  const ui = await detail($, 'desktop')
  await ui.press({ key: 'copier-skill-a1-0' })
  expect(b.copies).toEqual(['.pilotage/skills/luau.md'])
  await ui.unmount()
})

test('Supprimer le skill : confirmation d’abord ; « Garder » ne fait rien', async ($, on) => {
  const b = banc(on, ['luau', 'partage', 'libre'], { reponse: () => 'Garder' })
  await demarrer($)
  const ui = await detail($, 'desktop')
  await ui.press({ key: 'skill-supprimer-libre' })
  expect(b.questions).toHaveLength(1)
  expect(b.questions[0]!.question).toContain('libre')
  expect(b.questions[0]!.options).toEqual(['Supprimer', 'Garder'])
  expect(b.soumis).toEqual([])
  expect(b.ecrits).toEqual([])
  expect(b.fichiers[`${D}/skills/libre.md`]).toBe('# libre')
  await ui.unmount()
})

test('Supprimer le skill : confirmé, la suppression est demandée à Claude (script), le panneau n’écrit ni ne supprime lui-même', async ($, on) => {
  const b = banc(on, ['luau', 'partage', 'libre'], { reponse: () => 'Supprimer' })
  await demarrer($)
  const ui = await detail($, 'desktop')
  await ui.press({ key: 'skill-supprimer-libre' })
  expect(b.soumis).toHaveLength(1)
  expect(b.soumis[0]).toContain('Supprime le skill libre')
  expect(b.soumis[0]).toContain('pilotage-skill.mjs')
  expect(b.soumis[0]).toContain('supprimer')
  expect(b.ecrits).toEqual([])
  expect(b.fichiers[`${D}/skills/libre.md`]).toBe('# libre')
  await ui.unmount()
})
