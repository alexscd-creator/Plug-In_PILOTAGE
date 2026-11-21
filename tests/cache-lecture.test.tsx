import { expect, test } from 'claude-code/testing'

import { serializeChantier } from '../hooks/model/chantier.ts'
import type { Chantier } from '../hooks/model/chantier.ts'
import { HOME, PANE, sl } from './disque'
import { dossierPages } from './fixture-pages'

const chantier = (id: string, extra: Partial<Chantier> = {}): Chantier => ({
  id, titre: `Chantier ${id}`, pole: 'code', phase: 'p2', etat: 'attente', session: '', agents: [], taches: [], fichiers: [],
  cree: '2026-11-01T00:00:00.000Z', maj: '2026-11-01T00:00:00.000Z', passation: '', archive: false, auteur: 'Léa', ...extra,
})

/**
 * Un disque qui donne la taille et la date de chaque fichier dans `$.fs.list` (comme le vrai : la date change quand le contenu change)
 * et qui compte les lectures par chemin.
 */
function disqueDate(on: Function, fichiers: Record<string, string>) {
  const lus: string[] = []
  const versions = new Map<string, { texte: string; mtime: number }>()
  let horloge = 1_000
  const date = (p: string): number => {
    const v = versions.get(p)
    if (v?.texte === fichiers[p]) return v.mtime
    horloge += 1000
    versions.set(p, { texte: fichiers[p]!, mtime: horloge })
    return horloge
  }
  on('env.get', () => ({ value: HOME }))
  on('fs.read', (_: unknown, e: { path: string }) => { lus.push(sl(e.path)); return { value: fichiers[sl(e.path)] ?? '' } })
  on('fs.list', (_: unknown, e: { path: string }) => {
    const prefixe = sl(e.path).replace(/\/$/, '') + '/'
    const noms = new Map<string, 'file' | 'dir'>()
    for (const f of Object.keys(fichiers)) {
      if (!f.startsWith(prefixe)) continue
      const [premier, ...suite] = f.slice(prefixe.length).split('/')
      noms.set(premier!, suite.length ? 'dir' : 'file')
    }
    if (noms.size === 0) throw new Error('ENOENT')
    return {
      value: [...noms].map(([name, kind]) => {
        const p = prefixe + name
        return { name, kind, size: kind === 'file' ? fichiers[p]!.length : 0, mtimeMs: kind === 'file' ? date(p) : 0, isLink: false }
      }),
    }
  })
  on('command.register', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/Projet' }))
  on('prompt.compose', () => ({ sections: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => new Promise(() => undefined))
  return lus
}

const FICHE = 'C:/Projet/.pilotage/equipe/lea/chantiers/menu.md'
const ARCHIVE = 'C:/Projet/.pilotage/equipe/lea/archive/vieux.md'
const AGENT = 'C:/Projet/.pilotage/agents/a1.md'
const suivis = (lus: string[]) => lus.filter(p => p === FICHE || p === ARCHIVE || p === AGENT || /\/chantiers\/|\/archive\/|\/agents\//.test(p))

test('rafraîchissement sans changement : aucune fiche, archive ni fiche d’agent n’est relue ; un fichier changé : une seule lecture', async ($, on) => {
  const fichiers: Record<string, string> = {
    ...dossierPages(),
    [FICHE]: serializeChantier(chantier('menu')),
    [ARCHIVE]: serializeChantier(chantier('vieux', { archive: true, etat: 'termine' })),
    [AGENT]: '# Alpha\n',
  }
  const lus = disqueDate(on, fichiers)
  await $.session.start({ cwd: 'C:/Projet', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'navigation' })).toBeTruthy()
  expect(suivis(lus)).toContain(FICHE)

  // Tick 2 : rien n'a changé sur le disque.
  let avant = lus.length
  await ui.press({ key: 'nav-rafraichir' })
  await $.command.run({ command: 'projet' }) // relance l'enregistrement des agents (lecture des fiches d'agents)
  expect(suivis(lus.slice(avant))).toEqual([])

  // Tick 3 : la fiche du chantier change (taille et date) : elle seule est relue, une fois.
  fichiers[FICHE] = serializeChantier(chantier('menu', { etat: 'bloque', titre: 'Chantier menu modifié' }))
  avant = lus.length
  await ui.press({ key: 'nav-rafraichir' })
  expect(suivis(lus.slice(avant))).toEqual([FICHE])
  expect(await ui.find({ type: 'Text', text: /Chantier menu modifié/ })).toBeTruthy()
  await ui.unmount()
})

test('sans taille ni date (0) : rien n’est gardé, tout est relu (comportement d’avant)', async ($, on) => {
  const fichiers: Record<string, string> = { ...dossierPages(), [FICHE]: serializeChantier(chantier('menu')) }
  const lus: string[] = []
  on('env.get', () => ({ value: HOME }))
  on('fs.read', (_: unknown, e: { path: string }) => { lus.push(sl(e.path)); return { value: fichiers[sl(e.path)] ?? '' } })
  on('fs.list', (_: unknown, e: { path: string }) => {
    const prefixe = sl(e.path).replace(/\/$/, '') + '/'
    const noms = new Map<string, 'file' | 'dir'>()
    for (const f of Object.keys(fichiers)) if (f.startsWith(prefixe)) { const [a, ...s] = f.slice(prefixe.length).split('/'); noms.set(a!, s.length ? 'dir' : 'file') }
    return { value: [...noms].map(([name, kind]) => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })) }
  })
  on('command.register', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/Projet' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => new Promise(() => undefined))
  await $.session.start({ cwd: 'C:/Projet', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const avant = lus.length
  await ui.press({ key: 'nav-rafraichir' })
  expect(lus.slice(avant)).toContain(FICHE)
  await ui.unmount()
})
