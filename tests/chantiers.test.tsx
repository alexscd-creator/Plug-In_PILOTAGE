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
    expect(await texte(ui, 'Aucun chantier pour l’instant. Lancer un chantier : /pilotage:chantier <nom> dans la conversation')).toBeTruthy()
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
    expect(await texte(ui, /Mis à jour toutes les 5 secondes\./)).toBeTruthy()
    expect(await texte(ui, /en direct/)).toBeFalsy()
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
    expect(await texte(ui, /copiez le nom, puis \/resume/)).toBeTruthy()
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
    expect(await texte(ui, 'Mis à jour toutes les 5 secondes.')).toBeTruthy()
    expect(await texte(ui, /Rafraîchi automatiquement|en direct/)).toBeFalsy()
    expect(await texte(ui, 'Le suivi des chantiers arrive bientôt.')).toBeFalsy()
    expect(await dans(ui, 'chantier-a')).toContain('Un en cours')
    expect(await dans(ui, 'chantier-b')).toContain('Prêt à reprendre')
    expect(await ui.find({ key: 'chantier-vieux' })).toBeFalsy()
    expect(await texte(ui, /Pour lancer un chantier : tapez \/pilotage:chantier suivi de son nom dans la conversation\./)).toBeTruthy()
    await ui.press({ key: 'copier-session-a' })
    expect(l.at(-1)).toEqual({ text: 'sous-session a', surface })
    await ui.unmount()
  }
})

test('Vue d’ensemble : sans chantier, état vide honnête ; fiches illisibles, on ne prétend pas qu’il n’y en a aucun', async ($, on) => {
  banc(on, dossierPages())
  await demarrer($)
  const vide = await monter($, 'desktop', 'apercu')
  expect(await texte(vide, 'Aucun chantier pour l’instant. Lancer un chantier : /pilotage:chantier <nom> dans la conversation')).toBeTruthy()
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
  expect(await dans(ui, 'pole-art')).toContain('2 tâches terminées sur 3 (dont 2 dans des chantiers)')
  expect(await dans(ui, 'pole-code')).not.toContain('dans des chantiers')
  expect(await dans(ui, 'pole-code')).toContain('1 tâche terminée sur 2')
  expect(await texte(ui, /1 chantier en cours/)).toBeTruthy()
  await ui.unmount()
})

test('chantier ouvert : la page remplace la liste, progression, agents, tâches, fichiers, retour à la liste', async ($, on) => {
  const c = fiche('a', {
    taches: [{ titre: 'Poser le sol', statut: 'termine' }, { titre: 'Peindre', statut: 'a faire' }], fichiers: ['src/lobby.luau'],
    agents: [{ id: 'a1', etat: 'en-travail', quoi: 'Écrit le lobby' }], passation: '', maj: il(12 * MIN),
  })
  banc(on, dossier([c, fiche('b')]))
  const l = copies(on)
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await ui.find({ key: 'chantier-ouvert-a' })).toBeFalsy()
    await ui.press({ key: 'ouvrir-a' })
    expect(await dans(ui, 'chantier-ouvert-a')).toContain('Chantier a')
    expect(await dans(ui, 'chantier-ouvert-a')).toContain('ouvert le')
    const prog = await dans(ui, 'progression-chantier-a')
    for (const s of ['Progression du chantier', '50 %', '1 tâche terminée sur 2', 'mis à jour il y a 12 min']) expect(prog).toContain(s)
    expect(await dans(ui, 'agents-sollicites')).toContain('Écrit le lobby')
    const t = await dans(ui, 'taches-chantier-a')
    for (const s of ['Tâches du chantier', 'Poser le sol', 'Peindre']) expect(t).toContain(s)
    expect(await dans(ui, 'fichiers-chantier-a')).toContain('src/lobby.luau')
    // La liste a disparu : ni l'autre chantier, ni la section « En cours ».
    expect(await ui.find({ key: 'chantier-b' })).toBeFalsy()
    expect(await texte(ui, /^En cours · /)).toBeFalsy()
    await ui.press({ key: 'copier-fichier-a-0' })
    expect(l.at(-1)).toEqual({ text: 'src/lobby.luau', surface })
    await ui.press({ key: 'tous-les-chantiers' })
    expect(await ui.find({ key: 'chantier-ouvert-a' })).toBeFalsy()
    expect(await ui.find({ key: 'chantier-b' })).toBeTruthy()
    await ui.press({ key: 'ouvrir-b' })
    expect(await ui.find({ key: 'chantier-ouvert-b' })).toBeTruthy()
    // L'onglet Chantiers ramène toujours à la liste.
    await ui.press({ key: 'nav-chantiers' })
    expect(await ui.find({ key: 'chantier-ouvert-b' })).toBeFalsy()
    await ui.unmount()
  }
})

test('session d’un chantier : le panneau s’ouvre sur ce chantier, puis garde la page choisie', async ($, on) => {
  banc(on, dossier([fiche('lobby', { titre: 'Carte du lobby' }), fiche('autre')], [], { s1: 'lobby' }))
  on('session.id', () => ({ value: 's1' }))
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await dans(ui, 'chantier-ouvert-lobby')).toContain('Carte du lobby')
  expect(await ui.find({ key: 'bandeau-chantier' })).toBeTruthy()
  await ui.press({ key: 'nav-plan' })
  expect(await ui.find({ key: 'chantier-ouvert-lobby' })).toBeFalsy()
  await ui.unmount()
  const encore = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await encore.find({ key: 'chantier-ouvert-lobby' })).toBeFalsy()
  await encore.unmount()
})

test('sous-session liée après l’ouverture du panneau : il passe seul sur le chantier au rafraîchissement suivant', async ($, on) => {
  const fichiers: Record<string, string> = dossier([fiche('lobby', { titre: 'Carte du lobby' })])
  banc(on, fichiers)
  on('session.id', () => ({ value: 's1' }))
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'chantier-ouvert-lobby' })).toBeFalsy()
  // /pilotage:chantier ouvrir lobby écrit le lien de session (lier-session) pendant que le panneau est ouvert.
  fichiers[`${D}/sessions.json`] = JSON.stringify({ s1: 'lobby' })
  await ui.press({ key: 'nav-rafraichir' })
  expect(await dans(ui, 'chantier-ouvert-lobby')).toContain('Carte du lobby')
  await ui.unmount()
})

test('hors session de chantier : le panneau s’ouvre sur l’Aperçu', async ($, on) => {
  banc(on, dossier([fiche('lobby')], [], { s1: 'lobby' }))
  on('session.id', () => ({ value: 'autre' }))
  await demarrer($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'chantier-ouvert-lobby' })).toBeFalsy()
  expect(await ui.find({ key: 'tous-les-chantiers' })).toBeFalsy()
  expect(await ui.find({ key: 'chantier-lobby' })).toBeTruthy()
  await ui.unmount()
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

test('pôle qui n’a que des tâches de chantier, et tâche du chantier déjà au plan non comptée deux fois', async ($, on) => {
  const projet = { ...PROJET_PAGES, poles: [...PROJET_PAGES.poles, { id: 'qa', titre: 'Qualité' }] }
  const c = fiche('a', { pole: 'qa', taches: [{ titre: 'Tester', statut: 'termine' }, { titre: 'Relire', statut: 'a faire' }] })
  const doublon = fiche('b', { pole: 'art', taches: [{ titre: 'maquette', statut: 'termine' }, { titre: 'Nouvelle', statut: 'a faire' }] })
  banc(on, { ...dossier([c, doublon]), 'C:/Projet/.pilotage/projet.json': JSON.stringify(projet) })
  await demarrer($)
  const ui = await monter($, 'desktop', 'apercu')
  expect(await dans(ui, 'pole-qa')).toContain('1 tâche terminée sur 2 (dont 2 dans des chantiers)')
  // « maquette » est déjà au plan (pôle art) : seule « Nouvelle » s'ajoute : 1 sur 1 du plan + 0 sur 1 = 1 sur 2.
  expect(await dans(ui, 'pole-art')).toContain('1 tâche terminée sur 2 (dont 1 dans des chantiers)')
  await ui.unmount()
})

test('plus de 100 archives : une ligne neutre, jamais la bannière rouge ; 100 exactement : rien', async ($, on) => {
  const archives = (n: number) => Array.from({ length: n }, (_, i) => fiche(`b${String(i).padStart(3, '0')}`, { etat: 'termine' }))
  banc(on, dossier([], archives(101)))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface)
    expect(await dans(ui, 'chantiers-lecture-infos')).toContain('1 fiche archivée plus ancienne n’est pas affichée.')
    expect(await ui.find({ key: 'chantiers-lecture-erreurs' })).toBeFalsy()
    expect(await texte(ui, /pas pu être lue/)).toBeFalsy()
    expect(await texte(ui, 'Archivés · 100')).toBeTruthy()
    await ui.unmount()
    const accueil = await monter($, surface, 'apercu')
    expect(await texte(accueil, /pas pu être lue/)).toBeFalsy()
    await accueil.unmount()
  }
})

test('100 archives exactement : aucune ligne d’information', async ($, on) => {
  banc(on, dossier([], Array.from({ length: 100 }, (_, i) => fiche(`b${String(i).padStart(3, '0')}`, { etat: 'termine' }))))
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await ui.find({ key: 'chantiers-lecture-infos' })).toBeFalsy()
  await ui.unmount()
})

test('bandeau : deux membres avec le même id de chantier, celui du propriétaire du lien de session', async ($, on) => {
  const sam = serializeChantier(fiche('carte', { titre: 'Carte de Sam' }))
  banc(on, dossier([fiche('carte', { titre: 'Carte de Léa' })], [], undefined, {
    'C:/Projet/.pilotage/equipe/sam/chantiers/carte.md': sam,
    'C:/Projet/.pilotage/equipe/sam/sessions.json': JSON.stringify({ s1: 'carte' }),
  }))
  on('session.id', () => ({ value: 's1' }))
  await demarrer($)
  for (const surface of TOUTES) {
    const ui = await monter($, surface, 'apercu')
    const b = await dans(ui, 'bandeau-chantier')
    expect(b).toContain('Carte de Sam')
    expect(b).not.toContain('Carte de Léa')
    await ui.unmount()
  }
})
