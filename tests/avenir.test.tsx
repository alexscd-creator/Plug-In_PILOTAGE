import { expect, test } from 'claude-code/testing'

import { banc, demarrer, TOUTES } from './banc'
import { PANE } from './disque'
import { dossierPages, PROJET_PAGES } from './fixture-pages'

const PROJET = PROJET_PAGES

const PHRASES = {
  idees: 'Les idées et retours classés automatiquement.',
} as const
const TITRES = { idees: 'Idées' } as const
const ETATS_VIVANTS = ['En travail', 'En attente d’une réponse', 'Arrêté', 'Prêt à reprendre', 'Bloqué', 'Terminé', 'Connecté']

const texte = (ui: any, t: string | RegExp) => ui.find({ type: 'Text', text: t })
const dans = async (ui: any, cle: string) => JSON.stringify(await ui.find({ key: cle }))
const monter = async ($: any, surface: string, page: string) => {
  const ui = await $.ui.mount({ ...PANE, surface })
  await ui.press({ key: `nav-${page}` })
  return ui
}

test('pages à venir : titre, étiquette « Bientôt » et la phrase exacte, sur chaque surface', async ($, on) => {
  const { ecritures } = banc(on, dossierPages(PROJET))
  await demarrer($)
  for (const surface of TOUTES) {
    for (const page of Object.keys(PHRASES) as (keyof typeof PHRASES)[]) {
      const ui = await monter($, surface, page)
      const carte = await dans(ui, `carte-avenir-${page}`)
      expect(carte).toContain(TITRES[page])
      expect(carte).toContain('Bientôt')
      expect(carte).toContain(PHRASES[page])
      expect(await texte(ui, 'À venir')).toBeFalsy()
      await ui.unmount()
    }
  }
  expect(ecritures).toEqual([])
})

test('pages à venir : aucune ne prétend montrer un état en direct', async ($, on) => {
  banc(on, dossierPages(PROJET))
  await demarrer($)
  for (const page of Object.keys(PHRASES)) {
    const ui = await monter($, 'desktop', page)
    for (const e of ETATS_VIVANTS) expect(await texte(ui, e)).toBeFalsy()
    expect(await ui.find({ key: 'pastille-travail' })).toBeFalsy()
    await ui.unmount()
  }
})
