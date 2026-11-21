import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ChoixTheme, Page } from '../types'
import { lirePrenomConfig, membreCourant, trouverProjet } from './model/activation.ts'
import type { FsLike } from './model/activation.ts'
import { agentDeSousType, appelEnFond, attenteEnCours, classerResultat, cleDAppel, debutAppel, debutAttente, finAppel, finAttente, fusionnerEtats, LIVE_VIDE } from './model/agents-live.ts'
import type { Live } from './model/agents-live.ts'
import { creerRegistre, lireFiches, lireSkills, specsProjet } from './model/agents-registre.ts'
import { chantierDeSession } from './model/chantiers.ts'
import { construireConsigne, construireEtat, entreeDepuisLecture } from './model/consigne.ts'
import { creerEcrivain, majFiche } from './model/ecriture-chantier.ts'
import { ecritureSure, MESSAGE_LIEN_PANNEAU } from './model/liens.ts'
import type { StatLien } from './model/liens.ts'
import { creerSuivi, ecrireMonWorkflow, ecrireProjet, cheminMonWorkflow, questionChargement, questionEcrasement } from './model/ecriture-projet.ts'
import type { Patch } from './model/ecriture-projet.ts'
import type { Cible, MajFiche, Moyens } from './model/ecriture-chantier.ts'
import { lireNotes, lireProjetComplet, lireSessions } from './model/lecture.ts'
import type { LectureNotes, LienSession } from './model/lecture.ts'
import { creerMinuterie } from './model/minuterie.ts'
import type { Minuterie } from './model/minuterie.ts'
import type { LectureProjet } from './model/lecture.ts'
import { libelle, parseMonWorkflow } from './model/presets.ts'
import { memeMembre, parseProjet } from './model/projet.ts'
import type { Projet, Workflow } from './model/projet.ts'
import { encoderRetour } from './model/retour-commande.ts'
import { pageApercu } from './ui/apercu'
import { pageAgents } from './ui/agents'
import { bandeauChantier } from './ui/bandeau'
import { pageChantiers } from './ui/chantiers'
import { cadre, creerCtx } from './ui/kit'
import type { Ctx } from './ui/kit'
import { barreHaut, navigation, PAGES } from './ui/nav'
import type { NomIcone } from './ui/icones'
import { pageParametres } from './ui/parametres'
import { pageIdees } from './ui/idees'
import type { FiltreIdees } from './ui/idees'
import { pagePhases } from './ui/phases'
import { pagePlan } from './ui/plan'
import { jetons, modeDeTheme } from './ui/theme'
import type { Mode } from './ui/theme'
import { carteErreurRendu, COMMANDE_DEMARRER, ecranErreur, ecranVide, retourCommande } from './ui/vide'

const PANE = 'pilotage'
/** La commande du panneau (`/projet`). */
const COMMANDE_PANNEAU = 'projet'
/** Durée pendant laquelle la consigne du modèle n'est pas relue sur le disque. */
const DUREE_CONSIGNE_MS = 20_000
/** L'état du projet est rattaché à un message quand il a changé, et au plus tard après ce délai (rappel). */
const RAPPEL_ETAT_MS = 30 * 60_000

// Vrai quand un projet valide est ouvert dans cette session : rien ne s'injecte tant qu'il est faux.
const actif = atom({ plugin: 'pilotage', key: 'actif' } as const, false, { shape: 'actif-1' })
// Dossier racine du projet trouvé (là où vit .pilotage/), vide sans projet.
const projetTrouve = atom({ plugin: 'pilotage', key: 'projetTrouve' } as const, '', { shape: 'projet-1' })
// Membre courant d'après ~/.claude/pilotage/config.json ; vide si inconnu (le panneau invitera à se choisir).
const membre = atom({ plugin: 'pilotage', key: 'membre' } as const, '', { shape: 'membre-1' })
// Erreurs d'un marqueur invalide, rappelées à /projet.
const erreursMarqueur = atom({ plugin: 'pilotage', key: 'erreursMarqueur' } as const, [] as string[], {
  shape: 'erreurs-1',
})
// Page affichée dans le panneau (état de session).
const page = atom({ plugin: 'pilotage', key: 'page' } as const, 'apercu' as Page, { shape: 'page-1' })
// Phase ouverte dans la page Phases ('' : la phase en cours).
const phaseOuverte = atom({ plugin: 'pilotage', key: 'phaseOuverte' } as const, '', { shape: 'phase-ouverte-1' })
// Chantier dont le détail est ouvert dans la page Chantiers ('' : aucun).
const chantierOuvert = atom({ plugin: 'pilotage', key: 'chantierOuvert' } as const, '', { shape: 'chantier-ouvert-1' })
// Pôle filtré dans la page Agents ('' : tous les pôles).
const filtrePole = atom({ plugin: 'pilotage', key: 'filtrePole' } as const, '', { shape: 'filtre-pole-1' })
// Agent dont le détail est ouvert dans la page Agents ('' : la grille).
const agentOuvert = atom({ plugin: 'pilotage', key: 'agentOuvert' } as const, '', { shape: 'agent-ouvert-1' })
// Filtre de la page Idées : tout, les idées seulement ou les retours seulement.
const filtreIdees = atom({ plugin: 'pilotage', key: 'filtreIdees' } as const, 'tout' as FiltreIdees, { shape: 'filtre-idees-1' })
// Compteur : un changement force une nouvelle lecture des fichiers (bouton Rafraîchir).
const tick = atom({ plugin: 'pilotage', key: 'tick' } as const, 0, { shape: 'tick-1' })
// Thème du panneau : « systeme » suit le thème de l'application (ligne « theme » de `$.config.list`), sombre si elle ne se lit pas.
const theme = atom({ plugin: 'pilotage', key: 'theme' } as const, 'systeme' as ChoixTheme, { shape: 'theme-1' })
// Ce qui s'est passé quand un bouton a voulu envoyer une commande (voir model/retour-commande.ts) ; vide : tout est parti.
const retour = atom({ plugin: 'pilotage', key: 'retourCommande' } as const, '', { shape: 'retour-1' })

// Erreurs de la dernière modification refusée dans Paramètres (vide : rien à dire).
const erreursReglages = atom({ plugin: 'pilotage', key: 'erreursReglages' } as const, [] as string[], { shape: 'erreurs-reglages-1' })

// Agents suivis en direct (appels de l'outil Agent en cours, issue du dernier appel, questions en attente) : état de session, jamais sur disque.
const agentsLive = atom({ plugin: 'pilotage', key: 'agentsLive' } as const, LIVE_VIDE as Live, { shape: 'agents-live-1' })
// Dernière erreur d'écriture de l'état d'un agent dans une fiche ('' : tout va bien). Affichée nulle part pour l'instant.
const erreurEcriture = atom({ plugin: 'pilotage', key: 'erreurEcriture' } as const, '', { shape: 'erreur-ecriture-1' })

// Abandonne les écritures de fiche en attente (changement ou perte de projet) ; posé par `register`.
let purgerEcritures: () => void = () => undefined

type EntreeListe = { name: string; kind?: string; size?: number; mtimeMs?: number; isLink?: boolean }
type Empreinte = { size: number; mtimeMs: number }
const cheminNet = (p: string): string => String(p).replaceAll(String.fromCharCode(92), '/').replace(/\/+$/, '')
/**
 * Noms d'un dossier, sans les liens (symboliques ou jonctions), dont le chemin va dans `liens` : un lien n'est jamais lu ni parcouru.
 * La taille et la date de chaque fichier listé vont dans `vus` (quand on les donne) : elles évitent de relire un fichier inchangé.
 */
const listeSansLiens = async ($: any, p: string, liens: string[], vus?: Map<string, Empreinte>): Promise<string[]> => {
  const base = cheminNet(p)
  const sortie: string[] = []
  for (const x of (await $.fs.list(p)) as EntreeListe[]) {
    if (x.isLink === true) { liens.push(`${base}/${x.name}`); continue }
    if (vus && x.kind === 'file' && typeof x.size === 'number' && typeof x.mtimeMs === 'number' && x.mtimeMs > 0) vus.set(`${base}/${x.name}`, { size: x.size, mtimeMs: x.mtimeMs })
    sortie.push(x.name)
  }
  return sortie
}

// Textes déjà lus, par chemin, avec la taille et la date que la liste de leur dossier donnait alors. Une lecture qui retrouve, dans les
// listes qu'ELLE vient de faire, la même taille et la même date rend le texte gardé au lieu de relire le disque (les fiches, archives et
// fiches d'agents ne sont plus relues à chaque tick). Vidé à chaque changement ou perte de projet ; borné.
const textesLus = new Map<string, Empreinte & { texte: string }>()
const MAX_TEXTES_LUS = 2000
function oublierTextesLus(): void {
  textesLus.clear()
}

/** Le disque du modèle pour UNE lecture (une passe) : liens retirés, et fichiers inchangés depuis la passe d'avant pris dans `textesLus`. */
const adapter = ($: any): FsLike => {
  const liens: string[] = []
  const vus = new Map<string, Empreinte>() // ce que les listes de cette passe ont vu (jamais une empreinte d'une passe d'avant)
  return {
    liens,
    list: p => listeSansLiens($, p, liens, vus),
    read: async p => {
      const cle = cheminNet(p)
      const vu = vus.get(cle)
      const garde = textesLus.get(cle)
      if (vu && garde && garde.size === vu.size && garde.mtimeMs === vu.mtimeMs) return garde.texte
      const texte = String((await $.fs.read(p)) ?? '')
      if (vu) {
        if (textesLus.size >= MAX_TEXTES_LUS) textesLus.clear()
        textesLus.set(cle, { ...vu, texte })
      }
      return texte
    },
  }
}

/** `$.fs.stat(p, { resolve: true })` réduit à ce que le contrôle des liens lit ; null si le chemin n'existe pas ou ne se contrôle pas. */
const statLien = ($: any): StatLien => async p => {
  try {
    const s = await $.fs.stat(p, { resolve: true })
    return s && typeof s === 'object' ? { isLink: s.isLink === true, ...(typeof s.realPath === 'string' ? { realPath: s.realPath } : {}) } : null
  } catch {
    return null
  }
}
/** Écrit un fichier du projet depuis le panneau, jamais au travers d'un lien (voir model/liens.ts) : sinon lève, rien n'est écrit. */
async function ecrireDansProjet($: any, racine: string, p: string, texte: string): Promise<void> {
  if (!(await ecritureSure(statLien($), racine, p))) throw new Error(MESSAGE_LIEN_PANNEAU)
  await $.fs.write(p, texte)
}

/** Plus de projet valide ici : le plugin redevient inactif. */
async function remettreAZero($: any, auto?: Minuterie): Promise<void> {
  auto?.arreter()
  oublierTextesLus()
  await viderAgents($)
  await update($, actif, () => false)
  await update($, projetTrouve, () => '')
  await update($, membre, () => '')
}

/** Plus aucun agent suivi, plus aucune écriture de fiche en attente. Ne lève jamais. */
async function viderAgents($: any): Promise<void> {
  try {
    purgerEcritures()
  } catch {
    // Rien de plus à faire.
  }
  try {
    registre.oublier() // un autre projet (ou plus de projet) : ses agents ne sont plus enregistrés ici
    verrouLive = Promise.resolve() // une étape figée n'occupe plus la file du nouveau projet
    await majLive($, () => LIVE_VIDE)
  } catch {
    // L'état refuse : les suivis restent, ils finiront avec leurs appels.
  }
}

// Agents du projet déjà enregistrés auprès du moteur (un appel de `$.agent.register` par agent nouveau ou changé).
const registre = creerRegistre()
let syncEnCours = false

/**
 * Enregistre les agents du projet ouvert (nom = id) pour que la conversation principale puisse les convoquer ; un agent dont le
 * contenu a changé (fiche, rôle, skills...) est remplacé. Rien sans projet actif. Ne lève jamais.
 */
async function synchroniserAgents($: any): Promise<void> {
  if (syncEnCours) return
  syncEnCours = true
  try {
    if (!(await read($, actif))) return
    const racine = await read($, projetTrouve)
    if (racine === '') return
    const r = parseProjet(String((await $.fs.read(`${racine}/.pilotage/projet.json`)) ?? ''))
    if (!r.ok) return
    const disque = adapter($) // une seule passe : les fiches et les skills inchangés viennent du cache (taille et date)
    const fiches = await lireFiches(disque, racine, r.projet)
    const skills = await lireSkills(disque, racine, r.projet)
    await registre.synchroniser(spec => $.agent.register(spec), specsProjet(r.projet, fiches, skills))
  } catch {
    // Un enregistrement qui échoue ne casse jamais la session.
  } finally {
    syncEnCours = false
  }
}

/** Délai du rafraîchissement automatique du panneau. */
const PERIODE_AUTO_MS = 5000

/**
 * Lance le rafraîchissement automatique (un tick toutes les 5 s) s'il ne tourne pas déjà. Ne lève jamais. Sur la page Paramètres, le tick
 * n'avance pas : un nouveau dessin remettrait les champs à leur valeur enregistrée (« la saisie remplace la valeur jusqu'au prochain
 * dessin », types de `Input.value`) et effacerait ce que la personne tape. ↻ et une écriture réussie relisent toujours.
 */
function demarrerAuto($: any, auto: Minuterie): void {
  auto.demarrer({ every: (ms, fn) => $.clock.every(ms, fn) }, () => {
    synchroniserAgents($).catch(() => undefined)
    read($, page)
      .then(p => (p === 'parametres' ? undefined : update($, tick, n => n + 1)))
      .catch(() => undefined)
  })
}

/** Dit en une ligne qu'une action du panneau n'a pas abouti. Ne lève jamais. */
function signalerEchec($: any): void {
  try {
    $.ui.toast("L'action n'a pas pu être faite : réessayez, ou appuyez sur Rafraîchir.")
  } catch {
    // Un toast qui échoue ne casse rien.
  }
}

/** Enveloppe un bouton : un échec (état, disque) est dit en une ligne et ne remonte jamais. */
function sur<A extends unknown[]>($: any, f: (...a: A) => Promise<void>): (...a: A) => Promise<void> {
  return async (...a) => {
    try {
      await f(...a)
    } catch {
      signalerEchec($)
    }
  }
}

/** Le thème de l'application d'après la ligne « theme » du menu de configuration ; sombre si rien ne se lit. */
async function themeDeLApplication($: any): Promise<Mode> {
  try {
    const lignes: { key: string; value: unknown }[] = await $.config.list()
    return modeDeTheme(lignes.find(l => l.key === 'theme')?.value) ?? 'sombre'
  } catch {
    return 'sombre'
  }
}

/** Ouvre le panneau ; faux s'il n'a pas pu s'ouvrir. Ne lève jamais. */
async function ouvrirPanneau($: any): Promise<boolean> {
  try {
    await $.ui.open({ id: PANE, title: 'Pilotage' })
    return true
  } catch {
    return false
  }
}

/**
 * Cherche le projet du dossier et applique le résultat ; rend le texte de réponse (jamais ne lève). `demande` : la personne a tapé /projet,
 * le panneau s'ouvre alors toujours (écran « Aucun projet ici » ou « Fichier de projet illisible » sans projet valide) ; au démarrage de
 * la session, il ne s'ouvre que sur un projet valide.
 */
async function activer($: any, dossier: string, auto: Minuterie, demande = false): Promise<{ ouvert: boolean; texte: string }> {
  try {
    const trouve = await trouverProjet(adapter($), dossier)
    if (!trouve) {
      await remettreAZero($, auto)
      await update($, erreursMarqueur, () => [])
      const ouvert = demande && (await ouvrirPanneau($))
      return {
        ouvert,
        texte: ouvert
          ? 'Aucun projet Pilotage ici : le panneau propose « Démarrer un projet » (/pilotage:demarrer).'
          : "Aucun projet Pilotage ici (pas de fichier .pilotage/projet.json dans ce dossier ni dans ses parents). Tapez /pilotage:demarrer pour en créer un.",
      }
    }
    if ('erreurs' in trouve) {
      await remettreAZero($, auto)
      await update($, erreursMarqueur, () => trouve.erreurs)
      const ouvert = demande && (await ouvrirPanneau($))
      return {
        ouvert,
        texte: ouvert
          ? `Le fichier de projet (.pilotage/projet.json) est invalide : le panneau dit quoi corriger (${trouve.erreurs.length} problème${trouve.erreurs.length > 1 ? 's' : ''}).`
          : [`Le fichier projet de ${trouve.racine} est invalide :`, ...trouve.erreurs.map(x => `- ${x}`)].join(String.fromCharCode(10)),
      }
    }
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
    const prenom = await lirePrenomConfig(home, async (p: string) => String((await $.fs.read(p)) ?? ''))
    await update($, erreursMarqueur, () => [])
    // Autre projet que celui déjà ouvert : les agents suivis ne sont plus les siens. Même projet (/projet relancé) : ils restent.
    const ancien = await read($, projetTrouve)
    if (ancien !== '' && ancien !== trouve.racine) {
      oublierTextesLus()
      await viderAgents($)
    }
    await update($, projetTrouve, () => trouve.racine)
    await update($, membre, () => membreCourant(trouve.projet, prenom) ?? '')
    await update($, actif, () => true)
    await $.ui.open({ id: PANE, title: 'Pilotage' })
    demarrerAuto($, auto)
    registre.reinitialiserEchecs() // chaque activation rend leurs essais aux agents que le moteur avait refusés
    await synchroniserAgents($)
    return { ouvert: true, texte: `Projet « ${trouve.projet.nom} » ouvert.` }
  } catch {
    // Un échec en cours de route (disque, état) ne laisse jamais un projet à moitié ouvert.
    try {
      await remettreAZero($, auto)
    } catch {
      // Rien de plus à faire.
    }
    return { ouvert: false, texte: "Pilotage n'a pas pu lire le projet de ce dossier." }
  }
}

/** Ce que lit la page Agents : appels en cours, pôle filtré, agent ouvert, et les états fusionnés avec les fiches de chantier. */
async function lireDonneesAgents($: any, lecture: LectureProjet, maintenant: number) {
  const live = await read($, agentsLive)
  return {
    live, filtre: await read($, filtrePole), ouvert: await read($, agentOuvert),
    etats: fusionnerEtats(lecture.projet?.agents ?? [], live, lecture.chantiers, maintenant),
    fichesAgents: lecture.fichesAgents, fichesSkills: lecture.fichesSkills,
  }
}

/** Icône du type de projet, d'après l'identifiant du preset (les libellés, eux, viennent du vocabulaire). */
const iconeType = (preset: string): NomIcone =>
  preset.includes('roblox') ? 'manette' : preset === 'site-web' ? 'globe' : preset === 'application' ? 'code' : 'fichier'

/** Dit en une ligne ce qui s'est passé après une modification des réglages. Ne lève jamais. */
function direReglage($: any, texte: string): void {
  try {
    $.ui.toast(texte)
  } catch {
    // Un toast qui échoue ne casse rien.
  }
}

/**
 * Applique une modification des réglages au projet : validation, copie .bak, contrôle que le fichier n'a pas changé, écriture
 * (voir model/ecriture-projet.ts). Succès : toast, les agents sont réenregistrés, le panneau se relit. Échec : les erreurs
 * s'affichent dans le panneau et rien n'a changé. `affiche` est le projet tel que le panneau l'a lu.
 */
const suiviEcritures = creerSuivi()
const TOAST_DESACTIVE = 'Désactivé : pris en compte au prochain démarrage de la session ; l’agent reste appelable d’ici là.'

async function appliquerPatch($: any, racine: string, affiche: Projet, patch: Patch, moi: string): Promise<void> {
  // Ni projet.json ni ses copies ne s'écrivent au travers d'un lien (contrôlé d'abord : rien n'est écrit, pas même la copie).
  const fichier = `${racine}/.pilotage/projet.json`
  const surs = await Promise.all([fichier, `${fichier}.bak`, `${fichier}.bak2`].map(p => ecritureSure(statLien($), racine, p)))
  const r = surs.every(Boolean)
    ? await ecrireProjet(
        { read: async p => String((await $.fs.read(p)) ?? ''), write: (p, t) => ecrireDansProjet($, racine, p, t) },
        racine, affiche, patch, { moi, suivi: suiviEcritures },
      )
    : { ok: false as const, erreurs: [MESSAGE_LIEN_PANNEAU] }
  await update($, erreursReglages, () => (r.ok ? [] : r.erreurs))
  direReglage($, !r.ok ? 'Modification refusée : voir le panneau.' : patch.type === 'agentActiver' && !patch.actif ? TOAST_DESACTIVE : 'Réglage enregistré.')
  if (r.ok) synchroniserAgents($).catch(() => undefined)
  await update($, tick, n => n + 1)
}

/** « Mon workflow » (~/.claude/pilotage/mon-workflow.json) : null s'il est absent, illisible ou vide. Ne lève jamais. */
async function lireMonWorkflow($: any): Promise<Workflow | null> {
  try {
    const home = String((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '')
    const chemin = cheminMonWorkflow(home)
    if (chemin === '' || (await $.fs.exists(chemin)) !== true) return null
    const w = parseMonWorkflow(String((await $.fs.read(chemin)) ?? ''))
    return w && w.outils.length > 0 ? w : null
  } catch {
    return null
  }
}

const CHARGER = 'Charger'

/** « Charger mon workflow » : la question montre la liste ; seule la réponse exacte « Charger » applique, tout le reste (refus, absence de $.ui.ask) vaut non. */
async function chargerMonWorkflow($: any, racine: string, affiche: Projet, moi: string, w: Workflow): Promise<void> {
  let accord = false
  try {
    accord = (await $.ui.ask(questionChargement(w.outils), [CHARGER, 'Garder'])) === CHARGER
  } catch {
    accord = false
  }
  if (!accord) return void direReglage($, 'Workflow du projet inchangé.')
  await appliquerPatch($, racine, affiche, { type: 'workflowRemplacer', outils: w.outils }, moi)
}

/** « Enregistrer comme mon workflow » : écrit ~/.claude/pilotage/mon-workflow.json, après confirmation s'il existe déjà. */
async function enregistrerMonWorkflow($: any, workflow: Workflow): Promise<void> {
  const home = String((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '')
  const r = await ecrireMonWorkflow(
    { exists: async p => (await $.fs.exists(p)) === true, write: async (p, t) => void (await $.fs.write(p, t)) },
    home, workflow,
    async () => (await $.ui.ask(questionEcrasement(workflow), ['Remplacer', 'Garder'])) === 'Remplacer',
  )
  await update($, erreursReglages, () => (r.ok ? [] : r.erreurs))
  direReglage($, r.ok ? 'Workflow enregistré pour vos prochains projets.' : 'Workflow non enregistré : voir le panneau.')
}

/** Copie le texte sur la surface donnée ; faux si rien n'a pu être copié. Ne lève jamais. */
const copier = async ($: any, texte: string, surface?: string): Promise<boolean> =>
  await $.ui
    .copy({ text: texte, ...(surface ? { surface } : {}) })
    .then((r: { isCopied: boolean }) => r.isCopied === true)
    .catch(() => false)

/** Copie un texte (chemin, nom de session) puis le dit en une ligne (« Copié » ou l'échec). Ne lève jamais. */
async function copierChemin($: any, texte: string, surface?: string): Promise<void> {
  const ok = await copier($, texte, surface)
  try {
    $.ui.toast(ok ? `Copié : ${texte}` : "La copie n'a pas pu se faire : sélectionnez le texte à la main.")
  } catch {
    // Un toast qui échoue ne casse rien.
  }
}

/**
 * Lance une commande /nom : par $.command.run (le moteur refuse qu'un prompt qui commence par « / » parte par
 * $.prompt.submit), sous son nom court puis sous son nom préfixé par le plugin. Faux si aucune des deux n'a marché.
 */
async function lancer($: any, texte: string): Promise<boolean> {
  const m = /^\/(\S+)\s*(.*)$/s.exec(texte.trim())
  if (!m) return false
  // Déjà préfixé (`/pilotage:demarrer`) : ce nom seul, jamais le nom court (une commande de même nom d'un autre plugin).
  for (const nom of m[1]!.includes(':') ? [m[1]!] : [m[1]!, `pilotage:${m[1]}`]) {
    if (await $.command.run({ command: nom, args: m[2] ?? '' }).then(() => true).catch(() => false)) return true
  }
  return false
}

/**
 * Envoie une commande dans la conversation ; sinon la prépare dans la zone de saisie ; sinon la copie ; sinon
 * l'affiche à taper. Ce qui s'est passé reste dans l'atome `retour` (vide quand tout est parti). Ne lève jamais.
 */
async function envoyer($: any, texte: string, surface?: string): Promise<void> {
  try {
    const parti = texte.startsWith('/') ? await lancer($, texte) : await $.prompt.submit({ text: texte }).then(() => true).catch(() => false)
    if (parti) return void (await update($, retour, () => ''))
    const rempli = await $.prompt.fill({ text: texte }).then((r: { isFilled: boolean }) => r.isFilled === true).catch(() => false)
    if (rempli) return void (await update($, retour, () => encoderRetour('rempli', texte)))
    const copie = await copier($, texte, surface)
    await update($, retour, () => encoderRetour(copie ? 'copie' : 'taper', texte))
  } catch {
    // L'état ne s'est pas mis à jour : le bouton reste utilisable.
  }
}

// ---- Suivi des agents en direct (fonctions de module : le moteur n'accepte `$` que dans les fonctions déclarées en haut du fichier) ----

// Une écriture au plus toutes les 2 s par chantier ; les mises à jour rapprochées sont fusionnées.
const ecrivain = creerEcrivain({ delai: 2000 })
purgerEcritures = () => ecrivain.oublier()

// Les écritures de l'atome `agentsLive` se font une par une (lecture puis écriture) : deux appels simultanés ne s'écrasent pas.
// Chaque étape a 2 s au plus : une étape qui ne répond jamais est abandonnée et la file continue. Il y a UNE file par instance du
// module (donc par session : le moteur charge le module une fois par session) ; elle est repartie de zéro à chaque `viderAgents`.
const DELAI_ETAPE_MS = 2000
let verrouLive: Promise<unknown> = Promise.resolve()
function enFile<T>(f: () => Promise<T>, minuteur: (ms: number, fn: () => void) => { cancel: () => void }): Promise<T> {
  const etape = (): Promise<T> =>
    new Promise<T>((ok, ko) => {
      let fini = false
      let t: { cancel: () => void } | null = null
      const terminer = (suite: () => void): void => {
        if (fini) return
        fini = true
        try {
          t?.cancel()
        } catch {
          // Minuteur déjà parti.
        }
        suite()
      }
      try {
        t = minuteur(DELAI_ETAPE_MS, () => terminer(() => ko(new Error('délai dépassé'))))
      } catch {
        t = null // sans minuteur, pas de délai : l'étape va jusqu'au bout
      }
      try {
        f().then(v => terminer(() => ok(v)), e => terminer(() => ko(e)))
      } catch (e) {
        terminer(() => ko(e))
      }
    })
  const p = verrouLive.then(etape, etape)
  verrouLive = p.then(() => undefined, () => undefined)
  return p
}
/** Applique `f` à l'état live ; rend l'état d'avant et celui d'après. */
function majLive($: any, f: (l: Live) => Live): Promise<{ avant: Live; apres: Live }> {
  return enFile(async () => {
    const avant = await read($, agentsLive)
    await update($, agentsLive, f)
    return { avant, apres: await read($, agentsLive) }
  }, (ms, fn) => $.clock.after(ms, fn))
}

const horloge = async ($: any): Promise<number> => {
  try {
    const n = Number(await $.clock.now())
    return Number.isFinite(n) ? n : Date.now()
  } catch {
    return Date.now()
  }
}

/** Les moyens d'écrire une fiche, bâtis sur `$` : disque, horloge, minuteur, et compte rendu dans `erreurEcriture`. */
function moyensEcriture($: any): Moyens {
  return {
    maintenant: () => horloge($),
    apres: (ms, fn) => $.clock.after(ms, fn),
    ecrire: async lot =>
      majFiche(
        {
          read: async p => String((await $.fs.read(p)) ?? ''),
          // Jamais au travers d'un lien (la fiche, son .bak ou un dossier au-dessus) ; un dossier lien n'est même pas listé.
          write: (p, t) => ecrireDansProjet($, lot.cible.racine, p, t),
          list: p => listeSansLiens($, p, []),
        },
        lot.cible, lot.maj, lot.agentsProjet, new Date(await horloge($)).toISOString(),
      ),
    surEtat: erreur => { update($, erreurEcriture, () => erreur).catch(() => undefined) },
  }
}

type ContexteAgents = { racine: string; moi: string; equipe: string[]; agents: string[] }
/** Projet ouvert, son équipe, ses agents et le membre courant ; null sans projet valide ou si rien ne se lit. Ne lève jamais. */
async function contexteAgents($: any): Promise<ContexteAgents | null> {
  try {
    if (!(await read($, actif))) return null
    const racine = await read($, projetTrouve)
    if (racine === '') return null
    const r = parseProjet(String((await $.fs.read(`${racine}/.pilotage/projet.json`)) ?? ''))
    if (!r.ok) return null
    return { racine, moi: await read($, membre), equipe: r.projet.equipe, agents: r.projet.agents.map(a => a.id) }
  } catch {
    return null
  }
}

/** Chantier de la session s'il est à ce membre (session liée par son sessions.json) ; null sinon : on n'écrit jamais chez l'associé. */
async function cibleDe($: any, ctx: ContexteAgents): Promise<Cible | null> {
  try {
    if (ctx.moi === '') return null
    const id = String((await $.session.id().catch(() => '')) ?? '')
    if (id === '') return null
    const lien = (await lireSessions(adapter($), ctx.racine, ctx.equipe)).get(id)
    return lien && memeMembre(lien.auteur, ctx.moi) ? { racine: ctx.racine, membre: ctx.moi, chantier: lien.chantier } : null
  } catch {
    return null
  }
}

/** Écriture limitée dans la fiche, sans attendre : l'outil n'est jamais retardé. Ne lève jamais. */
function ecrire($: any, ctx: ContexteAgents, cible: Cible | null, maj: MajFiche): void {
  if (!cible) return
  try {
    ecrivain.soumettre(`${cible.racine}|${cible.membre}|${cible.chantier}`, cible, maj, ctx.agents, moyensEcriture($)).catch(() => undefined)
  } catch {
    // Une écriture qui ne part pas n'arrête rien.
  }
}

/** Nom de ce plugin (préfixe de ses agents : `plugin:agent`) ; vide s'il ne se lit pas. */
function nomDuPlugin($: any): string {
  try {
    return String($.plugin.name ?? '')
  } catch {
    return ''
  }
}

type Suivi = { ctx: ContexteAgents; agent: string; cible: Cible | null }
/**
 * Début d'un appel d'agent du projet : atome, puis « en travail » dans la fiche. Null si l'appel n'est pas à suivre (pas
 * d'identifiant d'appel, pas de sous-type, agent hors projet) ou s'il rend la main alors que l'agent continue (`fond` : la fiche
 * dit « en travail » et vieillit toute seule en « prêt à reprendre » ; l'atome ne garde rien de faux).
 */
async function suivreDebut($: any, e: { subagent_type?: unknown; description?: unknown }, cle: string, fond: boolean): Promise<Suivi | null> {
  if (cle === '') return null
  const ctx = await contexteAgents($)
  if (!ctx) return null
  const agent = agentDeSousType(e?.subagent_type, ctx.agents.map(id => ({ id })), nomDuPlugin($))
  if (!agent) return null
  const quoi = String(e?.description ?? '')
  if (fond) {
    const cibleFond = await cibleDe($, ctx)
    ecrire($, ctx, cibleFond, { chantierEtat: 'en-travail', agents: [{ id: agent, etat: 'en-travail', quoi }] })
    return null
  }
  const maintenant = await horloge($)
  const { apres } = await majLive($, l => debutAppel(l, cle, agent, quoi, maintenant))
  const cible = await cibleDe($, ctx)
  const enAttente = attenteEnCours(apres, maintenant)
  ecrire($, ctx, cible, { chantierEtat: enAttente ? 'attente' : 'en-travail', agents: [{ id: agent, etat: 'en-travail', quoi }] })
  return { ctx, agent, cible }
}

/** Fin d'un appel : atome, puis « prêt » ou « bloqué » dans la fiche quand plus aucun appel du même agent ne dure. */
async function suivreFin($: any, s: Suivi, cle: string, issue: 'ok' | 'erreur'): Promise<void> {
  const maintenant = await horloge($)
  const { avant, apres } = await majLive($, l => finAppel(l, cle, maintenant, issue))
  if (!avant.appels.some(a => a.cle === cle)) return // suivi remis à zéro entre-temps (autre projet)
  const fin = apres.derniers.find(d => d.agent === s.agent)
  if (!fin) return // un autre appel de cet agent dure encore
  ecrire($, s.ctx, s.cible ?? (await cibleDe($, s.ctx)), { agents: [{ id: s.agent, etat: fin.etat, quoi: fin.quoi }] })
}

type SuiviQuestion = { ctx: ContexteAgents; cible: Cible | null }
/**
 * Fin d'un appel dont le début n'a pas rendu de suivi (étape expirée ou en échec, peut-être déjà appliquée) : l'appel est retiré
 * quand même (clé inconnue : rien ne change). Aucune écriture de fiche. Ne lève jamais.
 */
async function nettoyerAppel($: any, cle: string, issue: 'ok' | 'erreur'): Promise<void> {
  try {
    const maintenant = await horloge($)
    await majLive($, l => finAppel(l, cle, maintenant, issue))
  } catch {
    // Le suivi ne casse jamais rien.
  }
}

/** Idem pour une question dont le début n'a pas rendu de suivi. */
async function nettoyerQuestion($: any, cle: string): Promise<void> {
  try {
    await majLive($, l => finAttente(l, cle))
  } catch {
    // Le suivi ne casse jamais rien.
  }
}

/** Une question est posée à la personne : le chantier est « en attente » jusqu'à la réponse. */
async function questionDebut($: any, cle: string): Promise<SuiviQuestion | null> {
  if (cle === '') return null // sans identifiant d'appel on ne pourrait jamais clore l'attente : aucun signe inventé
  const ctx = await contexteAgents($)
  if (!ctx) return null
  const maintenant = await horloge($)
  await majLive($, l => debutAttente(l, cle, maintenant))
  const cible = await cibleDe($, ctx)
  ecrire($, ctx, cible, { chantierEtat: 'attente', agents: [] })
  return { ctx, cible }
}

/** La question a reçu sa réponse (ou a échoué) : le chantier reprend, s'il ne reste aucune autre question. */
async function questionFin($: any, s: SuiviQuestion, cle: string): Promise<void> {
  const maintenant = await horloge($)
  const { avant, apres } = await majLive($, l => finAttente(l, cle))
  if (avant.attentes.some(a => a.cle === cle) && !attenteEnCours(apres, maintenant)) ecrire($, s.ctx, s.cible, { chantierEtat: 'en-travail', agents: [] })
}

export const register: Register = on => {
  let dossierSession = ''
  const auto = creerMinuterie(PERIODE_AUTO_MS)
  // Lecture du projet et thème de l'application : gardés tant que `tick` ne change pas (le disque et le menu de
  // configuration ne sont pas relus à chaque dessin).
  let cacheLecture: { cle: string; valeur: LectureProjet; sessions: Map<string, LienSession> } | null = null
  let cacheTheme: { tick: number; mode: Mode } | null = null
  let cacheNotes: { cle: string; valeur: LectureNotes } | null = null
  let cacheConsigne: { cle: string; a: number; texte: string } | null = null
  // Identifiant de la session, lu une fois (il ne change pas pendant la session) ; null : pas encore lu, '' : inconnu.
  let idSessionLu: string | null = null

  on('session.start', async ($, e, next) => {
    try {
      // `/projet` : les noms de commande d'un mod ne sont pas préfixés, et l'ancien plugin enregistre déjà la commande « pilotage ».
      await $.command.register({
        name: COMMANDE_PANNEAU,
        description: 'Ouvre le panneau Pilotage du projet (chantiers, idées, suivi)',
      })
      dossierSession = e.cwd
      // Un dossier sans marqueur n'ouvre jamais rien ; un marqueur invalide non plus (les erreurs sont gardées).
      await activer($, e.cwd, auto)
    } catch {
      // Un hook ne doit jamais empêcher la session de démarrer.
    }
    return next(e)
  })

  on('command.run', { command: COMMANDE_PANNEAU }, async $ => {
    try {
      const dossier = (await $.session.cwd().catch(() => '')) || dossierSession
      return { text: (await activer($, dossier, auto, true)).texte }
    } catch {
      return { text: "Pilotage n'a pas pu lire le projet de ce dossier." }
    }
  })

  // La section « Projet Pilotage » (projet, membre, agents, workflow, règles, capture des idées, identifiant de session), seulement quand
  // un projet est ouvert. Elle est STABLE : rien de ce qui change en cours de travail (phase, tâches, états des chantiers) n'y entre, car
  // elle est dans le prompt système, avant toute la conversation, et un changement y ferait repayer tout le cache du prompt. Relue au
  // plus toutes les 20 s par projet et membre (une panne passagère n'est pas gardée) ; au moindre échec, le résultat du moteur est rendu tel quel.
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    try {
      if (!(await read($, actif))) return r
      const racine = await read($, projetTrouve)
      const moi = await read($, membre)
      const cle = `${racine}|${moi}`
      const maintenant = await horloge($)
      if (racine === '') return r
      if (cacheConsigne?.cle !== cle || maintenant - cacheConsigne.a > DUREE_CONSIGNE_MS) {
        if (idSessionLu === null) idSessionLu = String((await $.session.id().catch(() => '')) ?? '')
        const entree = entreeDepuisLecture(await lireProjetComplet(adapter($), racine, moi), moi, maintenant, nomDuPlugin($), idSessionLu)
        const texte = entree ? construireConsigne(entree) : ''
        cacheConsigne = texte === '' ? null : { cle, a: maintenant, texte }
      }
      if (!cacheConsigne) return r
      return { sections: [...r.sections, { id: 'pilotage:consigne', text: cacheConsigne.texte, scope: 'session' as const }] }
    } catch {
      return r
    }
  })

  // L'état volatil (phase, tâches ouvertes, chantiers en cours et leur état) part avec le message de l'utilisateur, en contexte du
  // message (jamais dans le prompt système) : seulement quand il a changé depuis le dernier envoyé, ou au plus tard toutes les 30 min.
  // `prompt.attachment` ne sert pas ici : il ne fait que réécrire les messages que le moteur injecte, il n'en ajoute pas.
  // Ne bloque ni ne retarde jamais un message : au moindre échec, il part tel quel.
  let dernierEtat: { cle: string; a: number; texte: string } | null = null
  on('prompt.submit', async ($, e, next) => {
    let texte = ''
    try {
      if (!e.isMeta && (await read($, actif))) {
        const racine = await read($, projetTrouve)
        const moi = await read($, membre)
        const maintenant = await horloge($)
        if (racine !== '') {
          const entree = entreeDepuisLecture(await lireProjetComplet(adapter($), racine, moi), moi, maintenant, nomDuPlugin($))
          const etat = entree ? construireEtat(entree) : ''
          const cle = `${racine}|${moi}`
          const neuf = dernierEtat?.cle !== cle || dernierEtat.texte !== etat || maintenant - dernierEtat.a > RAPPEL_ETAT_MS
          if (etat !== '' && neuf) {
            texte = etat
            dernierEtat = { cle, a: maintenant, texte: etat }
          }
        }
      }
    } catch {
      texte = ''
    }
    return next(texte === '' ? e : { ...e, context: [...(e.context ?? []), texte] })
  })

  // Panneau fermé (par la personne ou par un plugin) : plus de rafraîchissement automatique ; /projet le relance.
  on('ui.close', async ($, e, next) => {
    try {
      if (e.id === PANE) auto.arreter()
    } catch {
      // Un hook ne doit jamais lever.
    }
    return next(e)
  })

  // Un appel de l'outil Agent dure tant que l'agent travaille : début = « en travail », fin = « prêt » (ok) ou « bloqué » (erreur).
  // RÈGLE ABSOLUE : le suivi ne casse, ne retarde et ne modifie jamais un appel d'outil. Il se lance sans être attendu (début) ou
  // après le retour (fin, `void`), ne lève jamais, et le résultat de `next` est rendu tel quel. Seule une levée de `next` lui-même
  // (l'erreur du moteur) traverse le hook.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    let cle = ''
    let debut: Promise<Suivi | null> = Promise.resolve(null)
    let echec = false // le début a échoué ou expiré, peut-être après avoir écrit l'appel dans l'atome
    try {
      cle = cleDAppel(e)
      if (cle !== '') debut = suivreDebut($, e, cle, appelEnFond(e)).catch(() => { echec = true; return null })
    } catch {
      debut = Promise.resolve(null)
    }
    let issue: 'ok' | 'erreur' = 'erreur' // une levée de `next` (jamais de retour) compte comme une erreur
    try {
      const r = await next(e)
      try {
        issue = classerResultat(r)
      } catch {
        issue = 'ok'
      }
      return r
    } finally {
      try {
        void debut.then(suivi => (suivi ? suivreFin($, suivi, cle, issue) : echec ? nettoyerAppel($, cle, issue) : undefined)).catch(() => undefined)
      } catch {
        // Le suivi ne casse jamais l'outil.
      }
    }
  })

  // La session attend une réponse de la personne tant que l'appel de l'outil de question dure : seul signe fiable du moteur.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    let cle = ''
    let debut: Promise<SuiviQuestion | null> = Promise.resolve(null)
    let echec = false
    try {
      cle = cleDAppel(e)
      if (cle !== '') debut = questionDebut($, cle).catch(() => { echec = true; return null })
    } catch {
      debut = Promise.resolve(null)
    }
    try {
      return await next(e)
    } finally {
      try {
        void debut.then(suivi => (suivi ? questionFin($, suivi, cle) : echec ? nettoyerQuestion($, cle) : undefined)).catch(() => undefined)
      } catch {
        // Le suivi ne casse jamais l'outil.
      }
    }
  })

  // Le panneau : cadre centré, barre du haut, navigation et page courante. LIT seulement : jamais d'écriture disque.
  // Aucun projet : démarrage vide ; projet invalide : erreur de fichier ; erreur d'affichage : carte d'erreur.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    let c: Ctx | null = null
    try {
      const numero = await read($, tick) // abonne le dessin au bouton Rafraîchir et à la minuterie
      const choix = await read($, theme)
      let mode: Mode
      if (choix === 'clair' || choix === 'sombre') mode = choix
      else {
        // « systeme » : le thème de l'application, lu dans le menu de configuration ; sombre si rien ne se lit.
        if (cacheTheme?.tick !== numero) cacheTheme = { tick: numero, mode: await themeDeLApplication($) }
        mode = cacheTheme.mode
      }
      c = creerCtx(ui, jetons(mode), e.surface, e.props.bodyColumns)
      const ctx = c
      const copierLeChemin = (texte: string, surface?: string) => copierChemin($, texte, surface)
      const reessayer = sur($, async () => {
        const dossier = (await $.session.cwd().catch(() => '')) || dossierSession
        await activer($, dossier, auto)
        await update($, tick, n => n + 1)
      })
      const erreurs = (liste: string[]) => cadre(ctx, ecranErreur(ctx, { erreurs: liste, reessayer, copier: copierLeChemin }))
      const vide = async () =>
        cadre(ctx, ecranVide(ctx, {
          demarrer: surface => envoyer($, COMMANDE_DEMARRER, surface),
          retour: retourCommande(ctx, await read($, retour), t => copierCommande($, t)),
        }))

      if (!(await read($, actif))) {
        const invalides = await read($, erreursMarqueur)
        return invalides.length > 0 ? erreurs(invalides) : await vide()
      }
      const racine = await read($, projetTrouve)
      const moi = await read($, membre)
      const cle = `${numero}|${racine}|${moi}`
      if (cacheLecture?.cle !== cle) {
        const valeur = await lireProjetComplet(adapter($), racine, moi)
        cacheLecture = { cle, valeur, sessions: await lireSessions(adapter($), racine, valeur.projet?.equipe ?? []) }
      }
      const lecture = cacheLecture.valeur
      const maintenant = Date.now()
      // La session courante est-elle celle d'un chantier en cours ? (jamais d'erreur : sans id, pas de bandeau)
      const idSession = String((await $.session.id().catch(() => '')) ?? '')
      const chantierCourant = chantierDeSession(lecture.chantiers, cacheLecture.sessions, idSession)
      if (!lecture.projet) return lecture.erreurs.length > 0 ? erreurs(lecture.erreurs) : await vide()

      const courante = await read($, page)
      const ouverte = await read($, phaseOuverte)
      const detailOuvert = await read($, chantierOuvert)
      const donneesAgents = courante === 'agents' ? await lireDonneesAgents($, lecture, maintenant) : null
      const projet = lecture.projet
      // Les idées et retours ne se lisent que sur leur page (même cache que le projet : relus à chaque rafraîchissement).
      let notes: LectureNotes = { notes: [], erreurs: [] }
      if (courante === 'idees') {
        if (cacheNotes?.cle !== cle) cacheNotes = { cle, valeur: await lireNotes(adapter($), racine, lecture.projet.equipe) }
        notes = cacheNotes.valeur
      }
      const monWorkflow = courante === 'parametres' ? await lireMonWorkflow($) : null
      const aller = sur($, async (p: Page) => { await update($, erreursReglages, () => []); await update($, page, () => p) })
      const { Text } = ui
      const titre = PAGES.find(p => p.page === courante)?.titre ?? ''
      return cadre(ctx, [
        barreHaut(ctx, {
          type: libelle(lecture.projet, 'type'),
          icone: iconeType(lecture.projet.preset),
          nom: lecture.projet.nom,
          rafraichir: sur($, async () => { await update($, tick, n => n + 1) }),
          reglages: () => aller('parametres'),
        }),
        ...(chantierCourant ? [bandeauChantier(ctx, { chantier: chantierCourant, projet: lecture.projet, maintenant })] : []),
        navigation(ctx, courante, aller),
        <Text key="titre-page" weight="bold" size="title" color={ctx.j.texte}>{titre}</Text>,
        ...(courante === 'apercu'
          ? pageApercu(ctx, {
              projet: lecture.projet, taches: lecture.taches, moi, portes: lecture.portes,
              iconeType: iconeType(lecture.projet.preset), ouvrirPlan: () => aller('plan'),
              chantiers: lecture.chantiers, erreursChantiers: lecture.erreursChantiers, maintenant, copier: copierLeChemin,
            })
          : courante === 'plan'
            ? pagePlan(ctx, { projet: lecture.projet, taches: lecture.taches, moi, portes: lecture.portes, copier: copierLeChemin })
            : courante === 'phases'
              ? pagePhases(ctx, {
                  projet: lecture.projet, taches: lecture.taches, moi, portes: lecture.portes, ouverte, copier: copierLeChemin,
                  choisir: sur($, async (id: string) => { await update($, phaseOuverte, () => id) }),
                })
              : courante === 'chantiers'
                ? pageChantiers(ctx, {
                    projet: lecture.projet, chantiers: lecture.chantiers, erreursChantiers: lecture.erreursChantiers, maintenant,
                    copier: copierLeChemin, ouvert: detailOuvert,
                    basculer: sur($, async (cle: string) => { await update($, chantierOuvert, () => cle) }),
                  })
                : courante === 'agents' && donneesAgents
                  ? pageAgents(ctx, {
                      ...donneesAgents, projet: lecture.projet, maintenant, copier: copierLeChemin,
                      filtrer: sur($, async (id: string) => { await update($, filtrePole, () => id) }),
                      ouvrir: sur($, async (id: string) => { await update($, agentOuvert, () => id) }),
                    })
                  : courante === 'parametres'
                    ? pageParametres(ctx, {
                        projet, moi, theme: choix, erreurs: await read($, erreursReglages),
                        choisirTheme: sur($, async (t: ChoixTheme) => { await update($, theme, () => t) }),
                        modifier: sur($, (patch: Patch) => appliquerPatch($, racine, projet, patch, moi)),
                        monWorkflow, chargerWorkflow: sur($, async () => { if (monWorkflow) await chargerMonWorkflow($, racine, projet, moi, monWorkflow) }),
                        signaler: sur($, async (liste: string[]) => { await update($, erreursReglages, () => liste) }),
                        enregistrerWorkflow: sur($, () => enregistrerMonWorkflow($, projet.workflow)),
                      })
                  : pageIdees(ctx, {
                      projet: lecture.projet, racine, notes: notes.notes, erreursNotes: notes.erreurs, filtre: await read($, filtreIdees), copier: copierLeChemin,
                      filtrer: sur($, async (f: FiltreIdees) => { await update($, filtreIdees, () => f) }),
                    })),
      ])
    } catch {
      // Un dessin ne doit jamais faire tomber le panneau : on le dit, et Rafraîchir réessaie.
      try {
        const repli = c ?? creerCtx(ui, jetons('sombre'), e.surface, e.props.bodyColumns)
        return cadre(repli, carteErreurRendu(repli))
      } catch {
        const { Text } = ui
        return <Text>Le panneau n'a pas pu s'afficher.</Text>
      }
    }
  })
}

/** « Copier la commande » : réessaie la copie ; si elle échoue, la commande reste affichée à sélectionner. */
async function copierCommande($: any, texte: string): Promise<void> {
  const ok = await copier($, texte)
  await update($, retour, () => encoderRetour(ok ? 'copie' : 'copie-echec', texte))
}
