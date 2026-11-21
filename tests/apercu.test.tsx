import { expect, test } from 'claude-code/testing'

import { banc, demarrer, TOUTES } from './banc'
import { PANE } from './disque'
import { dossierPages, PROJET_PAGES } from './fixture-pages'

const texte = (ui: any, t: string | RegExp) => ui.find({ type: 'Text', text: t })

test('vue d’ensemble : carte projet, phase, progression et détail, sur chaque surface', async ($, on) => {
  const { ecritures } = banc(on, dossierPages())
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await texte(ui, 'Site web')).toBeTruthy()
    expect(await texte(ui, 'Phase 2 sur 3 : Conception')).toBeTruthy()
    expect(await texte(ui, 'Boutique test')).toBeTruthy()
    expect(await texte(ui, 'Objectif : Vendre des bols')).toBeTruthy()
    expect(await texte(ui, 'Progression du projet')).toBeTruthy()
    expect(await ui.find({ text: /29 %/ })).toBeTruthy()
    expect(await texte(ui, '2 tâches terminées sur 7')).toBeTruthy()
    await ui.unmount()
  }
  expect(ecritures).toEqual([])
})

test('pôles : une carte par pôle, tâches rattachées, agents au singulier et au pluriel', async ($, on) => {
  banc(on, dossierPages())
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await texte(ui, 'Pôles du projet')).toBeTruthy()
    expect(await texte(ui, /Les pôles sont propres à ce projet/)).toBeTruthy()
    expect(await ui.find({ key: 'pole-code' })).toBeTruthy()
    expect(await ui.find({ key: 'pole-art' })).toBeTruthy()
    expect(await texte(ui, 'Technique')).toBeTruthy()
    expect(await texte(ui, 'Création')).toBeTruthy()
    expect(await texte(ui, '1 tâche terminée sur 2')).toBeTruthy()
    expect(await texte(ui, '1 tâche terminée sur 1')).toBeTruthy()
    expect(await texte(ui, '1 agent')).toBeTruthy()
    expect(await texte(ui, '2 agents')).toBeTruthy()
    expect(await texte(ui, 'Alpha')).toBeTruthy()
    await ui.unmount()
  }
})

test('pôle sans tâche rattachée : 0 % et « Aucune tâche rattachée » ; pôle sans couleur : teinte de son rang', async ($, on) => {
  banc(on, dossierPages({ ...PROJET_PAGES, poles: [...PROJET_PAGES.poles, { id: 'qa', titre: 'Qualité' }] }))
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'pole-qa' })).toBeTruthy()
  expect(await texte(ui, 'Aucune tâche rattachée')).toBeTruthy()
  expect(await texte(ui, 'Aucun agent')).toBeTruthy()
  expect(await ui.find({ text: /^0 %$/ })).toBeTruthy()
  await ui.unmount()
})

test('carte Plan : résumé des tâches restantes et bouton « Ouvrir le plan » qui ouvre la page Plan', async ($, on) => {
  banc(on, dossierPages())
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await texte(ui, '4 tâches restent à faire, dont 2 dans la phase en cours')).toBeTruthy()
  expect((await ui.find({ key: 'ouvrir-plan' }))?.props.label).toBe('Ouvrir le plan')
  await ui.press({ key: 'ouvrir-plan' })
  expect(await texte(ui, 'États d’une tâche')).toBeTruthy()
  expect((await ui.find({ key: 'onglet-plan' }))?.props.backgroundColor).toBeTruthy()
  await ui.unmount()
})

test('une seule tâche restante : accord au singulier', async ($, on) => {
  banc(on, dossierPages(PROJET_PAGES, '## Conception (p2)\n- [ ] p2-1 | Seule\n- [x] p2-2 | Fini'))
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await texte(ui, '1 tâche reste à faire, dont 1 dans la phase en cours')).toBeTruthy()
  await ui.unmount()
})

test('chantiers : état vide propre (aucun chantier n’existe encore) et pied de la maquette', async ($, on) => {
  banc(on, dossierPages())
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await texte(ui, 'Chantiers en cours')).toBeTruthy()
    expect(await texte(ui, 'Aucun chantier en cours')).toBeTruthy()
    expect(await texte(ui, /Pour lancer un chantier : tapez \/chantier suivi de son nom dans la conversation\./)).toBeTruthy()
    await ui.unmount()
  }
})

test('plan vide, projet sans pôle, nom très long : rien ne casse', async ($, on) => {
  const long = 'Un nom de projet vraiment très long '.repeat(5).trim()
  banc(on, dossierPages({ ...PROJET_PAGES, nom: long, poles: [], agents: [] }, ''))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /0 %/ })).toBeTruthy()
    expect(await texte(ui, '0 tâche terminée sur 0')).toBeTruthy()
    expect(await texte(ui, 'Aucun pôle défini pour ce projet.')).toBeTruthy()
    expect(await texte(ui, 'Aucune tâche ne reste à faire.')).toBeTruthy()
    // Le nom long se replie : le texte n'a aucune largeur fixe.
    const nom = await ui.findAll({ type: 'Text', text: long })
    expect(nom.length).toBeGreaterThan(0)
    for (const n of nom) expect(n.props.width).toBeUndefined()
    await ui.unmount()
  }
})
