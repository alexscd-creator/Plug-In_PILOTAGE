import { expect, test } from 'claude-code/testing'

import { banc, CONFIG_LEA, demarrer, TOUTES } from './banc'
import { PANE } from './disque'
import { dossierPages, PROJET_PAGES } from './fixture-pages'

const NL = String.fromCharCode(10)
const PLAN = [
  '## Cadrage (p1)', '',
  '- [x] p1-1 | Écrire le but | fichier: docs/a.md | auteur: Léa',
  '- [>] p1-2 | Idée reportée | fichier: docs/a.md',
  '- [-] p1-3 | Idée abandonnée | fichier: docs/b/c.md',
  '- [>] p1-4 | Autre report', '',
  '## Conception (p2)', '',
  '- [x] p2-1 | Maquette', '',
  '## Production (p3)', '',
  '- [ ] p3-1 | Construire',
].join(NL)

type Dossier = Record<string, string>
// p1 validée à deux, p2 forcée par Léa, p3 en cours.
const MIXTE = (d: Dossier): Dossier => ({
  ...d,
  'C:/Projet/.pilotage/equipe/lea/portes.md': ['porte: p1', 'force: p2 | seul', ''].join(NL),
  'C:/Projet/.pilotage/equipe/sam/portes.md': 'porte: p1\n',
})
// Léa a validé p2 : p1 est passée (porte plus loin), p2 attend Sam.
const SAUTEE = (d: Dossier): Dossier => ({
  ...d,
  'C:/Projet/.pilotage/equipe/lea/portes.md': 'porte: p2\n',
  'C:/Projet/.pilotage/equipe/sam/portes.md': '',
})
const base = (plan = PLAN): Dossier => dossierPages(PROJET_PAGES, plan)

const texte = (ui: any, t: string | RegExp) => ui.find({ type: 'Text', text: t })
const dans = async (ui: any, cle: string) => JSON.stringify(await ui.find({ key: cle }))
const monter = async ($: any, surface: string, bodyColumns?: number) => {
  const ui = await $.ui.mount({ ...PANE, surface, ...(bodyColumns ? { props: { ...PANE.props, bodyColumns } } : {}) })
  await ui.press({ key: 'nav-phases' })
  return ui
}

test('phases : frise de 3 étapes, état et porte franchie avec les libellés exacts', async ($, on) => {
  const { ecritures } = banc(on, MIXTE(base()))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    const p1 = await dans(ui, 'etape-cadre-p1')
    expect(p1).toContain('Cadrage')
    expect(p1).toContain('Terminée')
    expect(p1).toContain('Validée à deux')
    const p2 = await dans(ui, 'etape-cadre-p2')
    expect(p2).toContain('Terminée')
    expect(p2).toContain('Forcée')
    expect(p2).not.toContain('Validée à deux')
    const p3 = await dans(ui, 'etape-cadre-p3')
    expect(p3).toContain('En cours')
    expect(p3).not.toContain('Terminée')
    await ui.unmount()
  }
  expect(ecritures).toEqual([])
})

test('phases : une phase sautée se dit « Passée (porte plus loin) », jamais « Validée à deux »', async ($, on) => {
  banc(on, SAUTEE(base()))
  await demarrer($)
  const ui = await monter($, 'desktop')
  const p1 = await dans(ui, 'etape-cadre-p1')
  expect(p1).toContain('Terminée')
  expect(p1).toContain('Passée (porte plus loin)')
  expect(p1).not.toContain('Validée à deux')
  expect(await dans(ui, 'etape-cadre-p3')).toContain('À venir')
  await ui.press({ key: 'etape-p1' })
  expect(await texte(ui, 'Porte : passée (porte plus loin)')).toBeTruthy()
  expect(await dans(ui, 'detail-phase')).not.toContain('Validée à deux')
  await ui.unmount()
})

test('phases : par défaut le détail est la phase en cours', async ($, on) => {
  banc(on, MIXTE(base()))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    const d = await dans(ui, 'detail-phase')
    expect(d).toContain('Production')
    expect(d).toContain('Construire')
    expect(d).not.toContain('Écrire le but')
    expect(await texte(ui, 'Phase terminée sélectionnée')).toBeFalsy()
    await ui.unmount()
  }
})

test('phases : appuyer sur une étape change le détail', async ($, on) => {
  banc(on, MIXTE(base()))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    await ui.press({ key: 'etape-p1' })
    const d1 = await dans(ui, 'detail-phase')
    expect(d1).toContain('Cadrage')
    expect(d1).toContain('Écrire le but')
    expect(d1).not.toContain('Construire')
    expect(await texte(ui, 'Phase terminée sélectionnée')).toBeTruthy()
    await ui.press({ key: 'etape-p3' })
    expect(await dans(ui, 'detail-phase')).toContain('Construire')
    await ui.unmount()
  }
})

test('phases : les tâches fermées sont listées avec la ligne de tâche du Plan (statut, responsable, copier)', async ($, on) => {
  banc(on, MIXTE(base()))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    await ui.press({ key: 'etape-p1' })
    expect(await dans(ui, 'tache-p1-1')).toContain('Terminé')
    expect(await dans(ui, 'tache-p1-1')).toContain('Léa')
    expect(await dans(ui, 'tache-p1-2')).toContain('Reporté')
    expect(await dans(ui, 'tache-p1-3')).toContain('Abandonné')
    expect(await ui.find({ key: 'copier-p1-3' })).toBeTruthy()
    expect(await ui.find({ key: 'copier-p1-4' })).toBeFalsy()
    expect(await ui.find({ key: 'tache-p3-1' })).toBeFalsy()
    await ui.unmount()
  }
})

test('phases : « Fichiers de la phase » = chemins distincts, chacun avec son bouton qui copie', async ($, on) => {
  banc(on, MIXTE(base()))
  const copies: { text: string; surface?: string }[] = []
  on('ui.copy', (_: unknown, e: { text: string; surface?: string }) => { copies.push({ text: e.text, surface: e.surface }); return { value: { isCopied: true } } })
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    await ui.press({ key: 'etape-p1' })
    expect(await texte(ui, 'Fichiers de la phase')).toBeTruthy()
    const boutons = (await ui.findAll({ type: 'Button' })).filter(b => String(b.key).startsWith('copier-fichier-'))
    expect(boutons.length).toBe(2)
    await ui.press({ key: 'copier-fichier-docs/b/c.md' })
    expect(copies.at(-1)).toEqual({ text: 'docs/b/c.md', surface })
    await ui.press({ key: 'copier-fichier-docs/a.md' })
    expect(copies.at(-1)).toEqual({ text: 'docs/a.md', surface })
    await ui.unmount()
  }
})

test('phases : phase sans fichier, une phrase neutre et aucun bouton de fichier', async ($, on) => {
  banc(on, MIXTE(base()))
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, 'Aucun fichier lié aux tâches de cette phase.')).toBeTruthy()
  expect((await ui.findAll({ type: 'Button' })).filter(b => String(b.key).startsWith('copier-fichier-')).length).toBe(0)
  await ui.unmount()
})

test('phases : phase terminée avec des tâches laissées ouvertes : « N tâches reportées, M abandonnée(s) »', async ($, on) => {
  banc(on, MIXTE(base()))
  await demarrer($)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'etape-p1' })
  expect(await texte(ui, '2 tâches reportées, 1 abandonnée')).toBeTruthy()
  await ui.press({ key: 'etape-p2' })
  expect(await texte(ui, /reportée|abandonnée/)).toBeFalsy()
  await ui.unmount()
})

test('phases : ligne « Porte : … » selon l’état (à deux, forcée, à valider, en attente)', async ($, on) => {
  banc(on, MIXTE(base()))
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, 'Porte : à valider')).toBeTruthy()
  await ui.press({ key: 'etape-p1' })
  expect(await texte(ui, 'Porte : validée à deux')).toBeTruthy()
  await ui.press({ key: 'etape-p2' })
  expect(await texte(ui, 'Porte : forcée')).toBeTruthy()
  await ui.unmount()
})

test('phases : en attente de l’associé', async ($, on) => {
  banc(on, { ...base(), 'C:/Projet/.pilotage/equipe/lea/portes.md': 'porte: p1\n', 'C:/Projet/.pilotage/equipe/sam/portes.md': '' })
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, 'Porte : en attente de l’associé')).toBeTruthy()
  await ui.unmount()
})

test('phases : l’aide de la frise ne s’affiche que sur mobile', async ($, on) => {
  banc(on, MIXTE(base()))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    const aide = await texte(ui, 'Faites glisser la frise pour voir toutes les phases.')
    if (surface === 'mobile') expect(aide).toBeTruthy()
    else expect(aide).toBeFalsy()
    await ui.unmount()
  }
})

test('phases : la frise défile à l’horizontale sur mobile seulement', async ($, on) => {
  banc(on, MIXTE(base()))
  await demarrer($)
  const m = await monter($, 'mobile')
  expect((await m.find({ key: 'frise' }))?.props.overflowX).toBe('scroll')
  await m.unmount()
  const b = await monter($, 'desktop')
  expect((await b.find({ key: 'frise' }))?.props.overflowX).toBeUndefined()
  await b.unmount()
})

test('phases : membre inconnu, la porte le dit au lieu d’inventer un état', async ($, on) => {
  const { [CONFIG_LEA]: _config, ...sansConfig } = MIXTE(base())
  banc(on, sansConfig)
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, 'Porte : état inconnu — indiquez votre prénom')).toBeTruthy()
  expect(await ui.find({ key: 'detail-phase' })).toBeTruthy()
  await ui.unmount()
})

test('phases : 0 phase, carte neutre', async ($, on) => {
  banc(on, dossierPages({ ...PROJET_PAGES, phases: [] }, ''))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await texte(ui, 'Aucune phase dans ce projet')).toBeTruthy()
    expect(await ui.find({ key: 'frise' })).toBeFalsy()
    await ui.unmount()
  }
})

test('phases : 1 seule phase', async ($, on) => {
  const seule = dossierPages({ ...PROJET_PAGES, phases: [{ id: 'p1', titre: 'Unique', taches: [] }] }, '## Unique (p1)\n- [ ] p1-1 | Seule')
  banc(on, { ...seule, 'C:/Projet/.pilotage/equipe/lea/portes.md': '', 'C:/Projet/.pilotage/equipe/sam/portes.md': '' })
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await dans(ui, 'etape-cadre-p1')).toContain('En cours')
  expect(await dans(ui, 'detail-phase')).toContain('Seule')
  await ui.unmount()
})

test('phases : titre de phase très long, sans largeur fixe', async ($, on) => {
  const long = 'Une phase au titre extrêmement long '.repeat(5).trim()
  banc(on, dossierPages({ ...PROJET_PAGES, phases: [{ id: 'p1', titre: long, taches: [] }, { id: 'p2', titre: 'Suite', taches: [] }] }, ''))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    const t = (await ui.findAll({ type: 'Text', text: long }))[0]
    expect(t).toBeTruthy()
    expect(t?.props.width).toBeUndefined()
    expect(t?.props.wrap).not.toBe('clip')
    await ui.unmount()
  }
})

test('phases : équipe d’un seul membre, la porte validée se dit « Validée », jamais « à deux »', async ($, on) => {
  const solo = dossierPages({ ...PROJET_PAGES, equipe: ['Léa'] }, PLAN)
  banc(on, { ...solo, 'C:/Projet/.pilotage/equipe/lea/portes.md': 'porte: p1' + NL })
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    const p1 = await dans(ui, 'etape-cadre-p1')
    expect(p1).toContain('Terminée')
    expect(p1).toContain('Validée')
    expect(p1).not.toContain('à deux')
    await ui.press({ key: 'etape-p1' })
    expect(await texte(ui, 'Porte : validée')).toBeTruthy()
    expect(await texte(ui, /à deux/)).toBeFalsy()
    await ui.unmount()
  }
})

test('phases : un prénom de config qui n’est pas dans l’équipe = porte inconnue, aucune phase dite franchie', async ($, on) => {
  const d = MIXTE(base())
  banc(on, { ...d, [CONFIG_LEA]: '{"prenom":"zoe"}' })
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, 'Porte : état inconnu — indiquez votre prénom')).toBeTruthy()
  expect(await dans(ui, 'frise')).not.toContain('Validée')
  expect(await dans(ui, 'frise')).not.toContain('Forcée')
  await ui.unmount()
})
