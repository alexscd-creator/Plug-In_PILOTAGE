import { expect, test } from 'claude-code/testing'

import { banc, demarrer, TOUTES } from './banc'
import { PANE } from './disque'
import { dossierPages, PROJET_PAGES } from './fixture-pages'

const texte = (ui: any, t: string | RegExp) => ui.find({ type: 'Text', text: t })
const monter = async ($: any, surface: string) => {
  const ui = await $.ui.mount({ ...PANE, surface })
  await ui.press({ key: 'nav-plan' })
  return ui
}

test('plan : intro, légende des 5 états (icône et libellé), une carte par phase', async ($, on) => {
  const { ecritures } = banc(on, dossierPages())
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await texte(ui, /Le cahier des charges est le plan de travail : chaque point à faire est une tâche\./)).toBeTruthy()
    expect(await texte(ui, 'Plan')).toBeTruthy()
    expect(await texte(ui, /Cliquez une ligne/)).toBeFalsy()
    expect(await texte(ui, 'États d’une tâche')).toBeTruthy()
    const dedans = JSON.stringify(await ui.find({ key: 'carte-legende' }))
    for (const l of ['À faire', 'En cours', 'Terminé', 'Reporté', 'Abandonné']) expect(dedans).toContain(l)
    if (surface === 'terminal') for (const g of ['○', '◐', '✓', '◷', '⊗']) expect(dedans).toContain(g)
    else expect((await ui.findAll({ type: 'Svg' })).length).toBeGreaterThan(5)
    expect(await texte(ui, 'Phase 1 · Cadrage')).toBeTruthy()
    expect(await texte(ui, 'Phase 2 · Conception')).toBeTruthy()
    expect(await texte(ui, 'Phase 3 · Production')).toBeTruthy()
    expect(await texte(ui, 'Sans phase')).toBeTruthy()
    await ui.unmount()
  }
  expect(ecritures).toEqual([])
})

test('plan : état de chaque phase (terminée, en cours, à venir), sans dates', async ($, on) => {
  banc(on, dossierPages())
  await demarrer($)
  const ui = await monter($, 'desktop')
  for (const [cle, etat] of [['phase-p1', 'Terminée'], ['phase-p2', 'En cours'], ['phase-p3', 'À venir']] as const) {
    expect(JSON.stringify(await ui.find({ key: cle }))).toContain(etat)
  }
  expect(await texte(ui, /\bdu \d|\bau \d/)).toBeFalsy()
  await ui.unmount()
})

test('plan : lignes de tâche (statut, titre, chemin, responsable), titre barré pour l’abandonnée', async ($, on) => {
  banc(on, dossierPages())
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    const l = JSON.stringify(await ui.find({ key: 'tache-p2-1' }))
    expect(l).toContain('Maquette')
    expect(l).toContain('docs/maquette.md')
    expect(l).toContain('Léa')
    expect(l).toContain('Terminé')
    expect(JSON.stringify(await ui.find({ key: 'tache-p2-2' }))).toContain('En cours')
    expect(JSON.stringify(await ui.find({ key: 'tache-p2-3' }))).toContain('À faire')
    expect(JSON.stringify(await ui.find({ key: 'tache-p2-4' }))).toContain('Reporté')
    expect(JSON.stringify(await ui.find({ key: 'tache-p1-2' }))).toContain('Abandonné')
    expect((await texte(ui, 'Idée abandonnée'))?.props.strikethrough).toBe(true)
    expect((await texte(ui, 'Maquette'))?.props.strikethrough).toBeFalsy()
    expect(await ui.find({ key: 'tache-x-1' })).toBeTruthy()
    await ui.unmount()
  }
})

test('plan : « Copier le chemin » seulement avec un fichier, et il copie ce chemin', async ($, on) => {
  banc(on, dossierPages())
  const copies: { text: string; surface?: string }[] = []
  on('ui.copy', (_: unknown, e: { text: string; surface?: string }) => { copies.push({ text: e.text, surface: e.surface }); return { value: { isCopied: true } } })
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await ui.find({ key: 'copier-p2-1' })).toBeTruthy()
    expect(await ui.find({ key: 'copier-p2-2' })).toBeFalsy()
    expect((await ui.findAll({ type: 'Button' })).filter(b => String(b.key).startsWith('copier-')).length).toBe(1)
    await ui.press({ key: 'copier-p2-1' })
    expect(copies.at(-1)).toEqual({ text: 'docs/maquette.md', surface })
    await ui.unmount()
  }
})

test('plan : le bandeau de porte n’apparaît que si la phase en cours a des tâches ouvertes', async ($, on) => {
  banc(on, dossierPages())
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, 'Tâches ouvertes : impossible de valider la porte')).toBeTruthy()
  expect(await texte(ui, /Phase 2 « Conception » : 2 tâches ne sont ni terminées, ni reportées, ni abandonnées/)).toBeTruthy()
  expect(await texte(ui, /Porte verrouillée : 2 tâches ouvertes/)).toBeTruthy()
  await ui.unmount()
})

test('plan : pas de bandeau quand la phase en cours est réglée (tâches ouvertes ailleurs seulement)', async ($, on) => {
  const plan = '## Conception (p2)\n- [x] p2-1 | A\n- [>] p2-2 | B\n- [-] p2-3 | C\n## Production (p3)\n- [ ] p3-1 | D'
  banc(on, dossierPages(PROJET_PAGES, plan))
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, 'Tâches ouvertes : impossible de valider la porte')).toBeFalsy()
  expect(await texte(ui, /Porte verrouillée/)).toBeFalsy()
  await ui.unmount()
})

test('plan : une tâche ouverte au singulier', async ($, on) => {
  banc(on, dossierPages(PROJET_PAGES, '## Conception (p2)\n- [ ] p2-1 | A\n- [x] p2-2 | B'))
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, /Phase 2 « Conception » : 1 tâche n’est ni terminée, ni reportée, ni abandonnée/)).toBeTruthy()
  await ui.unmount()
})

test('plan vide : légende et message, aucune erreur', async ($, on) => {
  banc(on, dossierPages(PROJET_PAGES, ''))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await texte(ui, 'États d’une tâche')).toBeTruthy()
    expect(await texte(ui, 'Aucune tâche dans le plan')).toBeTruthy()
    expect(await texte(ui, 'Tâches ouvertes : impossible de valider la porte')).toBeFalsy()
    await ui.unmount()
  }
})

test('plan : mobile = lignes compactes empilées ; bureau = ligne avec colonne de statut', async ($, on) => {
  banc(on, dossierPages())
  await demarrer($)
  const mobile = await monter($, 'mobile')
  expect((await mobile.find({ key: 'tache-p2-1' }))?.props.flexDirection).toBe('column')
  expect(await mobile.find({ key: 'colonne-statut' })).toBeFalsy()
  await mobile.unmount()
  const bureau = await monter($, 'desktop')
  expect((await bureau.find({ key: 'tache-p2-1' }))?.props.flexDirection).toBe('row')
  expect(await bureau.find({ key: 'colonne-statut' })).toBeTruthy()
  await bureau.unmount()
})

test('plan : titre très long sans largeur fixe (il se replie)', async ($, on) => {
  const long = 'Un titre de tâche extrêmement long '.repeat(10).trim()
  banc(on, dossierPages(PROJET_PAGES, `## Conception (p2)\n- [ ] p2-1 | ${long} | fichier: a/b/c.md | auteur: Léa`))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    const t = await texte(ui, long)
    expect(t).toBeTruthy()
    expect(t?.props.width).toBeUndefined()
    expect(t?.props.wrap).not.toBe('clip')
    if (surface !== 'mobile') expect((await ui.find({ key: 'colonne-titre' }))?.props.flexShrink).toBe(1)
    await ui.unmount()
  }
})

test('plan : projet sans couleur de pôle et tâche d’un pôle inconnu : rien ne casse', async ($, on) => {
  banc(on, dossierPages({ ...PROJET_PAGES, poles: [{ id: 'code', titre: 'Technique' }], agents: [] }, '## Conception (p2)\n- [ ] p2-1 | A | pole: fantome'))
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, 'Phase 2 · Conception')).toBeTruthy()
  await ui.unmount()
})

const NL = String.fromCharCode(10)
const TOUT = ['porte: p1', 'porte: p2', 'porte: p3', ''].join(NL)
const FRANCHIES = (d: ReturnType<typeof dossierPages>) => ({
  ...d,
  'C:/Projet/.pilotage/equipe/lea/portes.md': TOUT,
  'C:/Projet/.pilotage/equipe/sam/portes.md': TOUT,
})

test('plan : toutes les phases franchies : ni bandeau ni pied de porte, les tâches ouvertes restent visibles', async ($, on) => {
  banc(on, FRANCHIES(dossierPages()))
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, 'Tâches ouvertes : impossible de valider la porte')).toBeFalsy()
  expect(await texte(ui, /Porte verrouillée/)).toBeFalsy()
  expect(await ui.find({ key: 'tache-p2-3' })).toBeTruthy()
  await ui.unmount()
})

test('plan : une tâche d’une phase inconnue est rangée sous « Sans phase »', async ($, on) => {
  banc(on, dossierPages(PROJET_PAGES, ['## Ailleurs (zzz)', '- [ ] z-1 | Perdue'].join(NL)))
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, 'Sans phase')).toBeTruthy()
  expect(JSON.stringify(await ui.find({ key: 'phase-sans' }))).toContain('Perdue')
  await ui.unmount()
})
