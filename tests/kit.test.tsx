import { expect, test } from 'claude-code/testing'

import { avatar, barreProgression, boutonCopier, bulle, cadre, carte, chipPole, creerCtx, pastille, titreSection } from '../hooks/ui/kit'
import type { Ctx } from '../hooks/ui/kit'
import { GLYPHES } from '../hooks/ui/icones'
import { barreHaut, navigation, PAGES } from '../hooks/ui/nav'
import { ETATS, jetons, LIBELLES_ETAT } from '../hooks/ui/theme'
import type { Mode } from '../hooks/ui/theme'
import { PANE } from './disque'

const TOUTES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
type Surface = (typeof TOUTES)[number]

/** Banc : un faux moteur sous le plugin répond avec l'arbre du kit ; à appeler avant tout usage de `$`. */
function banc(on: Function) {
  const etat: { construire: (c: Ctx, $: any) => unknown; surface: Surface; colonnes: number; mode: Mode } = {
    construire: () => null, surface: 'desktop', colonnes: 120, mode: 'clair',
  }
  on('ui.render', ($: any, e: any) => {
    const ui = $.ui.resolve(e)
    return etat.construire(creerCtx(ui, jetons(etat.mode), etat.surface, etat.colonnes), $) as never
  })
  return ($: any, surface: Surface, construire: (c: Ctx, $: any) => unknown, o: { colonnes?: number; mode?: Mode } = {}) => {
    Object.assign(etat, { construire, surface, colonnes: o.colonnes ?? 120, mode: o.mode ?? 'clair' })
    return $.ui.mount({ ...PANE, requestId: 'kit', surface, props: { ...PANE.props, bodyColumns: o.colonnes ?? 120 } })
  }
}

test('Cadre : colonne centrée de 110 colonnes (880 px) au plus, fond du mode', async ($, on) => {
  const monter = banc(on)
  for (const surface of TOUTES) {
    const ui = await monter($, surface, c => cadre(c, [<c.ui.Text>x</c.ui.Text>]), { colonnes: 160 })
    const colonne = await ui.find({ key: 'cadre-colonne' })
    expect(colonne?.props.width).toBe(110)
    const racine = await ui.find({ key: 'cadre' })
    expect(racine?.props.alignItems).toBe('center')
    expect(racine?.props.backgroundColor).toBe(jetons('clair').fond)
    await ui.unmount()
  }
})

test('Cadre : l’application mobile est toujours en colonne fluide', async ($, on) => {
  const monter = banc(on)
  const ui = await monter($, 'mobile', c => cadre(c, []), { colonnes: 50 })
  expect((await ui.find({ key: 'cadre-colonne' }))?.props.width).toBe(46)
  await ui.unmount()
})

test('Cadre : sous 600 px (75 colonnes) la colonne est fluide avec la gouttière mobile', async ($, on) => {
  const monter = banc(on)
  const ui = await monter($, 'desktop', c => cadre(c, []), { colonnes: 60 })
  expect((await ui.find({ key: 'cadre-colonne' }))?.props.width).toBe(56)
  expect((await ui.find({ key: 'cadre' }))?.props.paddingTop).toBe('lg')
  await ui.unmount()
  const large = await monter($, 'desktop', c => cadre(c, []), { colonnes: 100 })
  expect((await large.find({ key: 'cadre-colonne' }))?.props.width).toBe(92)
  await large.unmount()
})

test('les jetons du mode changent le fond : clair et sombre diffèrent', async ($, on) => {
  const monter = banc(on)
  const clair = await monter($, 'desktop', c => cadre(c, []), { mode: 'clair' })
  expect((await clair.find({ key: 'cadre' }))?.props.backgroundColor).toBe('#f6f7fa')
  await clair.unmount()
  const sombre = await monter($, 'desktop', c => cadre(c, []), { mode: 'sombre' })
  expect((await sombre.find({ key: 'cadre' }))?.props.backgroundColor).toBe('#0d0e12')
  await sombre.unmount()
})

test('Pastille : icône et libellé exact pour chacun des six états, sur chaque surface', async ($, on) => {
  const monter = banc(on)
  for (const surface of TOUTES) {
    for (const etat of ETATS) {
      const ui = await monter($, surface, c => pastille(c, etat), { mode: 'sombre' })
      const j = jetons('sombre')
      const libelle = await ui.find({ type: 'Text', text: LIBELLES_ETAT[etat] })
      expect(libelle?.text).toBe(LIBELLES_ETAT[etat])
      expect(libelle?.props.color).toBe(j.etats[etat].fg)
      if (surface === 'terminal') {
        expect(await ui.find({ type: 'Svg' })).toBeFalsy()
        expect(await ui.find({ type: 'Text', text: GLYPHES[jetons('sombre').etats[etat].icone] })).toBeTruthy()
      } else {
        const svg = await ui.find({ type: 'Svg' })
        expect(String(svg?.props.source)).toContain('stroke="' + j.etats[etat].fg + '"')
      }
      expect((await ui.find({ key: `pastille-${etat}` }))?.props.backgroundColor).toBe(j.etats[etat].soft)
      await ui.unmount()
    }
  }
})

test('ChipPole : la teinte vient de la couleur du pôle, et change avec le mode', async ($, on) => {
  const monter = banc(on)
  for (const surface of TOUTES) {
    const ui = await monter($, surface, c => chipPole(c, 'Qualité', 'orange'), { mode: 'clair' })
    const nom = await ui.find({ type: 'Text', text: 'Qualité' })
    expect(nom?.props.color).toBe(jetons('clair').poles.orange.fg)
    expect((await ui.find({ key: 'chip-pole' }))?.props.backgroundColor).toBe(jetons('clair').poles.orange.soft)
    await ui.unmount()
  }
  const sombre = await monter($, 'desktop', c => chipPole(c, 'Qualité', 'orange'), { mode: 'sombre' })
  expect((await sombre.find({ type: 'Text', text: 'Qualité' }))?.props.color).toBe(jetons('sombre').poles.orange.fg)
  await sombre.unmount()
})

test('BarreProgression : pourcentage écrit, valeur bornée', async ($, on) => {
  const monter = banc(on)
  for (const surface of TOUTES) {
    const ui = await monter($, surface, c => barreProgression(c, 'Progression du projet', 0.4))
    expect(await ui.find({ text: /40 %/ })).toBeTruthy()
    await ui.unmount()
    const trop = await monter($, surface, c => barreProgression(c, 'x', 7, 'vert'))
    expect(await trop.find({ text: /100 %/ })).toBeTruthy()
    await trop.unmount()
    const nan = await monter($, surface, c => barreProgression(c, 'x', Number.NaN))
    expect(await nan.find({ text: /^0 %$|\b0 %/ })).toBeTruthy()
    await nan.unmount()
  }
})

test('Avatar : l’initiale, jamais de balisage', async ($, on) => {
  const monter = banc(on)
  const gr = await monter($, 'desktop', c => avatar(c, 'léa<b>'))
  const svg = await gr.find({ type: 'Svg' })
  expect(String(svg?.props.source)).toContain('>L<')
  expect(String(svg?.props.source)).not.toContain('<b>')
  await gr.unmount()
  const te = await monter($, 'terminal', c => avatar(c, 'léa'))
  expect(await te.find({ type: 'Text', text: /L/ })).toBeTruthy()
  await te.unmount()
})

test('TitreSection et Carte : titre, aide, contenu', async ($, on) => {
  const monter = banc(on)
  const ui = await monter($, 'desktop', c => carte(c, [titreSection(c, 'Pôles du projet', 'Une aide.'), <c.ui.Text>dedans</c.ui.Text>]))
  expect(await ui.find({ type: 'Text', text: 'Pôles du projet' })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: 'Une aide.' })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: 'dedans' })).toBeTruthy()
  const k = await ui.find({ key: 'carte' })
  expect(k?.props.backgroundColor).toBe(jetons('clair').surface)
  expect(k?.props.borderColor).toBe(jetons('clair').bord)
  await ui.unmount()
})

test('BoutonCopier : sur mobile, icône seule avec le nom accessible conservé', async ($, on) => {
  const monter = banc(on)
  const mobile = await monter($, 'mobile', c => boutonCopier(c, 'f1', 'a/b.md', async () => undefined))
  const b = await mobile.find({ key: 'copier-f1' })
  expect(b?.props.label).toBe('Copier le chemin')
  expect(JSON.stringify(b?.children)).not.toMatch(/Copier le chemin/)
  await mobile.unmount()
  const etroit = await monter($, 'desktop', c => boutonCopier(c, 'f1', 'a/b.md', async () => undefined), { colonnes: 50 })
  expect(JSON.stringify((await etroit.find({ key: 'copier-f1' }))?.children)).not.toMatch(/Copier le chemin/)
  await etroit.unmount()
  const bureau = await monter($, 'desktop', c => boutonCopier(c, 'f1', 'a/b.md', async () => undefined))
  expect((await bureau.find({ key: 'copier-f1' }))?.text).toMatch(/Copier le chemin/)
  await bureau.unmount()
})

test('Navigation : sept onglets dans l’ordre de la maquette, l’actif en teinte d’accent', async ($, on) => {
  const monter = banc(on)
  expect(PAGES.map(p => p.titre)).toEqual(['Vue d’ensemble', 'Plan', 'Phases', 'Chantiers', 'Agents', 'Idées', 'Paramètres'])
  const j = jetons('clair')
  for (const surface of TOUTES) {
    const ui = await monter($, surface, c => navigation(c, 'plan', () => undefined))
    const boutons = await ui.findAll({ type: 'Button' })
    expect(boutons.map(b => b.props.label)).toEqual(PAGES.map(p => p.titre))
    expect((await ui.find({ key: 'onglet-plan' }))?.props.backgroundColor).toBe(j.accentSoft)
    expect((await ui.find({ key: 'onglet-agents' }))?.props.backgroundColor).toBeUndefined()
    await ui.unmount()
  }
})

test('Navigation : sur mobile elle reste sur une ligne et défile à l’horizontale', async ($, on) => {
  const monter = banc(on)
  const mobile = await monter($, 'mobile', c => navigation(c, 'apercu', () => undefined))
  const nav = await mobile.find({ key: 'navigation' })
  expect(nav?.props.overflowX).toBe('scroll')
  expect(nav?.props.flexWrap).not.toBe('wrap')
  await mobile.unmount()
  const bureau = await monter($, 'desktop', c => navigation(c, 'apercu', () => undefined))
  expect((await bureau.find({ key: 'navigation' }))?.props.overflowX).not.toBe('scroll')
  await bureau.unmount()
})

test('Barre du haut : « Pilotage · type », nom du projet, rafraîchir et paramètres', async ($, on) => {
  const monter = banc(on)
  for (const surface of TOUTES) {
    const ui = await monter($, surface, c =>
      barreHaut(c, { type: 'Site web', icone: 'globe', nom: 'Mon projet', rafraichir: () => undefined, reglages: () => undefined }))
    expect(await ui.find({ type: 'Text', text: 'Pilotage · Site web' })).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: 'Mon projet' })).toBeTruthy()
    expect((await ui.find({ key: 'nav-rafraichir' }))?.props.label).toBe('Rafraîchir')
    expect((await ui.find({ key: 'nav-reglages' }))?.props.label).toBe('Paramètres')
    await ui.unmount()
  }
})

test('icônes décoratives : alt vide (le libellé est écrit à côté), jamais le nom technique de l’icône', async ($, on) => {
  const monter = banc(on)
  const ui = await monter($, 'desktop', c => <c.ui.Box>{pastille(c, 'travail')}{bulle(c, 'dossier', 64)}</c.ui.Box>)
  const svgs = await ui.findAll({ type: 'Svg' })
  expect(svgs.length).toBe(2)
  for (const s of svgs) expect(s.props.alt).toBe('')
  await ui.unmount()
})
