import { expect, test } from 'claude-code/testing'

import { jetons } from '../hooks/ui/theme'
import { CONFIG_LEA } from './banc'
import { disque, HOME, PANE, sl, SURFACES } from './disque'
import { PLAN_PAGES, PROJET_PAGES } from './fixture-pages'

const D = 'C:/Projet/.pilotage'
const PROJET_JSON = `${D}/projet.json`
const MON = `${HOME}/.claude/pilotage/mon-workflow.json`

const SITE = {
  ...PROJET_PAGES,
  poles: [{ id: 'code', titre: 'Technique', couleur: 'bleu' }, { id: 'art', titre: 'Création', couleur: 'rose' }, { id: 'libre', titre: 'Libre' }],
  agents: [
    { id: 'a1', titre: 'Alpha', pole: 'code', skills: ['luau'], pourquoi: 'Écrit le code.' },
    { id: 'a2', titre: 'Beta', pole: 'art', skills: [], pourquoi: '' },
  ],
  workflow: { outils: [{ role: 'Code', outil: 'Claude' }, { role: 'Design', outil: 'Figma' }] },
  reglagesDef: [
    { id: 'domaine', libelle: 'Domaine', genre: 'texte', aide: 'L’adresse du site.' },
    { id: 'hebergement', libelle: 'Hébergement', genre: 'choix', options: ['à choisir', 'mutualisé', 'cloud'], defaut: 'à choisir' },
    { id: 'paiement-en-ligne', libelle: 'Paiement en ligne', genre: 'oui-non', defaut: false },
  ],
  reglages: { domaine: 'a.fr', hebergement: 'à choisir', 'paiement-en-ligne': false },
}
const ROBLOX = {
  ...SITE, preset: 'jeu-roblox',
  vocabulaire: { type: 'Jeu Roblox', nomDuProjet: 'Nom du jeu', leProjet: 'le jeu', unProjet: 'un jeu', objectif: 'Objectif du jeu', fini: 'Fini ?' },
  reglagesDef: [
    { id: 'connexion-roblox-studio', libelle: 'Connexion à Roblox Studio', genre: 'oui-non', defaut: false },
    { id: 'moderation-et-charte-joueur', libelle: 'Modération et charte joueur', genre: 'oui-non', defaut: true },
    { id: 'public-vise', libelle: 'Public visé', genre: 'choix', options: ['tout public', '10 ans et plus'], defaut: 'tout public' },
  ],
  reglages: { 'connexion-roblox-studio': false, 'moderation-et-charte-joueur': true, 'public-vise': 'tout public' },
}

type Opts = { panne?: (p: string) => boolean; sansMembre?: boolean }
/** Faux disque qui retient les écritures (le panneau relit ce qu'il a écrit) ; `ecrits` garde l'ordre des chemins. */
function banc(on: Function, projet: object, o: Opts = {}) {
  const fichiers: Record<string, string> = {
    [PROJET_JSON]: JSON.stringify(projet),
    [`${D}/plan.md`]: PLAN_PAGES,
    [`${D}/equipe/lea/portes.md`]: 'porte: p1\n',
    ...(o.sansMembre ? {} : { [CONFIG_LEA]: '{"prenom":"lea"}' }),
  }
  disque(on, fichiers)
  const ecrits: string[] = []
  const toasts: string[] = []
  on('fs.write', (_: unknown, e: { path: string; text: string }) => {
    const p = sl(e.path)
    if (o.panne?.(p)) throw new Error('disque refuse')
    ecrits.push(p)
    fichiers[p] = e.text
    return { value: undefined }
  })
  on('fs.exists', (_: unknown, e: { path: string }) => ({ value: sl(e.path) in fichiers }))
  on('command.register', () => ({ value: undefined }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:/Projet' }))
  on('prompt.compose', () => ({ sections: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('clock.every', () => new Promise(() => undefined))
  on('ui.toast', (_: unknown, e: { text: string }) => { toasts.push(e.text); return { value: undefined } })
  return { fichiers, ecrits, toasts, projet: () => JSON.parse(fichiers[PROJET_JSON]!) }
}
const demarrer = ($: any) => $.session.start({ cwd: 'C:/Projet', surface: 'terminal', isInteractive: true })
const monter = async ($: any, surface: string, page = 'parametres') => {
  const ui = await $.ui.mount({ ...PANE, surface })
  await ui.press({ key: page === 'parametres' ? 'nav-reglages' : `nav-${page}` })
  return ui
}
const texte = (ui: any, t: string | RegExp) => ui.find({ type: 'Text', text: t })
const dans = async (ui: any, cle: string) => JSON.stringify(await ui.find({ key: cle }))


test('sections de la maquette pour le type Site web : libellés du vocabulaire et réglages du type, sur chaque surface, rien d’écrit', async ($, on) => {
  const b = banc(on, SITE)
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    for (const s of ['apparence', 'type', 'workflow', 'agents', 'poles', 'equipe', 'github']) expect(await ui.find({ key: `parametres-${s}` })).toBeTruthy()
    const type = await dans(ui, 'parametres-type')
    for (const x of ['Site web', 'Domaine', 'Hébergement', 'Paiement en ligne']) expect(type).toContain(x)
    for (const x of ['Site web', 'Nom du site', 'Boutique test']) expect(await dans(ui, 'parametres-projet')).toContain(x)
    expect(type).not.toContain('Connexion à Roblox Studio')
    expect(await dans(ui, 'parametres-github')).toContain('Bientôt')
    expect(await dans(ui, 'parametres-equipe')).toContain('Léa')
    expect(await dans(ui, 'parametres-equipe')).toContain('Sam')
    expect(await texte(ui, 'Réglages du type « Site web ».')).toBeTruthy()
    expect(await ui.find({ type: 'Text', text: 'Bientôt' })).toBeTruthy()
    await ui.unmount()
  }
  expect(b.ecrits).toEqual([])
})

test('sections pour le type Jeu Roblox : les réglages du type changent, les autres sections restent', async ($, on) => {
  const b = banc(on, ROBLOX)
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    const type = await dans(ui, 'parametres-type')
    for (const x of ['Jeu Roblox', 'Connexion à Roblox Studio', 'Modération et charte joueur', 'Public visé']) expect(type).toContain(x)
    expect(await dans(ui, 'parametres-projet')).toContain('Nom du jeu')
    expect(type).not.toContain('Domaine')
    expect(type).not.toContain('Hébergement')
    expect(await ui.find({ key: 'parametres-workflow' })).toBeTruthy()
    expect(await ui.find({ key: 'parametres-agents' })).toBeTruthy()
    await ui.unmount()
  }
  expect(b.ecrits).toEqual([])
})

test('réglages du type : texte, choix, oui-non s’écrivent dans projet.json (copie .bak d’abord) et le panneau montre la valeur', async ($, on) => {
  const b = banc(on, SITE)
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    await ui.input({ key: 'reglage-domaine', text: `site-${surface}.fr` })
    expect(b.projet().reglages.domaine).toBe(`site-${surface}.fr`)
    await ui.select({ key: 'reglage-hebergement', value: 'cloud' })
    expect(b.projet().reglages.hebergement).toBe('cloud')
    await ui.press({ key: 'reglage-paiement-en-ligne' })
    expect(b.projet().reglages['paiement-en-ligne']).toBe(true)
    await ui.press({ key: 'reglage-paiement-en-ligne' })
    expect(b.projet().reglages['paiement-en-ligne']).toBe(false)
    expect((await ui.find({ key: 'reglage-domaine' }))?.props.value).toBe(`site-${surface}.fr`)
    await ui.unmount()
  }
  expect(b.ecrits.slice(0, 2)).toEqual([`${PROJET_JSON}.bak`, PROJET_JSON])
  expect(b.ecrits.every(p => p === PROJET_JSON || p === `${PROJET_JSON}.bak` || p === `${PROJET_JSON}.bak2`)).toBe(true)
  expect(b.toasts.length).toBeGreaterThan(0)
  expect(b.projet().nom).toBe('Boutique test')
})

test('un réglage refusé (trop long) : les erreurs en français dans le panneau, le fichier ne change pas', async ($, on) => {
  const b = banc(on, SITE)
  await demarrer($)
  const ui = await monter($, 'desktop')
  const avant = b.fichiers[PROJET_JSON]
  await ui.input({ key: 'reglage-domaine', text: 'x'.repeat(501) })
  expect(b.fichiers[PROJET_JSON]).toBe(avant)
  expect(b.ecrits).toEqual([])
  expect(await dans(ui, 'parametres-erreurs')).toContain('500')
  await ui.unmount()
})

test('écriture qui échoue : l’erreur est dite, le fichier garde son contenu', async ($, on) => {
  const b = banc(on, SITE, { panne: p => p === PROJET_JSON })
  await demarrer($)
  const ui = await monter($, 'desktop')
  const avant = b.fichiers[PROJET_JSON]
  await ui.press({ key: 'reglage-paiement-en-ligne' })
  expect(b.fichiers[PROJET_JSON]).toBe(avant)
  expect(await dans(ui, 'parametres-erreurs')).toContain('projet.json.bak')
  await ui.unmount()
})

test('fichier modifié par un associé depuis l’affichage : refus, rien n’est écrasé', async ($, on) => {
  const b = banc(on, SITE)
  await demarrer($)
  const ui = await monter($, 'desktop')
  b.fichiers[PROJET_JSON] = JSON.stringify({ ...SITE, nom: 'Nom d’un associé' })
  await ui.press({ key: 'reglage-paiement-en-ligne' })
  expect(b.ecrits).toEqual([])
  expect(JSON.parse(b.fichiers[PROJET_JSON]!).nom).toBe('Nom d’un associé')
  expect(await dans(ui, 'parametres-erreurs')).toContain('changé')
  await ui.unmount()
})

test('workflow : modifier, ajouter (« Rôle : Outil »), retirer ; le dernier outil ne se retire pas', async ($, on) => {
  const b = banc(on, SITE)
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await ui.find({ key: 'flux-outil-0' })).toBeFalsy() // fermé : les rôles et leurs outils en pastilles
  await ui.press({ key: 'flux-editer' })
  await ui.input({ key: 'flux-outil-0', text: 'Cursor' })
  expect(b.projet().workflow.outils[0]).toEqual({ role: 'Code', outil: 'Cursor' })
  await ui.input({ key: 'flux-role-1', text: 'Maquettes' })
  expect(b.projet().workflow.outils[1]).toEqual({ role: 'Maquettes', outil: 'Figma' })
  await ui.input({ key: 'flux-ajout', text: 'Son : Audacity' })
  expect(b.projet().workflow.outils.at(-1)).toEqual({ role: 'Son', outil: 'Audacity' })
  await ui.press({ key: 'flux-retirer-2' })
  expect(b.projet().workflow.outils.length).toBe(2)
  await ui.press({ key: 'flux-retirer-1' })
  expect(b.projet().workflow.outils.length).toBe(1)
  await ui.press({ key: 'flux-retirer-0' })
  expect(b.projet().workflow.outils.length).toBe(1)
  expect(await dans(ui, 'parametres-erreurs')).toContain('vide')
  await ui.input({ key: 'flux-ajout', text: 'sans deux-points' })
  expect(b.projet().workflow.outils.length).toBe(1)
  await ui.unmount()
})

/** Tous les textes d'un arbre rendu (un par Text), pour vérifier ce qui s'affiche vraiment. */
const NL = String.fromCharCode(10)
const textes = (noeud: unknown, sortie: string[] = []): string[] => {
  if (typeof noeud === 'string') sortie.push(noeud)
  else if (Array.isArray(noeud)) noeud.forEach(n => textes(n, sortie))
  else if (noeud && typeof noeud === 'object') Object.values(noeud).forEach(n => textes(n, sortie))
  return sortie
}

test('« Mon workflow » : un résumé lisible, aucun JSON ni chemin de fichier, sur chaque surface ; rien n’est écrit avant le bouton', async ($, on) => {
  const b = banc(on, SITE)
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    const lignes = textes(await ui.find({ key: 'parametres-workflow' })).join(NL).split(NL)
    for (const l of lignes) {
      expect(l).not.toContain('{')
      expect(l).not.toContain('"outils"')
      expect(l).not.toContain('mon-workflow')
      expect(l).not.toContain('.claude')
    }
    const flux = lignes.join(NL)
    for (const x of ['Code', 'Claude', 'Design', 'Figma']) expect(lignes).toContain(x) // rôles et outils en pastilles
    expect(flux).toContain('2 outils')
    expect(await ui.find({ key: 'workflow-enregistrer' })).toBeTruthy()
    await ui.unmount()
  }
  expect(b.ecrits).toEqual([])
})

test('« Enregistrer comme mon workflow » : écrit au bouton, dit « Workflow enregistré pour vos prochains projets. »', async ($, on) => {
  const b = banc(on, SITE)
  await demarrer($)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'workflow-enregistrer' })
  expect(b.ecrits).toEqual([MON])
  expect(JSON.parse(b.fichiers[MON]!)).toEqual({ outils: SITE.workflow.outils })
  expect(b.fichiers[PROJET_JSON]).toBe(JSON.stringify(SITE))
  expect(b.toasts).toContain('Workflow enregistré pour vos prochains projets.')
  await ui.unmount()
})

test('mon workflow déjà présent : jamais écrasé en silence (confirmation par $.ui.ask)', async ($, on) => {
  const b = banc(on, SITE)
  b.fichiers[MON] = '{"outils":[{"role":"x","outil":"y"}]}'
  const questions: string[] = []
  const textesQuestion: string[] = []
  on('tool.call', (_: unknown, e: { tool: string; questions?: { question: string }[] }) => {
    questions.push(e.tool)
    textesQuestion.push(...(e.questions ?? []).map(q => q.question))
    return { result: { questions: e.questions ?? [], answers: { [e.questions?.[0]?.question ?? '']: 'Garder' } } }
  })
  await demarrer($)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'workflow-enregistrer' })
  expect(questions).toContain('AskUserQuestion')
  expect(textesQuestion.join(' ')).toContain('2 outils')
  expect(textesQuestion.join(' ')).not.toMatch(/[{}]|mon-workflow|\.claude/)
  expect(b.ecrits).toEqual([])
  expect(b.fichiers[MON]).toBe('{"outils":[{"role":"x","outil":"y"}]}')
  await ui.unmount()
})

test('agents : désactiver (grisé dans la page Agents), réactiver, rôle, skills ; aucun champ d’outils', async ($, on) => {
  const b = banc(on, SITE)
  await demarrer($)
  const ui = await monter($, 'desktop')
  const agents = await dans(ui, 'parametres-agents')
  expect(agents).toContain('Alpha')
  expect(agents).not.toMatch(/outils/i)
  await ui.press({ key: 'agent-actif-a1' })
  expect(b.projet().agents[0].actif).toBe(false)
  expect(b.projet().agents[1].actif).toBeUndefined()
  await ui.press({ key: 'nav-agents' })
  expect(JSON.stringify(await ui.find({ key: 'agent-a1' }))).toContain('Désactivé')
  expect(JSON.stringify(await ui.find({ key: 'agent-a2' }))).not.toContain('Désactivé')
  await ui.press({ key: 'nav-reglages' })
  await ui.press({ key: 'agent-actif-a1' })
  expect(b.projet().agents[0].actif).toBeUndefined()
  await ui.press({ key: 'agent-editer-a2' })
  await ui.input({ key: 'agent-titre-a2', text: 'Bêta revu' })
  await ui.input({ key: 'agent-pourquoi-a2', text: 'Relit le travail.' })
  expect(b.projet().agents[1]).toMatchObject({ titre: 'Bêta revu', pourquoi: 'Relit le travail.', pole: 'art' })
  await ui.press({ key: 'agent-editer-a1' })
  await ui.input({ key: 'agent-skills-a1', text: 'luau, secu' })
  expect(b.projet().agents[0].skills).toEqual(['luau', 'secu'])
  await ui.unmount()
})

test('pôles : renommer, couleur, doublon de teinte refusé, ajouter, retirer ; un pôle utilisé ne se retire pas', async ($, on) => {
  const b = banc(on, SITE)
  await demarrer($)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'pole-editer-code' })
  await ui.input({ key: 'pole-titre-code', text: 'Code' })
  expect(b.projet().poles[0].titre).toBe('Code')
  await ui.press({ key: 'pole-editer-libre' })
  await ui.select({ key: 'pole-couleur-libre', value: 'vert' })
  expect(b.projet().poles[2].couleur).toBe('vert')
  const avant = b.fichiers[PROJET_JSON]
  await ui.press({ key: 'pole-editer-code' })
  await ui.select({ key: 'pole-couleur-code', value: 'rose' })
  expect(b.fichiers[PROJET_JSON]).toBe(avant)
  expect(await dans(ui, 'parametres-erreurs')).toContain('rose')
  await ui.press({ key: 'pole-retirer-code' })
  expect(b.fichiers[PROJET_JSON]).toBe(avant)
  expect(await dans(ui, 'parametres-erreurs')).toContain('Alpha')
  await ui.press({ key: 'pole-retirer-libre' })
  expect(b.projet().poles.map((p: { id: string }) => p.id)).toEqual(['code', 'art'])
  await ui.input({ key: 'pole-ajout', text: 'Son et musique' })
  const dernier = b.projet().poles.at(-1)
  expect(dernier).toMatchObject({ id: 'son-et-musique', titre: 'Son et musique' })
  expect(['bleu', 'rose']).not.toContain(dernier.couleur)
  await ui.unmount()
})

test('prénom inconnu : réglages en lecture seule avec l’explication, rien ne s’écrit', async ($, on) => {
  const b = banc(on, SITE, { sansMembre: true })
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    expect(await texte(ui, 'Indiquez votre prénom pour modifier les réglages')).toBeTruthy()
    for (const key of ['reglage-domaine', 'reglage-hebergement', 'reglage-paiement-en-ligne', 'flux-ajout', 'flux-retirer-0', 'agent-actif-a1', 'pole-ajout', 'pole-retirer-libre', 'workflow-enregistrer']) {
      expect(await ui.find({ key })).toBeFalsy()
    }
    expect(await dans(ui, 'parametres-type')).toContain('a.fr')
    await ui.unmount()
  }
  expect(b.ecrits).toEqual([])
})

test('thème : système, clair, sombre se posent dans l’atome du panneau, sans écrire sur le disque', async ($, on) => {
  const b = banc(on, SITE)
  await demarrer($)
  for (const surface of SURFACES) {
    const ui = await monter($, surface)
    for (const t of ['clair', 'sombre', 'systeme']) {
      await ui.press({ key: `theme-${t}` })
      for (const autre of ['clair', 'sombre', 'systeme']) {
        expect((await ui.find({ key: `theme-${autre}` }))?.props.variant).toBe(autre === t ? 'primary' : 'secondary')
      }
      if (t !== 'systeme') expect((await ui.find({ key: 'cadre' }))?.props.backgroundColor).toBe(jetons(t).fond)
    }
    await ui.unmount()
  }
  expect(b.ecrits).toEqual([])
})

test('mon workflow déjà présent, « Remplacer » choisi : le fichier est remplacé', async ($, on) => {
  const b = banc(on, SITE)
  b.fichiers[MON] = '{"outils":[{"role":"x","outil":"y"}]}'
  on('tool.call', (_: unknown, e: { questions?: { question: string }[] }) => ({ result: { questions: e.questions ?? [], answers: { [e.questions?.[0]?.question ?? '']: 'Remplacer' } } }))
  await demarrer($)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'workflow-enregistrer' })
  expect(b.ecrits).toEqual([MON])
  expect(JSON.parse(b.fichiers[MON]!)).toEqual({ outils: SITE.workflow.outils })
  await ui.unmount()
})

// ---- Fix round 1 ----
const SIEN = '{"outils":[{"role":"Son","outil":"Audacity"},{"role":"Code","outil":"Claude"}]}'

test('désactiver un agent : le texte et le toast disent la vérité (pris en compte au prochain démarrage, appelable d’ici là)', async ($, on) => {
  const b = banc(on, SITE)
  await demarrer($)
  const ui = await monter($, 'desktop')
  const aide = await dans(ui, 'parametres-agents')
  expect(aide).toContain('pris en compte au prochain démarrage de la session')
  expect(aide).not.toContain('n’est plus proposé')
  await ui.press({ key: 'agent-actif-a1' })
  expect(b.toasts.at(-1)).toContain('Désactivé : pris en compte au prochain démarrage de la session ; l’agent reste appelable d’ici là.')
  await ui.press({ key: 'agent-actif-a1' })
  expect(b.toasts.at(-1)).not.toContain('appelable')
  await ui.unmount()
})

for (const [nom, contenu, attendu] of [['absent', undefined, false], ['illisible', 'pas du json', false], ['vide', '{"outils":[]}', false], ['valide', SIEN, true]] as const) {
  test(`Charger mon workflow : fichier ${nom} : bouton ${attendu ? 'présent' : 'absent'}`, async ($, on) => {
    const b = banc(on, SITE)
    if (contenu !== undefined) b.fichiers[MON] = contenu
    await demarrer($)
    const ui = await monter($, 'desktop')
    expect(!!(await ui.find({ key: 'workflow-charger' }))).toBe(attendu)
    await ui.unmount()
  })
}

test('Charger mon workflow : confirmé par « Charger » (la question montre la liste) : le workflow du projet est remplacé, copie .bak d’abord', async ($, on) => {
  const b = banc(on, SITE)
  b.fichiers[MON] = SIEN
  const questions: string[] = []
  on('tool.call', (_: unknown, e: { questions?: { question: string }[] }) => {
    questions.push(e.questions?.[0]?.question ?? '')
    return { result: { questions: e.questions ?? [], answers: { [e.questions?.[0]?.question ?? '']: 'Charger' } } }
  })
  await demarrer($)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'workflow-charger' })
  expect(questions[0]).toContain('Son : Audacity')
  expect(questions[0]).toContain('Code : Claude')
  expect(b.projet().workflow.outils).toEqual([{ role: 'Son', outil: 'Audacity' }, { role: 'Code', outil: 'Claude' }])
  expect(b.ecrits).toEqual([`${PROJET_JSON}.bak`, PROJET_JSON])
  expect(b.fichiers[MON]).toBe(SIEN)
  await ui.unmount()
})

for (const reponse of ['Garder', 'Autre texte', null]) {
  test(`Charger mon workflow : réponse ${reponse === null ? 'refusée par le moteur' : `« ${reponse} »`} : rien ne change`, async ($, on) => {
    const b = banc(on, SITE)
    b.fichiers[MON] = SIEN
    on('tool.call', (_: unknown, e: { questions?: { question: string }[] }) =>
      reponse === null ? { deny: 'refusé' } : { result: { questions: e.questions ?? [], answers: { [e.questions?.[0]?.question ?? '']: reponse } } })
    await demarrer($)
    const ui = await monter($, 'desktop')
    await ui.press({ key: 'workflow-charger' })
    expect(b.ecrits).toEqual([])
    expect(b.projet().workflow.outils).toEqual(SITE.workflow.outils)
    await ui.unmount()
  })
}

test('Charger mon workflow : pas de bouton en lecture seule', async ($, on) => {
  const b = banc(on, SITE, { sansMembre: true })
  b.fichiers[MON] = SIEN
  await demarrer($)
  const ui = await monter($, 'desktop')
  expect(await ui.find({ key: 'workflow-charger' })).toBeFalsy()
  await ui.unmount()
})

test('liens : un .pilotage qui est un lien (fs.stat) : la modification est refusée, rien n’est écrit, l’erreur le dit', async ($, on) => {
  const b = banc(on, SITE)
  on('fs.stat', (_: unknown, e: { path: string }) => {
    const p = sl(e.path)
    if (p === 'C:/Projet') return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: false, realPath: 'C:/Projet' } }
    if (p === D) return { value: { kind: 'dir', size: 0, mtimeMs: 0, isLink: true, realPath: 'C:/Users/Jo/.claude' } }
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
  })
  await demarrer($)
  const ui = await monter($, 'desktop')
  const avant = b.fichiers[PROJET_JSON]
  await ui.press({ key: 'reglage-paiement-en-ligne' })
  expect(b.ecrits).toEqual([])
  expect(b.fichiers[PROJET_JSON]).toBe(avant)
  expect(await dans(ui, 'parametres-erreurs')).toContain('Chemin non sûr')
  await ui.unmount()
})

test('liens : sans lien (fs.stat répond, tout est sous le projet), la modification s’écrit comme avant', async ($, on) => {
  const b = banc(on, SITE)
  on('fs.stat', (_: unknown, e: { path: string }) => {
    const p = sl(e.path)
    if (p in b.fichiers || p === 'C:/Projet' || p === D) return { value: { kind: 'file', size: 1, mtimeMs: 1, isLink: false, realPath: p.replaceAll('/', String.fromCharCode(92)) } }
    throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
  })
  await demarrer($)
  const ui = await monter($, 'desktop')
  await ui.press({ key: 'reglage-paiement-en-ligne' })
  expect(b.projet().reglages['paiement-en-ligne']).toBe(true)
  await ui.unmount()
})
