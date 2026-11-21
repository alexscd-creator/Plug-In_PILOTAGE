// Modifications du projet depuis l'écran Paramètres. Deux parties :
//  - `modifierProjet` (PURE) : applique un `Patch` typé à une copie du projet puis fait tout revalider par parseProjet (plafonds, identifiants,
//    teintes uniques...). Seul le champ visé change ; le thème n'est pas un champ du projet (c'est un atome du panneau) ;
//  - `ecrireProjet` / `ecrireMonWorkflow` : écritures gardées. `$.fs` n'offre ni renommage ni suppression : pas de remplacement atomique.
//    Fenêtre non atomique assumée : si l'écriture finale échoue en route, `projet.json` peut être tronqué ; sa version d'avant est alors
//    dans `projet.json.bak` (écrite AVANT, et le message l'indique). Jamais d'écriture ailleurs que `.pilotage/projet.json(.bak)` et
//    `~/.claude/pilotage/mon-workflow.json`. Rien ne lève : tout échec est un résultat `{ ok: false, erreurs }`.
import { parseMonWorkflow } from './presets.ts'
import { parseProjet, serializeProjet, TEINTES_POLE } from './projet.ts'
import type { Projet, ResultatProjet, Workflow } from './projet.ts'

export type Patch =
  | { type: 'reglage'; id: string; valeur: string | boolean }
  | { type: 'workflowAjouter'; role: string; outil: string }
  | { type: 'workflowRetirer'; index: number }
  | { type: 'workflowModifier'; index: number; role: string; outil: string }
  | { type: 'agentActiver'; id: string; actif: boolean }
  | { type: 'agentRole'; id: string; titre: string; pourquoi: string }
  | { type: 'agentSkills'; id: string; skills: string[] }
  | { type: 'poleRenommer'; id: string; titre: string }
  | { type: 'poleCouleur'; id: string; couleur: string }
  | { type: 'poleAjouter'; id: string; titre: string; couleur?: string }
  | { type: 'poleRetirer'; id: string }

export type Retour = { ok: true } | { ok: false; erreurs: string[] }
const echec = (...erreurs: string[]): { ok: false; erreurs: string[] } => ({ ok: false, erreurs })
const ID_POLE = /^[a-z0-9-]+$/
const MAX_ID = 60

/** Applique le patch à une copie puis revalide le résultat entier : aucune règle n'est dupliquée ici. */
export function modifierProjet(projet: Projet, patch: Patch): ResultatProjet {
  let n: Projet
  try {
    n = structuredClone(projet)
  } catch {
    return echec('Le projet est illisible : rien ne change.')
  }
  const erreur = appliquer(n, patch)
  if (erreur) return echec(erreur)
  return parseProjet(serializeProjet(n))
}

const indexValide = (i: unknown, longueur: number): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < longueur

/** Modifie `n` sur place ; rend une phrase d'erreur, ou null si le patch s'applique (la validation complète suit). */
function appliquer(n: Projet, patch: Patch): string | null {
  switch (patch?.type) {
    case 'reglage': {
      const def = n.reglagesDef.find(d => d.id === patch.id)
      if (!def) return `Réglage « ${String(patch.id).slice(0, 30)} » : inconnu pour ce type de projet.`
      n.reglages[def.id] = patch.valeur
      return null
    }
    case 'workflowAjouter':
      n.workflow.outils.push({ role: patch.role, outil: patch.outil })
      return null
    case 'workflowRetirer':
      if (!indexValide(patch.index, n.workflow.outils.length)) return "Cet outil n'existe pas dans le workflow."
      if (n.workflow.outils.length === 1) return 'Le workflow ne peut pas rester vide : gardez au moins un outil.'
      n.workflow.outils.splice(patch.index, 1)
      return null
    case 'workflowModifier':
      if (!indexValide(patch.index, n.workflow.outils.length)) return "Cet outil n'existe pas dans le workflow."
      n.workflow.outils[patch.index] = { role: patch.role, outil: patch.outil }
      return null
    case 'agentActiver': {
      const a = n.agents.find(x => x.id === patch.id)
      if (!a) return `L'agent « ${String(patch.id).slice(0, 30)} » n'existe pas.`
      if (typeof patch.actif !== 'boolean') return 'Actif doit être vrai ou faux.'
      if (patch.actif) delete a.actif
      else a.actif = false
      return null
    }
    case 'agentRole': {
      const a = n.agents.find(x => x.id === patch.id)
      if (!a) return `L'agent « ${String(patch.id).slice(0, 30)} » n'existe pas.`
      a.titre = patch.titre
      a.pourquoi = patch.pourquoi
      return null
    }
    case 'agentSkills': {
      const a = n.agents.find(x => x.id === patch.id)
      if (!a) return `L'agent « ${String(patch.id).slice(0, 30)} » n'existe pas.`
      if (!Array.isArray(patch.skills)) return 'Les skills doivent former une liste.'
      a.skills = [...patch.skills]
      return null
    }
    case 'poleRenommer': {
      const p = n.poles.find(x => x.id === patch.id)
      if (!p) return `Le pôle « ${String(patch.id).slice(0, 30)} » n'existe pas.`
      p.titre = patch.titre
      return null
    }
    case 'poleCouleur': {
      const p = n.poles.find(x => x.id === patch.id)
      if (!p) return `Le pôle « ${String(patch.id).slice(0, 30)} » n'existe pas.`
      p.couleur = patch.couleur
      return null
    }
    case 'poleAjouter': {
      if (typeof patch.id !== 'string' || patch.id.length > MAX_ID || !ID_POLE.test(patch.id)) return "L'identifiant du pôle doit s'écrire en minuscules, chiffres et tirets seulement."
      const libre = TEINTES_POLE.find(t => !n.poles.some(p => p.couleur === t))
      const couleur = patch.couleur ?? libre
      n.poles.push({ id: patch.id, titre: patch.titre, ...(couleur ? { couleur } : {}) })
      return null
    }
    case 'poleRetirer': {
      if (!n.poles.some(p => p.id === patch.id)) return `Le pôle « ${String(patch.id).slice(0, 30)} » n'existe pas.`
      const utilisateurs = n.agents.filter(a => a.pole === patch.id)
      if (utilisateurs.length > 0) return `Ce pôle est utilisé par ${utilisateurs.map(a => a.titre).join(', ')} : changez d'abord le pôle de cet agent, ou gardez le pôle (agent concerné).`
      n.poles = n.poles.filter(p => p.id !== patch.id)
      return null
    }
    default:
      return 'Modification inconnue : rien ne change.'
  }
}

// ---- Écritures gardées ----

export type FsProjet = { read(p: string): Promise<string>; write(p: string, texte: string): Promise<void> }
const BS = String.fromCharCode(92)
const normaliser = (p: string): string => p.replaceAll(BS, '/').replace(/\/+/g, '/').replace(/\/$/, '')

/**
 * Applique le patch au `projet.json` du disque et l'écrit. `affiche` : le projet tel que le panneau l'a lu ; si le fichier du disque est
 * devenu différent (un associé, Git...), refus et rien n'est écrit. Ordre : relecture, contrôle, validation, copie `.bak` de l'ancien
 * texte, relecture juste avant d'écrire (contrôle encore), écriture de `serializeProjet(résultat)`. Un patch sans effet n'écrit rien.
 */
export async function ecrireProjet(fs: FsProjet, racine: string, affiche: Projet, patch: Patch): Promise<Retour> {
  try {
    if (typeof racine !== 'string' || normaliser(racine).trim() === '') return echec("Aucun dossier de projet n'est indiqué : rien n'est écrit.")
    const chemin = `${normaliser(racine)}/.pilotage/projet.json`
    const change = echec('Le fichier projet a changé sur le disque depuis son affichage (un associé ou Git l\'a modifié) : rafraîchissez, puis recommencez. Rien n\'est écrit.')
    let texte: string
    try {
      texte = await fs.read(chemin)
    } catch {
      return echec("Le fichier projet n'a pas pu être relu : rien n'est écrit.")
    }
    const lu = parseProjet(texte)
    if (!lu.ok) return echec(`Le fichier projet du disque est invalide (${lu.erreurs[0] ?? 'illisible'}) : rien n'est écrit.`)
    if (serializeProjet(lu.projet) !== serializeProjet(affiche)) return change
    const r = modifierProjet(lu.projet, patch)
    if (!r.ok) return echec(...r.erreurs)
    const sortie = serializeProjet(r.projet)
    if (sortie === serializeProjet(lu.projet)) return { ok: true }
    try {
      await fs.write(`${chemin}.bak`, texte) // la copie d'abord : si elle échoue, le fichier n'est pas touché
    } catch {
      return echec("La copie de sauvegarde (projet.json.bak) n'a pas pu être écrite : le fichier projet n'est pas touché.")
    }
    let juste: string
    try {
      juste = await fs.read(chemin)
    } catch {
      return echec("Le fichier projet n'a pas pu être relu avant l'écriture : rien n'est écrit.")
    }
    if (juste !== texte) return change
    try {
      await fs.write(chemin, sortie)
    } catch {
      return echec("L'écriture du fichier projet a échoué. Son contenu d'avant est gardé dans .pilotage/projet.json.bak : vérifiez le fichier avant de continuer.")
    }
    return { ok: true }
  } catch {
    return echec("L'enregistrement a échoué : rien n'a été changé.")
  }
}

export type FsMonWorkflow = { exists(p: string): Promise<boolean>; write(p: string, texte: string): Promise<void> }

/** Le texte exact de `~/.claude/pilotage/mon-workflow.json` pour ce workflow (montré avant l'écriture, puis écrit tel quel). */
export const texteMonWorkflow = (w: Workflow): string => JSON.stringify({ outils: w.outils.map(o => ({ role: o.role, outil: o.outil })) }, null, 2) + '\n'

/** Chemin de `mon-workflow.json` ; vide si le dossier personnel est inconnu. */
export const cheminMonWorkflow = (home: string): string => (typeof home === 'string' && normaliser(home) !== '' ? `${normaliser(home)}/.claude/pilotage/mon-workflow.json` : '')

/** Écrit le workflow comme « mon workflow ». S'il existe déjà, `confirmer()` doit répondre vrai : jamais d'écrasement silencieux. */
export async function ecrireMonWorkflow(fs: FsMonWorkflow, home: string, w: Workflow, confirmer: () => Promise<boolean>): Promise<Retour> {
  try {
    const chemin = cheminMonWorkflow(home)
    if (chemin === '') return echec('Le dossier personnel est introuvable : rien n\'est écrit.')
    if (!Array.isArray(w?.outils) || w.outils.length === 0) return echec('Le workflow est vide : rien n\'est écrit.')
    const texte = texteMonWorkflow(w)
    if (!parseMonWorkflow(texte)) return echec('Le workflow ne se relirait pas : rien n\'est écrit.')
    if (await fs.exists(chemin)) {
      let accord = false
      try {
        accord = (await confirmer()) === true
      } catch {
        accord = false
      }
      if (!accord) return echec('Remplacement annulé : votre workflow enregistré reste tel quel.')
    }
    try {
      await fs.write(chemin, texte)
    } catch {
      return echec("Le workflow n'a pas pu être enregistré.")
    }
    return { ok: true }
  } catch {
    return echec("Le workflow n'a pas pu être enregistré.")
  }
}
