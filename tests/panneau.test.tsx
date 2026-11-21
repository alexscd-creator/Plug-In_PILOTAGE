import { expect, test } from 'claude-code/testing'

import { PAGES } from '../hooks/ui/nav'
import { banc, CONFIG_LEA, demarrer, PLAN, PROJET, TOUTES } from './banc'
import { PANE } from './disque'

const fichiers = (nom = 'Mon projet') => ({
  'C:/Projet/.pilotage/projet.json': JSON.stringify({ ...PROJET, nom }),
  'C:/Projet/.pilotage/plan.md': PLAN,
  'C:/Projet/.pilotage/equipe/lea/portes.md': 'porte: p1\n',
  [CONFIG_LEA]: '{"prenom":"lea"}',
})

test('projet ouvert : barre du haut, navigation dans l’ordre, page d’aperçu active, rien d’écrit sur le disque', async ($, on) => {
  const { ecritures } = banc(on, fichiers())
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'Pilotage · Site web' })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: 'Mon projet' })).toBeTruthy()
    const onglets = (await ui.findAll({ type: 'Button' })).filter(b => PAGES.some(p => b.key === 'nav-' + p.page)).map(b => b.props.label)
    expect(onglets).toEqual(PAGES.map(p => p.titre))
    expect((await ui.find({ key: 'onglet-apercu' }))?.props.backgroundColor).toBeTruthy()
    expect(await ui.find({ key: 'carte-projet' })).toBeTruthy()
    await ui.unmount()
  }
  expect(ecritures).toEqual([])
})

test('un onglet change de page ; plus aucune page ne montre « Bientôt »', async ($, on) => {
  const { ecritures } = banc(on, fichiers())
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  for (const p of PAGES.filter(x => x.page !== 'parametres')) {
    await ui.press({ key: `nav-${p.page}` })
    const faite = p.page === 'apercu' || p.page === 'plan' || p.page === 'phases' || p.page === 'chantiers' || p.page === 'agents'
    expect(!!(await ui.find({ type: 'Text', text: 'Bientôt' }))).toBe(false)
    expect((await ui.find({ key: `onglet-${p.page}` }))?.props.backgroundColor).toBeTruthy()
  }
  await ui.press({ key: 'nav-reglages' })
  expect((await ui.find({ key: 'onglet-parametres' }))?.props.backgroundColor).toBeTruthy()
  expect((await ui.find({ key: 'onglet-agents' }))?.props.backgroundColor).toBeUndefined()
  expect(ecritures).toEqual([])
  await ui.unmount()
})

test('rafraîchir relit les fichiers', async ($, on) => {
  const f: Record<string, string> = fichiers()
  banc(on, f)
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Mon projet' })).toBeTruthy()
  Object.assign(f, fichiers('Autre nom'))
  await ui.press({ key: 'nav-rafraichir' })
  expect(await ui.find({ type: 'Text', text: 'Autre nom' })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: 'Mon projet' })).toBeFalsy()
  await ui.unmount()
})

test('colonne centrée sur le panneau, plus étroite sur mobile', async ($, on) => {
  banc(on, fichiers())
  await demarrer($)
  const large = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, bodyColumns: 200 } })
  expect((await large.find({ key: 'cadre-colonne' }))?.props.width).toBe(110)
  await large.unmount()
  const mobile = await $.ui.mount({ ...PANE, surface: 'mobile', props: { ...PANE.props, bodyColumns: 48 } })
  expect((await mobile.find({ key: 'cadre-colonne' }))?.props.width).toBe(44)
  await mobile.unmount()
})

/** Panneau vide (sans projet) avec le thème de l'atome (`choix`) et la ligne `theme` du menu de configuration. */
async function fondDuPanneau($: any, on: Function, choix: string | undefined, config: 'panne' | 'absente' | unknown) {
  banc(on, {})
  on('config.list', () => {
    if (config === 'panne') throw new Error('menu indisponible')
    return { value: config === 'absente' ? [{ key: 'verbose', value: true }] : [{ key: 'theme', value: config }] }
  })
  on('state.get', (_: unknown, e: { key: string }) => ({
    value: e.key === 'theme' && choix ? { value: { shape: 'theme-1', value: choix }, version: 1 } : { value: undefined, version: 0 },
  }))
  on('state.set', () => ({ value: { isSet: true, version: 2 } }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const fond = (await ui.find({ key: 'cadre' }))?.props.backgroundColor
  await ui.unmount()
  return fond
}

test('thème « sombre » ou « clair » : forcé, quoi que dise l’application', async ($, on) => {
  expect(await fondDuPanneau($, on, 'sombre', 'light')).toBe('#0d0e12')
})
test('thème « clair » forcé', async ($, on) => {
  expect(await fondDuPanneau($, on, 'clair', 'dark')).toBe('#f6f7fa')
})
test('thème « systeme » : suit le thème clair de l’application', async ($, on) => {
  expect(await fondDuPanneau($, on, 'systeme', 'light')).toBe('#f6f7fa')
})
test('thème « systeme » par défaut (rien d’écrit) : suit le thème sombre de l’application', async ($, on) => {
  expect(await fondDuPanneau($, on, undefined, 'dark')).toBe('#0d0e12')
})
test('thème « systeme » : menu en panne → sombre, sans lever', async ($, on) => {
  expect(await fondDuPanneau($, on, 'systeme', 'panne')).toBe('#0d0e12')
})
test('thème « systeme » : ligne theme absente du menu → sombre', async ($, on) => {
  expect(await fondDuPanneau($, on, 'systeme', 'absente')).toBe('#0d0e12')
})
test('thème « systeme » : valeur « auto » → sombre', async ($, on) => {
  expect(await fondDuPanneau($, on, 'systeme', 'auto')).toBe('#0d0e12')
})

test('les fichiers ne sont relus qu’au rafraîchissement : redessiner ou changer de page ne touche pas le disque', async ($, on) => {
  const { lus } = banc(on, fichiers())
  await demarrer($)
  const plan = () => lus.filter(p => p.endsWith('/plan.md')).length
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(plan()).toBe(1)
  await ui.redraw()
  await ui.press({ key: 'nav-plan' })
  await ui.press({ key: 'nav-agents' })
  expect(plan()).toBe(1)
  await ui.press({ key: 'nav-rafraichir' })
  expect(plan()).toBe(2)
  await ui.unmount()
})

test('rafraîchissement automatique toutes les 5 secondes tant qu’un projet est ouvert', async ($, on) => {
  const f: Record<string, string> = fichiers()
  banc(on, f)
  const periodes: number[] = []
  const portes: (() => void)[] = []
  on('clock.every', (_: unknown, e: { ms: number }) => {
    periodes.push(e.ms)
    return new Promise(r => { portes.push(() => r({ value: undefined })) })
  })
  await demarrer($)
  expect(periodes).toEqual([5000])
  await demarrer($)
  expect(periodes).toEqual([5000])
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'Mon projet' })).toBeTruthy()
  Object.assign(f, fichiers('Nom changé'))
  portes[0]!()
  expect(await ui.find({ type: 'Text', text: 'Nom changé' })).toBeTruthy()
  await ui.unmount()
})

test('pas de minuterie sans projet', async ($, on) => {
  banc(on, {})
  const periodes: number[] = []
  on('clock.every', (_: unknown, e: { ms: number }) => { periodes.push(e.ms); return new Promise(() => undefined) })
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(periodes).toEqual([])
  await ui.unmount()
})

test('un état qui refuse l’écriture : les boutons ne lèvent pas et le disent', async ($, on) => {
  banc(on, fichiers())
  const toasts: string[] = []
  on('ui.toast', (_: unknown, e: { text: string }) => { toasts.push(e.text); return { value: undefined } })
  const ouvert = { actif: true, projetTrouve: 'C:/Projet', membre: 'Léa' } as Record<string, unknown>
  const formes: Record<string, string> = { actif: 'actif-1', projetTrouve: 'projet-1', membre: 'membre-1' }
  on('state.get', (_: unknown, e: { key: string }) => ({
    value: e.key in ouvert ? { value: { shape: formes[e.key], value: ouvert[e.key] }, version: 1 } : { value: undefined, version: 0 },
  }))
  on('state.set', () => ({ value: { isSet: false, version: 9 } }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'navigation' })).toBeTruthy()
  for (const key of ['nav-plan', 'nav-rafraichir', 'nav-reglages']) {
    await ui.press({ key })
  }
  expect(toasts.length).toBe(3)
  expect(toasts[0]).toMatch(/pas pu/)
  await ui.unmount()
})

/** Horloge simulée : chaque `clock.every` est un minuteur, tenu par une porte que le test ouvre à la main. */
function horloge(on: Function) {
  const periodes: number[] = []
  const portes: (() => void)[] = []
  on('clock.every', (_: unknown, e: { ms: number }) => {
    periodes.push(e.ms)
    return new Promise(r => { portes.push(() => r({ value: undefined })) })
  })
  return { periodes, portes }
}

test('projet qui devient invalide puis valide : le minuteur est relancé une fois, pas cumulé', async ($, on) => {
  const f: Record<string, string> = fichiers()
  banc(on, f)
  const { periodes } = horloge(on)
  await demarrer($)
  expect(periodes.length).toBe(1)
  const valide = f['C:/Projet/.pilotage/projet.json']!
  f['C:/Projet/.pilotage/projet.json'] = '{"version":2}'
  await $.command.run({ command: 'pilotage' })
  f['C:/Projet/.pilotage/projet.json'] = valide
  await $.command.run({ command: 'pilotage' })
  expect(periodes.length).toBe(2)
  await $.command.run({ command: 'pilotage' })
  expect(periodes.length).toBe(2)
})
