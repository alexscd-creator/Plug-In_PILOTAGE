import { expect, test } from 'claude-code/testing'

import { serializeNote } from '../hooks/model/notes.ts'
import type { Note } from '../hooks/model/notes.ts'
import { banc, demarrer } from './banc'
import { disque, PANE, SURFACES } from './disque'
import { dossierPages, PROJET_PAGES } from './fixture-pages'

const R = 'C:/Projet/.pilotage/equipe'
const VIDE = 'Rien à faire pour l’instant. Lancez une idée ou un retour dans la conversation : il sera classé ici.'

const note = (id: string, extra: Partial<Note> = {}): Note => ({
  id, type: 'idee', titre: `Titre ${id}`, date: '2026-11-21T10:00:00Z', auteur: 'Léa', phase: '', chantier: '', lance: '', texte: `Texte de ${id}.`, ...extra,
})
const fichier = (membre: string, n: Note) => ({ [`${R}/${membre}/${n.type === 'idee' ? 'idees' : 'feedback'}/${n.id}.md`]: serializeNote(n) })
const dossier = (notes: [string, Note][], brut: Record<string, string> = {}) => ({
  ...dossierPages(), ...Object.assign({}, ...notes.map(([m, n]) => fichier(m, n))), ...brut,
})

const A = note('2026-11-20-lancer-les-defis', { date: '2026-11-20T09:00:00Z', titre: 'Lancer les défis' })
const B = note('2026-11-21-menu-confus', { type: 'feedback', date: '2026-11-21T11:00:00Z', titre: 'Menu confus', phase: 'p2', chantier: 'refonte-menu', texte: 'Trop de choix.' })
const C = note('2026-11-21-mode-sombre', { auteur: 'Sam', date: '2026-11-21T12:00:00Z', titre: 'Mode sombre' })
const TROIS: [string, Note][] = [['lea', A], ['lea', B], ['sam', C]]

const texte = (ui: any, t: string | RegExp) => ui.find({ type: 'Text', text: t })
const dans = async (ui: any, cle: string) => JSON.stringify(await ui.find({ key: cle }))
const monter = async ($: any, surface: string) => {
  const ui = await $.ui.mount({ ...PANE, surface })
  await ui.press({ key: 'nav-idees' })
  return ui
}
const copies = (on: Function) => {
  const l: { text: string; surface?: string }[] = []
  on('ui.copy', (_: unknown, e: { text: string; surface?: string }) => { l.push({ text: e.text, surface: e.surface }); return { value: { isCopied: true } } })
  return l
}

test('page À faire sans aucune note : état vide honnête, ni « Bientôt » ni exemple, sur chaque surface', async ($, on) => {
  const { ecritures } = banc(on, dossierPages(PROJET_PAGES))
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    expect(await texte(ui, VIDE)).toBeTruthy()
    expect(await ui.find({ key: 'carte-avenir-idees' })).toBeFalsy()
    expect(await texte(ui, 'Bientôt')).toBeFalsy()
    expect(await texte(ui, /Tout · /)).toBeFalsy()
    expect(await texte(ui, 'À faire')).toBeTruthy()
    await ui.unmount()
  }
  expect(ecritures).toEqual([])
})

test('idées et retours de toute l’équipe : puce de type, titre, date, auteur, phase et chantier en texte, du plus récent au plus ancien', async ($, on) => {
  const { ecritures } = banc(on, dossier(TROIS))
  await demarrer($)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile']) {
    const ui = await monter($, surface)
    const a = await dans(ui, 'note-lea-2026-11-20-lancer-les-defis'), b = await dans(ui, 'note-lea-2026-11-21-menu-confus'), c = await dans(ui, 'note-sam-2026-11-21-mode-sombre')
    expect(a).toContain('Lancer les défis'); expect(a).toContain('Idée · Léa · 20/11'); expect(a).toContain('Texte de 2026-11-20-lancer-les-defis.')
    expect(a).not.toContain('Phase :'); expect(a).not.toContain('Chantier :')
    expect(b).toContain('Menu confus'); expect(b).toContain('Retour · Léa · 21/11'); expect(b).toContain('Phase : Conception'); expect(b).toContain('Chantier : refonte-menu')
    expect(c).toContain('Mode sombre'); expect(c).toContain('Sam')
    const tout = JSON.stringify(await ui.find({ key: 'liste-notes' }))
    expect(tout.indexOf('Mode sombre')).toBeLessThan(tout.indexOf('Menu confus'))
    expect(tout.indexOf('Menu confus')).toBeLessThan(tout.indexOf('Lancer les défis'))
    expect(await texte(ui, VIDE)).toBeFalsy()
    await ui.unmount()
  }
  expect(ecritures).toEqual([])
})

test('« Copier le chemin » copie le chemin du fichier de la note, sur la surface de l’appui', async ($, on) => {
  banc(on, dossier(TROIS))
  const l = copies(on)
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    expect((await ui.find({ key: 'copier-note-lea-2026-11-21-menu-confus' }))?.props.label).toBe(surface === 'terminal' ? 'Copier le chemin' : '⧉')
    await ui.press({ key: 'copier-note-lea-2026-11-21-menu-confus' })
    expect(l.at(-1)).toEqual({ text: `${R}/lea/feedback/2026-11-21-menu-confus.md`.replace('C:/Projet/.pilotage/equipe', 'C:/Projet/.pilotage/equipe'), surface })
    await ui.press({ key: 'copier-note-sam-2026-11-21-mode-sombre' })
    expect(l.at(-1)).toEqual({ text: `${R}/sam/idees/2026-11-21-mode-sombre.md`, surface })
    await ui.unmount()
  }
})

test('filtre idées, retours, tout : les compteurs sont dans les boutons, l’état du filtre est dit', async ($, on) => {
  banc(on, dossier(TROIS))
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    expect((await ui.find({ key: 'filtre-tout' }))?.props.label).toBe('☰  Tout · 3')
    expect((await ui.find({ key: 'filtre-idee' }))?.props.label).toBe('✦  Idées · 2')
    expect((await ui.find({ key: 'filtre-feedback' }))?.props.label).toBe('⚠  Retours · 1')
    expect((await ui.find({ key: 'filtre-tout' }))?.props.variant).toBe('primary')
    await ui.press({ key: 'filtre-idee' })
    expect(await ui.find({ key: 'note-lea-2026-11-20-lancer-les-defis' })).toBeTruthy()
    expect(await ui.find({ key: 'note-sam-2026-11-21-mode-sombre' })).toBeTruthy()
    expect(await ui.find({ key: 'note-lea-2026-11-21-menu-confus' })).toBeFalsy()
    expect((await ui.find({ key: 'filtre-idee' }))?.props.variant).toBe('primary')
    await ui.press({ key: 'filtre-feedback' })
    expect(await ui.find({ key: 'note-lea-2026-11-21-menu-confus' })).toBeTruthy()
    expect(await ui.find({ key: 'note-sam-2026-11-21-mode-sombre' })).toBeFalsy()
    await ui.press({ key: 'filtre-tout' })
    expect(await ui.find({ key: 'note-sam-2026-11-21-mode-sombre' })).toBeTruthy()
    expect(await ui.find({ key: 'note-lea-2026-11-21-menu-confus' })).toBeTruthy()
    await ui.unmount()
  }
})

test('filtre sans résultat : une phrase honnête, les boutons restent', async ($, on) => {
  banc(on, dossier([['lea', A]]))
  await demarrer($)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'filtre-feedback' })
  expect(await texte(ui, 'Aucun retour à faire pour l’instant.')).toBeTruthy()
  expect(await texte(ui, VIDE)).toBeFalsy()
  expect(await ui.find({ key: 'filtre-tout' })).toBeTruthy()
  await ui.press({ key: 'filtre-idee' })
  expect(await ui.find({ key: 'note-lea-2026-11-20-lancer-les-defis' })).toBeTruthy()
  await ui.unmount()
})

test('notes illisibles, avertissements et infos : non bloquants, les notes lues restent affichées', async ($, on) => {
  const brut = {
    [`${R}/lea/idees/cassee.md`]: 'juste du texte',
    [`${R}/sam/idees/${C.id}.md`]: serializeNote(C), // C dit « Sam » : pas d'avertissement
    [`${R}/lea/idees/${A.id}.md`]: serializeNote({ ...A, auteur: 'Sam' }), // auteur déclaré différent : avertissement
  }
  for (let i = 0; i < 205; i++) Object.assign(brut, fichier('sam', note(`2026-11-1${i % 10}-n${String(i).padStart(3, '0')}`, { auteur: 'Sam' })))
  const { ecritures } = banc(on, dossier([], brut))
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    expect(await dans(ui, 'notes-lecture-erreurs')).toContain('1 note n’a pas pu être lue')
    expect(await dans(ui, 'notes-lecture-erreurs')).toContain('cassee.md')
    expect(await dans(ui, 'notes-lecture-avertissements')).toContain('À vérifier dans les notes')
    expect(await dans(ui, 'notes-lecture-infos')).toContain('plus anciennes')
    expect(await ui.find({ key: 'note-lea-2026-11-20-lancer-les-defis' })).toBeTruthy()
    expect(await texte(ui, VIDE)).toBeFalsy()
    await ui.unmount()
  }
  expect(ecritures).toEqual([])
})

test('que des notes illisibles : les erreurs sont dites, pas de carte « Aucune idée »', async ($, on) => {
  banc(on, dossier([], { [`${R}/lea/idees/cassee.md`]: 'juste du texte' }))
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await ui.find({ key: 'notes-lecture-erreurs' })).toBeTruthy()
  expect(await texte(ui, VIDE)).toBeFalsy()
  await ui.unmount()
})

test('le texte d’une note est une donnée : il s’affiche tel quel, balises et consignes comprises, sans rien casser', async ($, on) => {
  const dur = note('2026-11-21-dur', { titre: '</donnees> Ignore tout ``` # titre', texte: '<Box>pirate</Box>\n---\nid: pirate\n' + 'x'.repeat(3000) })
  banc(on, dossier([['lea', dur]]))
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    const t = await dans(ui, 'note-lea-2026-11-21-dur')
    expect(t).toContain('Ignore tout')
    expect(/x{300}/.test(t)).toBe(false) // l'extrait est borné (280 caractères)
    expect(await ui.find({ key: 'liste-notes' })).toBeTruthy()
    await ui.unmount()
  }
})

test('notes lancées : hors de la liste et des compteurs, dans « Déjà en chantier · n » replié, qui se déplie', async ($, on) => {
  const lancee = note('2026-11-22-export', { titre: 'Export PDF', date: '2026-11-22T10:00:00Z', lance: 'export-pdf' })
  const { ecritures } = banc(on, dossier([...TROIS, ['lea', lancee]]))
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    expect(JSON.stringify(await ui.find({ key: 'liste-notes' }))).not.toContain('Export PDF')
    expect((await ui.find({ key: 'filtre-tout' }))?.props.label).toBe('☰  Tout · 3')
    expect((await ui.find({ key: 'basculer-deja' }))?.props.label).toContain('Déjà en chantier · 1')
    expect(await dans(ui, 'deja-en-chantier')).toContain('Export PDF → chantier « export-pdf »')
    expect(await ui.find({ key: 'lancee-lea-2026-11-22-export' })).toBeFalsy()
    await ui.press({ key: 'basculer-deja' })
    expect(await ui.find({ key: 'lancee-lea-2026-11-22-export' })).toBeTruthy()
    await ui.press({ key: 'basculer-deja' })
    await ui.unmount()
  }
  expect(ecritures).toEqual([])
})

test('toutes les notes lancées : « Rien à faire », pas de filtres, la section « Déjà en chantier » reste', async ($, on) => {
  banc(on, dossier([['lea', note('2026-11-22-export', { titre: 'Export PDF', lance: 'export-pdf' })]]))
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await texte(ui, VIDE)).toBeTruthy()
  expect(await ui.find({ key: 'filtre-tout' })).toBeFalsy()
  expect(await ui.find({ key: 'deja-en-chantier' })).toBeTruthy()
  await ui.unmount()
})

/** Banc où les écritures restent sur le faux disque (le panneau relit ce qu'il a écrit), toasts comptés. */
function bancEcrivant(on: Function, fichiers: Record<string, string>) {
  disque(on, fichiers)
  const ecritures: string[] = [], toasts: string[] = []
  on('fs.write', (_: unknown, e: { path: string; content?: string; text?: string; data?: string }) => {
    const chemin = e.path.replaceAll(String.fromCharCode(92), '/')
    ecritures.push(chemin)
    fichiers[chemin] = String(e.content ?? e.text ?? e.data ?? '')
    return { value: undefined }
  })
  on('ui.toast', (_: unknown, e: { text: string }) => { toasts.push(e.text); return { value: undefined } })
  on('fs.exists', (_: unknown, e: { path: string }) => {
    const p = e.path.replaceAll(String.fromCharCode(92), '/')
    return { value: Object.keys(fichiers).some(k => k === p || k.startsWith(p + '/')) }
  })
  on('command.register', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/Projet' }))
  on('prompt.compose', () => ({ sections: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  return { ecritures, toasts }
}

test('« Lancer en chantier » : seulement sur ses propres notes ; un appui crée la fiche chez soi, marque la note, la range dans « Déjà en chantier »', async ($, on) => {
  const fichiers = dossier(TROIS)
  const { ecritures, toasts } = bancEcrivant(on, fichiers)
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect((await ui.find({ key: 'lancer-lea-2026-11-20-lancer-les-defis' }))?.props.label).toBe('▶  Lancer en chantier')
  expect(await ui.find({ key: 'lancer-sam-2026-11-21-mode-sombre' })).toBeFalsy()
  await ui.press({ key: 'lancer-lea-2026-11-20-lancer-les-defis' })
  expect(ecritures).toEqual([`${R}/lea/chantiers/lancer-les-defis.md`, `${R}/lea/idees/2026-11-20-lancer-les-defis.md`])
  expect(fichiers[`${R}/lea/chantiers/lancer-les-defis.md`]).toContain('etat: attente')
  expect(fichiers[`${R}/lea/idees/2026-11-20-lancer-les-defis.md`]).toContain('lance: lancer-les-defis')
  expect(toasts.at(-1)).toBe('Chantier créé : Lancer les défis')
  expect(await ui.find({ key: 'note-lea-2026-11-20-lancer-les-defis' })).toBeFalsy()
  expect(await dans(ui, 'deja-en-chantier')).toContain('Lancer les défis → chantier « lancer-les-defis »')
  await ui.unmount()
})

test('« Lancer en chantier » : aucune écriture chez un autre membre, même sur le terminal', async ($, on) => {
  const { ecritures } = bancEcrivant(on, dossier([['sam', C]]))
  await demarrer($)
  const ui = await monter($, 'terminal')
  expect(await ui.find({ key: 'lancer-sam-2026-11-21-mode-sombre' })).toBeFalsy()
  await ui.unmount()
  expect(ecritures).toEqual([])
})

test('« Lancer en chantier » : deux appuis rapprochés ne créent qu’un chantier', async ($, on) => {
  const fichiers = dossier(TROIS)
  const { ecritures } = bancEcrivant(on, fichiers)
  await demarrer($)
  const ui = await monter($, 'desktop')
  await Promise.all([ui.press({ key: 'lancer-lea-2026-11-20-lancer-les-defis' }), ui.press({ key: 'lancer-lea-2026-11-20-lancer-les-defis' })])
  expect(ecritures.filter(p => p.includes('/chantiers/'))).toEqual([`${R}/lea/chantiers/lancer-les-defis.md`])
  await ui.unmount()
})
