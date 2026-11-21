import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ChoixTheme, Page } from '../types'
import { lirePrenomConfig, membreCourant, trouverProjet } from './model/activation.ts'
import type { FsLike } from './model/activation.ts'
import { chantierDeSession } from './model/chantiers.ts'
import { lireProjetComplet, lireSessions } from './model/lecture.ts'
import type { LienSession } from './model/lecture.ts'
import { creerMinuterie } from './model/minuterie.ts'
import type { Minuterie } from './model/minuterie.ts'
import type { LectureProjet } from './model/lecture.ts'
import { libelle } from './model/presets.ts'
import { encoderRetour } from './model/retour-commande.ts'
import { pageApercu } from './ui/apercu'
import { pageAvenir } from './ui/avenir'
import { bandeauChantier } from './ui/bandeau'
import { pageChantiers } from './ui/chantiers'
import { cadre, creerCtx } from './ui/kit'
import type { Ctx } from './ui/kit'
import { barreHaut, navigation, PAGES } from './ui/nav'
import type { NomIcone } from './ui/icones'
import { pagePhases } from './ui/phases'
import { pagePlan } from './ui/plan'
import { jetons, modeDeTheme } from './ui/theme'
import type { Mode } from './ui/theme'
import { carteErreurRendu, COMMANDE_DEMARRER, ecranErreur, ecranVide, retourCommande } from './ui/vide'

const PANE = 'pilotage'

// Vrai quand un projet valide est ouvert dans cette session : rien ne s'injecte tant qu'il est faux.
const actif = atom({ plugin: 'pilotage', key: 'actif' } as const, false, { shape: 'actif-1' })
// Dossier racine du projet trouvé (là où vit .pilotage/), vide sans projet.
const projetTrouve = atom({ plugin: 'pilotage', key: 'projetTrouve' } as const, '', { shape: 'projet-1' })
// Membre courant d'après ~/.claude/pilotage/config.json ; vide si inconnu (le panneau invitera à se choisir).
const membre = atom({ plugin: 'pilotage', key: 'membre' } as const, '', { shape: 'membre-1' })
// Erreurs d'un marqueur invalide, rappelées à /pilotage.
const erreursMarqueur = atom({ plugin: 'pilotage', key: 'erreursMarqueur' } as const, [] as string[], {
  shape: 'erreurs-1',
})
// Page affichée dans le panneau (état de session).
const page = atom({ plugin: 'pilotage', key: 'page' } as const, 'apercu' as Page, { shape: 'page-1' })
// Phase ouverte dans la page Phases ('' : la phase en cours).
const phaseOuverte = atom({ plugin: 'pilotage', key: 'phaseOuverte' } as const, '', { shape: 'phase-ouverte-1' })
// Chantier dont le détail est ouvert dans la page Chantiers ('' : aucun).
const chantierOuvert = atom({ plugin: 'pilotage', key: 'chantierOuvert' } as const, '', { shape: 'chantier-ouvert-1' })
// Compteur : un changement force une nouvelle lecture des fichiers (bouton Rafraîchir).
const tick = atom({ plugin: 'pilotage', key: 'tick' } as const, 0, { shape: 'tick-1' })
// Thème du panneau : le mod ne peut pas lire le mode de l'application, « systeme » prend donc le sombre.
const theme = atom({ plugin: 'pilotage', key: 'theme' } as const, 'systeme' as ChoixTheme, { shape: 'theme-1' })
// Ce qui s'est passé quand un bouton a voulu envoyer une commande (voir model/retour-commande.ts) ; vide : tout est parti.
const retour = atom({ plugin: 'pilotage', key: 'retourCommande' } as const, '', { shape: 'retour-1' })

const adapter = ($: any): FsLike => ({
  read: async p => String((await $.fs.read(p)) ?? ''),
  list: async p => ((await $.fs.list(p)) as { name: string }[]).map(x => x.name),
})

/** Plus de projet valide ici : le plugin redevient inactif. */
async function remettreAZero($: any, auto?: Minuterie): Promise<void> {
  auto?.arreter()
  await update($, actif, () => false)
  await update($, projetTrouve, () => '')
  await update($, membre, () => '')
}

/** Délai du rafraîchissement automatique du panneau. */
const PERIODE_AUTO_MS = 5000

/** Lance le rafraîchissement automatique (un tick toutes les 5 s) s'il ne tourne pas déjà. Ne lève jamais. */
function demarrerAuto($: any, auto: Minuterie): void {
  auto.demarrer({ every: (ms, fn) => $.clock.every(ms, fn) }, () => {
    update($, tick, n => n + 1).catch(() => undefined)
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

/** Cherche le projet du dossier et applique le résultat ; rend le texte de réponse (jamais ne lève). */
async function activer($: any, dossier: string, auto: Minuterie): Promise<{ ouvert: boolean; texte: string }> {
  try {
    const trouve = await trouverProjet(adapter($), dossier)
    if (!trouve) {
      await remettreAZero($, auto)
      await update($, erreursMarqueur, () => [])
      return {
        ouvert: false,
        texte: "Aucun projet Pilotage ici (pas de fichier .pilotage/projet.json dans ce dossier ni dans ses parents). Tapez /demarrer pour en créer un.",
      }
    }
    if ('erreurs' in trouve) {
      await remettreAZero($, auto)
      await update($, erreursMarqueur, () => trouve.erreurs)
      return {
        ouvert: false,
        texte: [`Le fichier projet de ${trouve.racine} est invalide :`, ...trouve.erreurs.map(x => `- ${x}`)].join(String.fromCharCode(10)),
      }
    }
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
    const prenom = await lirePrenomConfig(home, async (p: string) => String((await $.fs.read(p)) ?? ''))
    await update($, erreursMarqueur, () => [])
    await update($, projetTrouve, () => trouve.racine)
    await update($, membre, () => membreCourant(trouve.projet, prenom) ?? '')
    await update($, actif, () => true)
    await $.ui.open({ id: PANE, title: 'Pilotage' })
    demarrerAuto($, auto)
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

/** Icône du type de projet, d'après l'identifiant du preset (les libellés, eux, viennent du vocabulaire). */
const iconeType = (preset: string): NomIcone =>
  preset.includes('roblox') ? 'manette' : preset === 'site-web' ? 'globe' : preset === 'application' ? 'code' : 'fichier'

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
  for (const nom of [m[1]!, `pilotage:${m[1]}`]) {
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

export const register: Register = on => {
  let dossierSession = ''
  const auto = creerMinuterie(PERIODE_AUTO_MS)
  // Lecture du projet et thème de l'application : gardés tant que `tick` ne change pas (le disque et le menu de
  // configuration ne sont pas relus à chaque dessin).
  let cacheLecture: { cle: string; valeur: LectureProjet; sessions: Map<string, LienSession> } | null = null
  let cacheTheme: { tick: number; mode: Mode } | null = null

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'pilotage',
        description: 'Ouvre le panneau Pilotage (chantiers, idées, suivi)',
      })
      dossierSession = e.cwd
      // Un dossier sans marqueur n'ouvre jamais rien ; un marqueur invalide non plus (les erreurs sont gardées).
      await activer($, e.cwd, auto)
    } catch {
      // Un hook ne doit jamais empêcher la session de démarrer.
    }
    return next(e)
  })

  on('command.run', { command: 'pilotage' }, async $ => {
    try {
      const dossier = (await $.session.cwd().catch(() => '')) || dossierSession
      return { text: (await activer($, dossier, auto)).texte }
    } catch {
      return { text: "Pilotage n'a pas pu lire le projet de ce dossier." }
    }
  })

  // Plus tard, une tâche ajoutera la consigne quand `actif` est vrai ; pour l'instant rien n'est injecté.
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    try {
      if (!(await read($, actif))) return r
    } catch {
      return r
    }
    return r
  })

  // Panneau fermé (par la personne ou par un plugin) : plus de rafraîchissement automatique ; /pilotage le relance.
  on('ui.close', async ($, e, next) => {
    try {
      if (e.id === PANE) auto.arreter()
    } catch {
      // Un hook ne doit jamais lever.
    }
    return next(e)
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
      const aller = sur($, async (p: Page) => { await update($, page, () => p) })
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
                // Les autres pages (Agents, Idées, Paramètres) sont des cartes « Bientôt ».
                : pageAvenir(ctx, courante, { projet: lecture.projet, copier: copierLeChemin })),
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
