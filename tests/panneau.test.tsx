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
    expect(await ui.find({ type: 'Text', text: 'À venir' })).toBeTruthy()
    await ui.unmount()
  }
  expect(ecritures).toEqual([])
})

test('un onglet change de page ; chaque page encore vide montre « À venir »', async ($, on) => {
  const { ecritures } = banc(on, fichiers())
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  for (const p of PAGES.filter(x => x.page !== 'parametres')) {
    await ui.press({ key: `nav-${p.page}` })
    expect(await ui.find({ type: 'Text', text: 'À venir' })).toBeTruthy()
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
