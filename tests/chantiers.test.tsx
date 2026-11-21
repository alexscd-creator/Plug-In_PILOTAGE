import { expect, test } from 'claude-code/testing'

import { serializeChantier } from '../hooks/model/chantier.ts'
import type { Chantier } from '../hooks/model/chantier.ts'
import { couleurPole, jetons } from '../hooks/ui/theme'
import { banc, demarrer, TOUTES } from './banc'
import { PANE } from './disque'
import { dossierPages, PROJET_PAGES } from './fixture-pages'

const D = 'C:/Projet/.pilotage/equipe/lea'
const MIN = 60_000
const il = (ms: number): string => new Date(Date.now() - ms).toISOString()

const fiche = (id: string, extra: Partial<Chantier> = {}): Chantier => ({
  id, titre: `Chantier ${id}`, pole: 'code', phase: 'p2', etat: 'en-travail', session: `sous-session ${id}`,
  agents: [], taches: [], fichiers: [], cree: il(48 * 60 * MIN), maj: il(MIN), passation: '', archive: false, auteur: 'Léa', ...extra,
})
/** Fichiers du disque simulé : les fiches en cours, les archivées, et les liens de session. */
const dossier = (enCours: Chantier[], archives: Chantier[] = [], sessions?: Record<string, string>, brut: Record<string, string> = {}) => ({
  ...dossierPages(),
  ...Object.fromEntries(enCours.map(c => [`${D}/chantiers/${c.id}.md`, serializeChantier(c)])),
  ...Object.fromEntries(archives.map(c => [`${D}/archive/${c.id}.md`, serializeChantier({ ...c, archive: true })])),
  ...(sessions ? { [`${D}/sessions.json`]: JSON.stringify(sessions) } : {}),
  ...brut,
})

const texte = (ui: any, t: string | RegExp) => ui.find({ type: 'Text', text: t })
const dans = async (ui: any, cle: string) => JSON.stringify(await ui.find({ key: cle }))
const monter = async ($: any, surface: string, page = 'chantiers') => {
  const ui = await $.ui.mount({ ...PANE, surface })
  if (page !== 'apercu') await ui.press({ key: `nav-${page}` })
  return ui
}
const copies = (on: Function) => {
  const l: { text: string; surface?: string }[] = []
  on('ui.copy', (_: unknown, e: { text: string; surface?: string }) => { l.push({ text: e.text, surface: e.surface }); return { value: { isCopied: true } } })
  return l
}

test('page Chantiers sans aucun chantier : état vide honnête, ni « Bientôt » ni exemple', async ($, on) => {
  const { ecritures } = banc(on, dossierPages())
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await texte(ui, 'Aucun chantier pour l’instant. Lancer un chantier : /chantier <nom> dans la conversation')).toBeTruthy()
    expect(await ui.find({ key: 'carte-avenir-chantiers' })).toBeFalsy()
    expect(await texte(ui, 'Bientôt')).toBeFalsy()
    expect(await texte(ui, /^En cours · /)).toBeFalsy()
    expect(await texte(ui, /Refonte de la fiche produit|Paiement en ligne|Charte graphique/)).toBeFalsy()
    await ui.unmount()
  }
  expect(ecritures).toEqual([])
})

test('trois chantiers : états avec libellé et icône, règle des 15 minutes, tri par mise à jour', async ($, on) => {
  const liste = [
    fiche('vieux', { titre: 'Vieux en travail', maj: il(2 * 60 * MIN), taches: [{ titre: 'a', statut: 'termine' }, { titre: 'b', statut: 'a faire' }] }),
    fiche('bloque', { titre: 'Bloqué ici', etat: 'bloque', maj: il(5 * MIN) }),
    fiche('frais', { titre: 'Frais en travail', maj: il(MIN), taches: [{ titre: 'a', statut: 'termine' }] }),
  ]
  const { ecritures } = banc(on, dossier(liste))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await texte(ui, 'En cours · 3')).toBeTruthy()
    expect(await texte(ui, /^Archivés · /)).toBeFalsy()
    const frais = await dans(ui, 'chantier-frais'), vieux = await dans(ui, 'chantier-vieux'), bloque = await dans(ui, 'chantier-bloque')
    expect(frais).toContain('En travail')
    expect(frais).toContain('100 %')
    expect(frais).not.toContain('Prêt à reprendre')
    expect(vieux).toContain('Prêt à reprendre')
    expect(vieux).not.toContain('En travail')
    expect(vieux).toContain('Sans nouvelle depuis plus de 15 minutes')
    expect(vieux).toContain('50 %')
    expect(bloque).toContain('Bloqué')
    expect(frais).toContain('Session : sous-session frais')
    const tout = JSON.stringify(await ui.find({ key: 'section-en-cours' }))
    expect(tout.indexOf('Frais en travail')).toBeLessThan(tout.indexOf('Bloqué ici'))
    expect(tout.indexOf('Bloqué ici')).toBeLessThan(tout.indexOf('Vieux en travail'))
    if (surface === 'terminal') expect(frais).toContain('▶')
    await ui.unmount()
  }
  expect(ecritures).toEqual([])
})

test('« Copier le nom de la session » copie le nom, l’interface dit ce qu’il fait', async ($, on) => {
  banc(on, dossier([fiche('a'), fiche('sans', { session: '' })]))
  const l = copies(on)
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect((await ui.find({ key: 'copier-session-a' }))?.props.label).toBe('Copier le nom de la session')
    expect(await ui.find({ key: 'copier-session-sans' })).toBeFalsy()
    expect(await texte(ui, /Copier le nom de la session.*\/resume/)).toBeTruthy()
    await ui.press({ key: 'copier-session-a' })
    expect(l.at(-1)).toEqual({ text: 'sous-session a', surface })
    await ui.unmount()
  }
})

test('couleur du pôle : la barre du chantier prend la teinte de son pôle', async ($, on) => {
  banc(on, dossier([fiche('a', { pole: 'code' }), fiche('b', { pole: 'art' }), fiche('c', { pole: 'inconnu' })]))
  await demarrer($)
  const j = jetons('sombre')
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await dans(ui, 'chantier-a')).toContain(j.poles.bleu.fg)
    // « art » n'a pas de couleur dans le projet : la teinte de son rang (le deuxième pôle).
    expect(await dans(ui, 'chantier-b')).toContain(j.poles[couleurPole(undefined, 1)].fg)
    expect(await dans(ui, 'chantier-c')).toContain(j.accent)
    expect(await dans(ui, 'chantier-a')).toContain('Technique')
    await ui.unmount()
  }
})

test('chantier archivé : badge, dates, tâches faites, passation, fichiers à copier, agents', async ($, on) => {
  const archive = fiche('vieux', {
    titre: 'Choix du domaine', etat: 'termine', cree: '2026-10-01T09:00:00Z', maj: '2026-10-04T17:00:00Z',
    taches: [{ titre: 'a', statut: 'termine' }, { titre: 'b', statut: 'termine' }, { titre: 'c', statut: 'a faire' }],
    fichiers: ['docs/domaine.md', 'chantiers/choix.md'], passation: 'Nom retenu.\nRenouveler en octobre.',
    agents: [{ id: 'a1', etat: 'termine', quoi: '' }, { id: 'gardien', etat: 'termine', quoi: '' }],
  })
  banc(on, dossier([], [archive]))
  const l = copies(on)
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await texte(ui, 'Archivés · 1')).toBeTruthy()
    expect(await texte(ui, /^En cours · /)).toBeFalsy()
    const a = await dans(ui, 'chantier-vieux')
    for (const s of ['Archivé', 'Choix du domaine', 'Du 2026-10-01 au 2026-10-04', '2 tâches faites', '2 fichiers produits', 'Agents : Alpha, gardien', 'Passation', 'Nom retenu. Renouveler en octobre.']) expect(a).toContain(s)
    expect(a).not.toContain('Copier le nom de la session')
    expect((await ui.find({ key: 'copier-fichier-vieux-0' }))?.props.label).toBe('Copier le chemin')
    await ui.press({ key: 'copier-fichier-vieux-1' })
    expect(l.at(-1)).toEqual({ text: 'chantiers/choix.md', surface })
    await ui.unmount()
  }
})

test('fiche invalide et avertissement : une carte non bloquante, les autres chantiers restent', async ($, on) => {
  const ok = fiche('ok', { titre: 'Fiche saine' })
  const brut = {
    [`${D}/chantiers/cassee.md`]: '---\nid: cassee\ntitre: Cassée\netat: nimporte\n---\n',
    [`${D}/chantiers/chemin.md`]: serializeChantier(fiche('chemin')).replace('## fichiers', '## fichiers\n- ../dehors.txt'),
  }
  banc(on, dossier([ok], [], undefined, brut))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await dans(ui, 'chantier-ok')).toContain('Fiche saine')
    expect(await dans(ui, 'chantier-chemin')).toContain('Chantier chemin')
    const erreurs = await dans(ui, 'chantiers-lecture-erreurs')
    expect(erreurs).toContain('cassee.md')
    expect(erreurs).toContain('est écartée')
    expect(erreurs).not.toContain('dehors.txt')
    const avis = await dans(ui, 'chantiers-lecture-avertissements')
    expect(avis).toContain('dehors.txt')
    expect(avis).not.toContain('(avertissement)')
    await ui.unmount()
  }
})

test('bandeau : « Vous êtes dans le chantier » sur toutes les pages, agents appelés avec leur pastille', async ($, on) => {
  const agents = [{ id: 'a1', etat: 'en-travail' as const, quoi: 'Écrit le lobby' }, { id: 'gardien', etat: 'attente' as const, quoi: 'Relit' }, { id: 'fini', etat: 'termine' as const, quoi: '' }]
  banc(on, dossier([fiche('lobby', { titre: 'Carte du lobby', agents }), fiche('autre')], [], { s1: 'lobby' }))
  on('session.id', () => ({ value: 's1' }))
  await demarrer($)
  for (const surface of TOUTES) {
    for (const page of ['apercu', 'plan', 'phases', 'chantiers', 'agents', 'idees', 'parametres']) {
      const ui = await monter($, surface, page)
      const b = await dans(ui, 'bandeau-chantier')
      expect(b).toContain('Vous êtes dans le chantier : Carte du lobby')
      expect(b).toContain('Technique')
      expect(b).toContain('Alpha')
      expect(b).toContain('Écrit le lobby')
      expect(b).toContain('En travail')
      expect(b).toContain('gardien')
      expect(b).toContain('En attente d’une réponse')
      expect(b).not.toContain('fini')
      expect(await dans(ui, 'bandeau-chantier')).not.toContain('Chantier autre')
      await ui.unmount()
    }
  }
})

test('bandeau absent : session inconnue, sans lien, chantier archivé, identifiant illisible', async ($, on) => {
  const archive = fiche('vieux', { archive: true })
  banc(on, dossier([fiche('a')], [archive], { s1: 'a', s9: 'vieux' }))
  let id = 'autre'
  on('session.id', () => ({ value: id }))
  await demarrer($)
  for (const v of ['autre', 's9', '']) {
    id = v
    const ui = await monter($, 'desktop', 'apercu')
    expect(await ui.find({ key: 'bandeau-chantier' })).toBeFalsy()
    expect(await texte(ui, /Vous êtes dans le chantier/)).toBeFalsy()
    await ui.unmount()
  }
})

test('Vue d’ensemble : les vrais chantiers en cours (mêmes lignes), les archivés en sont absents', async ($, on) => {
  banc(on, dossier([fiche('a', { titre: 'Un en cours' }), fiche('b', { titre: 'Autre', maj: il(3 * 60 * MIN) })], [fiche('vieux', { titre: 'Déjà fini' })]))
  const l = copies(on)
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface, 'apercu')
    expect(await texte(ui, 'Chantiers en cours')).toBeTruthy()
    expect(await texte(ui, 'Le suivi des chantiers arrive bientôt.')).toBeFalsy()
    expect(await dans(ui, 'chantier-a')).toContain('Un en cours')
    expect(await dans(ui, 'chantier-b')).toContain('Prêt à reprendre')
    expect(await ui.find({ key: 'chantier-vieux' })).toBeFalsy()
    expect(await texte(ui, /Pour lancer un chantier : tapez \/chantier suivi de son nom dans la conversation\./)).toBeTruthy()
    await ui.press({ key: 'copier-session-a' })
    expect(l.at(-1)).toEqual({ text: 'sous-session a', surface })
    await ui.unmount()
  }
})

test('Vue d’ensemble : sans chantier, état vide honnête ; fiches illisibles, on ne prétend pas qu’il n’y en a aucun', async ($, on) => {
  banc(on, dossierPages())
  await demarrer($)
  const vide = await monter($, 'desktop', 'apercu')
  expect(await texte(vide, 'Aucun chantier pour l’instant. Lancer un chantier : /chantier <nom> dans la conversation')).toBeTruthy()
  expect(await texte(vide, 'Le suivi des chantiers arrive bientôt.')).toBeFalsy()
  await vide.unmount()
})

test('Vue d’ensemble : fiches illisibles seules, renvoi vers la page Chantiers', async ($, on) => {
  banc(on, dossier([], [], undefined, { [`${D}/chantiers/cassee.md`]: 'rien' }))
  await demarrer($)
  const ui = await monter($, 'desktop', 'apercu')
  expect(await texte(ui, /1 fiche de chantier n’a pas pu être lue : voir la page Chantiers/)).toBeTruthy()
  expect(await texte(ui, /^Aucun chantier pour l’instant/)).toBeFalsy()
  await ui.unmount()
})

test('pôle : les tâches des chantiers comptent avec leur pôle, détail du projet avec le nombre de chantiers', async ($, on) => {
  const c = fiche('a', { pole: 'art', taches: [{ titre: 'x', statut: 'termine' }, { titre: 'y', statut: 'a faire' }] })
  banc(on, dossier([c]))
  await demarrer($)
  const ui = await monter($, 'desktop', 'apercu')
  // Pôle « art » : 1 tâche terminée sur 1 dans le plan + 1 sur 2 du chantier = 2 sur 3.
  expect(await dans(ui, 'pole-art')).toContain('2 tâches terminées sur 3')
  expect(await dans(ui, 'pole-code')).toContain('1 tâche terminée sur 2')
  expect(await texte(ui, /1 chantier en cours/)).toBeTruthy()
  await ui.unmount()
})

test('détail d’un chantier : atome chantierOuvert, tâches, fichiers et agents sollicités', async ($, on) => {
  const c = fiche('a', {
    taches: [{ titre: 'Poser le sol', statut: 'termine' }, { titre: 'Peindre', statut: 'a faire' }], fichiers: ['src/lobby.luau'],
    agents: [{ id: 'a1', etat: 'en-travail', quoi: 'Écrit le lobby' }], passation: '',
  })
  banc(on, dossier([c, fiche('b')]))
  const l = copies(on)
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await ui.find({ key: 'detail-chantier-a' })).toBeFalsy()
    await ui.press({ key: 'detail-a' })
    const d = await dans(ui, 'detail-chantier-a')
    for (const s of ['Agents sollicités', 'Écrit le lobby', 'Tâches du chantier', 'Poser le sol', 'Peindre', 'Fichiers du chantier', 'src/lobby.luau']) expect(d).toContain(s)
    expect(await ui.find({ key: 'detail-chantier-b' })).toBeFalsy()
    await ui.press({ key: 'copier-fichier-a-0' })
    expect(l.at(-1)).toEqual({ text: 'src/lobby.luau', surface })
    await ui.press({ key: 'detail-b' })
    expect(await ui.find({ key: 'detail-chantier-a' })).toBeFalsy()
    expect(await ui.find({ key: 'detail-chantier-b' })).toBeTruthy()
    await ui.press({ key: 'detail-b' })
    expect(await ui.find({ key: 'detail-chantier-b' })).toBeFalsy()
    await ui.unmount()
  }
})

test('disque en panne ou fiches absentes : le panneau reste affiché', async ($, on) => {
  banc(on, { ...dossierPages(PROJET_PAGES) })
  on('session.id', () => { throw new Error('pas d’id') })
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await ui.find({ key: 'bandeau-chantier' })).toBeFalsy()
  expect(await texte(ui, /Aucun chantier pour l’instant/)).toBeTruthy()
  await ui.unmount()
})
