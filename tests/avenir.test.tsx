import { expect, test } from 'claude-code/testing'

import { jetons } from '../hooks/ui/theme'
import { banc, demarrer, TOUTES } from './banc'
import { PANE } from './disque'
import { dossierPages, PROJET_PAGES } from './fixture-pages'

const PROJET = {
  ...PROJET_PAGES,
  agents: [
    { id: 'a1', titre: 'Alpha', pole: 'code', skills: ['luau-et-architecture', 'securite'], pourquoi: 'Écrit le code serveur.' },
    { id: 'a2', titre: 'Beta', pole: 'art', skills: [], pourquoi: '' },
  ],
}

const PHRASES = {
  agents: 'Les agents du projet, leurs skills et leur état en direct.',
  idees: 'Les idées et retours classés automatiquement.',
  parametres: 'Thème, workflow, agents, pôles et réglages du type de projet.',
} as const
const TITRES = { agents: 'Agents', idees: 'Idées', parametres: 'Paramètres' } as const
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

test('agents : la liste du projet, en lecture seule, pôle à sa couleur et « Pourquoi spécialisé »', async ($, on) => {
  banc(on, dossierPages(PROJET))
  await demarrer($)
  const sombre = jetons('sombre')
  for (const surface of TOUTES) {
    const ui = await monter($, surface, 'agents')
    const a1 = await dans(ui, 'agent-a1')
    expect(a1).toContain('Alpha')
    expect(a1).toContain('Technique')
    expect(a1).toContain(sombre.poles.bleu.fg)
    expect(a1).toContain('Pourquoi spécialisé : Écrit le code serveur.')
    expect(a1).toContain('luau-et-architecture')
    expect(a1).toContain('securite')
    const a2 = await dans(ui, 'agent-a2')
    expect(a2).toContain('Beta')
    expect(a2).toContain('Création')
    expect(a2).not.toContain('Pourquoi spécialisé')
    await ui.unmount()
  }
})

test('agents : chaque skill a son bouton qui copie son nom', async ($, on) => {
  banc(on, dossierPages(PROJET))
  const copies: { text: string; surface?: string }[] = []
  on('ui.copy', (_: unknown, e: { text: string; surface?: string }) => { copies.push({ text: e.text, surface: e.surface }); return { value: { isCopied: true } } })
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface, 'agents')
    const boutons = (await ui.findAll({ type: 'Button' })).filter(b => String(b.key).startsWith('copier-skill-'))
    expect(boutons.length).toBe(2)
    expect(boutons[0]?.props.label).toBe('Copier le nom du skill')
    await ui.press({ key: 'copier-skill-a1-1' })
    expect(copies.at(-1)).toEqual({ text: 'securite', surface })
    await ui.unmount()
  }
})

test('agents : projet sans agent, une phrase neutre', async ($, on) => {
  banc(on, dossierPages({ ...PROJET, agents: [] }))
  await demarrer($)
  const ui = await monter($, 'desktop', 'agents')
  expect(await texte(ui, 'Aucun agent défini pour ce projet.')).toBeTruthy()
  expect(await dans(ui, 'carte-avenir-agents')).toContain('Bientôt')
  await ui.unmount()
})

test('agents : nom d’agent et skill très longs, sans largeur fixe', async ($, on) => {
  const long = 'Un nom extrêmement long '.repeat(5).trim()
  banc(on, dossierPages({ ...PROJET, agents: [{ id: 'a1', titre: long, pole: 'code', skills: [long], pourquoi: long }] }))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface, 'agents')
    for (const t of await ui.findAll({ type: 'Text', text: long })) {
      expect(t.props.width).toBeUndefined()
      expect(t.props.wrap).not.toBe('clip')
    }
    expect(await texte(ui, long)).toBeTruthy()
    await ui.unmount()
  }
})
