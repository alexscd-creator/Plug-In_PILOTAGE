// Écriture de l'état des agents dans la fiche d'un chantier, côté hooks. Mêmes garanties que scripts/pilotage-chantier.mjs (action `maj`) :
//  - on n'écrit que dans le dossier du membre courant (`.pilotage/equipe/<son dossier>/chantiers/<id>.md`), sur une fiche qui existe déjà ;
//  - la fiche est relue, modifiée, validée (validerChantier) et son texte réécrit est relu avant tout octet écrit ;
//  - jamais l'état `termine` (seul l'archivage termine un chantier), jamais un chantier archivé, 20 agents au plus, agents du projet seulement ;
//  - `maj` = maintenant.
// Différence assumée : `$.fs` n'offre ni renommage ni suppression ; il n'y a donc pas de remplacement atomique. La version précédente est
// gardée à côté (`<id>.md.bak`, jamais lue par le panneau) AVANT d'écrire la fiche ; si cette copie échoue, la fiche n'est pas touchée.
// Rien ne lève : tout échec est rendu comme un résultat `{ ok: false, erreur }`. Logique pure : le disque arrive par FsEcriture.
import { parseChantier, serializeChantier, validerChantier } from './chantier.ts'
import type { Chantier, EtatChantier } from './chantier.ts'
import { estCopieDeConflit } from './plan.ts'
import { memeMembre } from './projet.ts'

export type FsEcriture = {
  read(p: string): Promise<string>
  write(p: string, texte: string): Promise<void>
  list(p: string): Promise<string[]>
}
/** Où écrire : racine du projet, membre courant (prénom du projet) et identifiant du chantier. */
export type Cible = { racine: string; membre: string; chantier: string }
/** Ce qu'on veut changer : l'état du chantier (facultatif) et l'état d'agents du projet. */
export type MajFiche = { chantierEtat?: EtatChantier; agents: { id: string; etat: EtatChantier; quoi: string }[] }
export type Resultat = { ok: true } | { ok: false; erreur: string }

const ID_RE = /^[a-z0-9-]+$/
const MAX_ID = 60
const MAX_AGENTS = 20
const BS = String.fromCharCode(92)
const refus = (erreur: string): Resultat => ({ ok: false, erreur })
const normaliser = (p: string): string => p.replaceAll(BS, '/').replace(/\/+/g, '/').replace(/\/$/, '')
const idSur = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= MAX_ID && ID_RE.test(s)
/** Nom de dossier sans séparateur, sans `..`, sans lecteur : il ne peut désigner qu'un enfant direct. */
const nomSur = (n: string): boolean => n !== '' && n !== '.' && n !== '..' && !/[\\/:\0]/.test(n)
const premiereLigne = (e: unknown): string => (e instanceof Error ? e.message.split('\n')[0]! : 'erreur inconnue')

export async function majFiche(fs: FsEcriture, cible: Cible, maj: MajFiche, agentsProjet: string[], maintenantIso: string): Promise<Resultat> {
  try {
    if (!cible || typeof cible.racine !== 'string' || normaliser(cible.racine) === '') return refus('Aucun dossier de projet n’est indiqué.')
    if (!idSur(cible.chantier)) return refus('L’identifiant du chantier est invalide : rien n’est écrit.')
    if (typeof cible.membre !== 'string' || cible.membre.trim() === '') return refus('Aucun membre courant : rien n’est écrit.')
    if (!maj || !Array.isArray(maj.agents) || !Array.isArray(agentsProjet)) return refus('Mise à jour illisible : rien n’est écrit.')
    if (maj.chantierEtat === undefined && maj.agents.length === 0) return refus('Rien à mettre à jour.')
    if (maj.chantierEtat === 'termine' || maj.agents.some(a => a?.etat === 'termine')) {
      return refus('L’état « termine » ne se pose que par l’archivage : rien n’est écrit.')
    }
    for (const a of maj.agents) if (!idSur(a?.id) || !agentsProjet.includes(a.id)) return refus('Un agent n’existe pas dans le projet : rien n’est écrit.')

    const equipe = `${normaliser(cible.racine)}/.pilotage/equipe`
    const dossiers = await fs.list(equipe)
    const dossier = [...dossiers].sort().find(d => nomSur(d) && !estCopieDeConflit(d) && memeMembre(cible.membre, d))
    if (dossier === undefined) return refus('Le dossier du membre est introuvable : on n’écrit que chez soi, rien n’est écrit.')
    const chemin = `${equipe}/${dossier}/chantiers/${cible.chantier}.md`
    const avant = await fs.read(chemin)

    const lue = parseChantier(avant, cible.membre)
    if (!lue.ok) return refus(`La fiche n’a pas pu être relue : ${lue.erreurs[0] ?? 'illisible'} Rien n’est écrit.`)
    const c: Chantier = lue.chantier
    if (c.archive) return refus('Le chantier est archivé : il ne se modifie plus.')
    if (c.id !== cible.chantier) return refus('L’identifiant de la fiche ne correspond pas : rien n’est écrit.')
    if (c.etat === 'termine') return refus('Le chantier est terminé : il ne se modifie plus.')

    if (maj.chantierEtat !== undefined) c.etat = maj.chantierEtat
    for (const a of maj.agents) {
      const actuel = c.agents.find(x => x.id === a.id)
      if (actuel) Object.assign(actuel, { etat: a.etat, quoi: a.quoi })
      else if (c.agents.length >= MAX_AGENTS) return refus(`${MAX_AGENTS} agents au plus par chantier : rien n’est écrit.`)
      else c.agents.push({ id: a.id, etat: a.etat, quoi: a.quoi })
    }
    c.maj = maintenantIso
    const invalides = validerChantier(c)
    if (invalides.length > 0) return refus(`La fiche mise à jour serait invalide : ${invalides[0]} Rien n’est écrit.`)
    const sortie = serializeChantier(c)
    const relue = parseChantier(sortie, cible.membre)
    if (!relue.ok) return refus(`La fiche mise à jour ne se relirait pas : ${relue.erreurs[0] ?? 'illisible'} Rien n’est écrit.`)

    await fs.write(`${chemin}.bak`, avant)
    await fs.write(chemin, sortie)
    return { ok: true }
  } catch (e) {
    return refus(`L’écriture de la fiche a échoué (${premiereLigne(e)}).`)
  }
}

// ---- Écrivain limité : au plus une écriture par chantier et par `delai`, les mises à jour rapprochées sont fusionnées ----
// Les moyens d'écrire (horloge, minuteur, disque) arrivent avec chaque mise à jour (`Moyens`, bâtis sur `$` par l'appelant) :
// c'est la dernière mise à jour d'un chantier qui fournit les moyens de son écriture différée.

type Lot = { cible: Cible; maj: MajFiche; agentsProjet: string[] }
type Minuteur = { cancel: () => void }
export type Moyens = {
  maintenant: () => Promise<number>
  apres: (ms: number, fn: () => void) => Minuteur
  ecrire: (lot: Lot) => Promise<Resultat>
  /** Dit où en est la dernière écriture : '' si elle a réussi, sinon l'erreur en une ligne. */
  surEtat: (erreur: string) => void
}
type EtatCle = { occupe: boolean; dernier: number | null; lot: Lot | null; minuteur: Minuteur | null; moyens: Moyens | null }

export function creerEcrivain(o: { /** Délai minimal entre deux écritures d'un même chantier (ms). */ delai: number }) {
  const cles = new Map<string, EtatCle>()
  const enCours = new Set<Promise<unknown>>()
  const etat = (cle: string): EtatCle => {
    let e = cles.get(cle)
    if (!e) cles.set(cle, (e = { occupe: false, dernier: null, lot: null, minuteur: null, moyens: null }))
    return e
  }
  const suivre = <T,>(p: Promise<T>): Promise<T> => {
    enCours.add(p)
    const retire = (): void => void enCours.delete(p)
    p.then(retire, retire)
    return p
  }

  async function declencher(cle: string): Promise<void> {
    const e = etat(cle)
    if (e.occupe) return
    e.occupe = true
    let relance = false
    const signaler = (erreur: string): void => {
      try {
        e.moyens?.surEtat(erreur)
      } catch {
        // Un compte rendu qui échoue ne casse rien.
      }
    }
    try {
      if (e.lot === null || e.moyens === null) return
      const maintenant = await e.moyens.maintenant()
      const reste = e.dernier === null ? 0 : e.dernier + o.delai - maintenant
      if (reste > 0) {
        try {
          e.minuteur = e.moyens.apres(reste, () => {
            e.minuteur = null
            e.occupe = false
            suivre(declencher(cle)).catch(() => undefined)
          })
          return
        } catch {
          // Sans minuteur, la mise à jour part tout de suite plutôt que d'être perdue.
          e.minuteur = null
        }
      }
      const lot = e.lot
      const moyens = e.moyens
      e.lot = null
      if (lot === null || moyens === null) return
      e.dernier = maintenant
      try {
        const r = await moyens.ecrire(lot)
        signaler(r.ok ? '' : r.erreur)
      } catch (err) {
        signaler(`L’écriture de la fiche a échoué (${premiereLigne(err)}).`)
      }
    } catch {
      // Horloge en panne : on n'écrit pas, rien ne lève.
    } finally {
      if (e.minuteur === null) {
        e.occupe = false
        relance = e.lot !== null
      }
    }
    if (relance) await declencher(cle)
  }

  return {
    /** Ajoute une mise à jour (le dernier état de chaque agent l'emporte) et écrit tout de suite ou à l'échéance. Ne lève jamais. */
    async soumettre(cle: string, cible: Cible, maj: MajFiche, agentsProjet: string[], moyens: Moyens): Promise<void> {
      try {
        const e = etat(cle)
        const agents = new Map((e.lot?.maj.agents ?? []).map(a => [a.id, a]))
        for (const a of maj.agents) agents.set(a.id, a)
        e.moyens = moyens
        e.lot = {
          cible,
          agentsProjet,
          maj: { chantierEtat: maj.chantierEtat ?? e.lot?.maj.chantierEtat, agents: [...agents.values()] },
        }
        await suivre(declencher(cle))
      } catch {
        // Une écriture qui échoue ne remonte jamais.
      }
    },
    /** Annule les minuteurs et abandonne ce qui attendait (changement de projet). */
    oublier(): void {
      for (const e of cles.values()) {
        try {
          e.minuteur?.cancel()
        } catch {
          // Rien de plus à faire.
        }
        e.minuteur = null
        e.lot = null
        e.occupe = false
      }
    },
    /** Se résout quand plus aucune écriture n'est en route (les minuteurs en attente ne comptent pas). */
    async repos(): Promise<void> {
      while (enCours.size > 0) await Promise.allSettled([...enCours])
    },
  }
}
