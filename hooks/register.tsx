import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { lirePrenomConfig, membreCourant, trouverProjet } from './model/activation.ts'
import type { FsLike } from './model/activation.ts'

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

const adapter = ($: any): FsLike => ({
  read: async p => String((await $.fs.read(p)) ?? ''),
  list: async p => ((await $.fs.list(p)) as { name: string }[]).map(x => x.name),
})

/** Plus de projet valide ici : le plugin redevient inactif. */
async function remettreAZero($: any): Promise<void> {
  await update($, actif, () => false)
  await update($, projetTrouve, () => '')
  await update($, membre, () => '')
}

/** Cherche le projet du dossier et applique le résultat ; rend le texte de réponse (jamais ne lève). */
async function activer($: any, dossier: string): Promise<{ ouvert: boolean; texte: string }> {
  try {
    const trouve = await trouverProjet(adapter($), dossier)
    if (!trouve) {
      await remettreAZero($)
      await update($, erreursMarqueur, () => [])
      return {
        ouvert: false,
        texte: "Aucun projet Pilotage ici (pas de fichier .pilotage/projet.json dans ce dossier ni dans ses parents). Tapez /demarrer pour en créer un.",
      }
    }
    if ('erreurs' in trouve) {
      await remettreAZero($)
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
    return { ouvert: true, texte: `Projet « ${trouve.projet.nom} » ouvert.` }
  } catch {
    return { ouvert: false, texte: "Pilotage n'a pas pu lire le projet de ce dossier." }
  }
}

export const register: Register = on => {
  let dossierSession = ''

  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'pilotage',
        description: 'Ouvre le panneau Pilotage (chantiers, idées, suivi)',
      })
      dossierSession = e.cwd
      // Un dossier sans marqueur n'ouvre jamais rien ; un marqueur invalide non plus (les erreurs sont gardées).
      await activer($, e.cwd)
    } catch {
      // Un hook ne doit jamais empêcher la session de démarrer.
    }
    return next(e)
  })

  on('command.run', { command: 'pilotage' }, async $ => {
    try {
      const dossier = (await $.session.cwd().catch(() => '')) || dossierSession
      return { text: (await activer($, dossier)).texte }
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
}
