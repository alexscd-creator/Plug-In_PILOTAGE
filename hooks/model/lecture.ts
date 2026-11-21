// Lecture complète d'un projet : projet.json, plan.md et les portes de chaque membre. Logique pure : le disque
// arrive par FsLike (les hooks tournent hors Node) et ne reçoit jamais d'écriture. Ne lève jamais : un fichier
// absent est vide, un fichier illisible est vide AVEC une erreur en français.
import type { FsLike } from './activation.ts'
import { lirePortes } from './phases.ts'
import type { Portes } from './phases.ts'
import { estCopieDeConflit, parsePlan } from './plan.ts'
import type { Tache } from './plan.ts'
import { memeMembre, parseProjet } from './projet.ts'
import type { Projet } from './projet.ts'

export type LectureProjet = {
  /** Null quand le projet est absent, illisible ou invalide (les raisons sont dans `erreurs`). */
  projet: Projet | null
  taches: Tache[]
  /** Une entrée par membre de l'équipe, sous le prénom écrit dans le projet ; le membre courant d'abord. */
  portes: Record<string, Portes>
  erreurs: string[]
}

const BS = String.fromCharCode(92)
const normaliser = (p: string): string => p.replaceAll(BS, '/').replace(/\/+/g, '/').replace(/\/$/, '')
const vide = (): Portes => ({ valides: [], forces: [], refus: [] })
const liste = async (fs: FsLike, dossier: string): Promise<string[] | null> => {
  try {
    return await fs.list(dossier)
  } catch {
    return null
  }
}

export async function lireProjetComplet(fs: FsLike, racine: string, moi: string): Promise<LectureProjet> {
  const sortie: LectureProjet = { projet: null, taches: [], portes: {}, erreurs: [] }
  try {
    if (typeof racine !== 'string' || racine.trim() === '') {
      sortie.erreurs.push('Aucun dossier de projet n’est indiqué.')
      return sortie
    }
    const dossier = `${normaliser(racine)}/.pilotage`

    let brut: string
    try {
      brut = await fs.read(`${dossier}/projet.json`)
    } catch {
      sortie.erreurs.push('Le fichier projet (.pilotage/projet.json) n’a pas pu être lu.')
      return sortie
    }
    const r = parseProjet(brut)
    if (!r.ok) {
      sortie.erreurs.push(...r.erreurs)
      return sortie
    }
    sortie.projet = r.projet

    const noms = await liste(fs, dossier)

    // Le plan : absent = vide ; présent mais illisible = vide et une erreur.
    if (noms === null || noms.includes('plan.md')) {
      try {
        sortie.taches = parsePlan(await fs.read(`${dossier}/plan.md`))
      } catch {
        if (noms !== null) sortie.erreurs.push('Le plan (.pilotage/plan.md) n’a pas pu être lu : il est affiché vide.')
      }
    }

    // Les portes : un dossier par membre, rapproché du prénom du projet (accents, casse, tirets).
    const membres = [...r.projet.equipe].sort((a, b) => Number(memeMembre(b, moi)) - Number(memeMembre(a, moi)))
    for (const m of membres) sortie.portes[m] = vide()
    let dossiers: string[] = []
    if (noms !== null && noms.includes('equipe')) {
      const l = await liste(fs, `${dossier}/equipe`)
      if (l === null) sortie.erreurs.push('Le dossier de l’équipe (.pilotage/equipe) n’a pas pu être lu : les portes sont affichées vides.')
      else dossiers = l.filter(n => !estCopieDeConflit(n)).sort()
    }
    for (const m of membres) {
      const d = dossiers.find(n => memeMembre(m, n))
      if (d === undefined) continue
      const fichiers = await liste(fs, `${dossier}/equipe/${d}`)
      if (fichiers === null || !fichiers.includes('portes.md')) continue
      try {
        sortie.portes[m] = lirePortes(await fs.read(`${dossier}/equipe/${d}/portes.md`))
      } catch {
        sortie.erreurs.push(`Les portes de ${m} (.pilotage/equipe/${d}/portes.md) n’ont pas pu être lues : elles sont affichées vides.`)
      }
    }
    return sortie
  } catch {
    // Dernier filet : une anomalie imprévue ne doit jamais faire tomber le panneau.
    return { projet: null, taches: [], portes: {}, erreurs: ['Le projet n’a pas pu être lu.'] }
  }
}
