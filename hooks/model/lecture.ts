// Lecture complète d'un projet : projet.json, plan.md et les portes de chaque membre. Logique pure : le disque
// arrive par FsLike (les hooks tournent hors Node) et ne reçoit jamais d'écriture. Ne lève jamais : un fichier
// absent est vide, un fichier illisible est vide AVEC une erreur en français.
import type { FsLike } from './activation.ts'
import { parseChantier } from './chantier.ts'
import type { Chantier } from './chantier.ts'
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
  /** Fiches de chantier valides de toute l'équipe (en cours et archivées). */
  chantiers: Chantier[]
  /** Une phrase par fiche ou dossier de chantier illisible ou invalide. */
  erreursChantiers: string[]
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
  const sortie: LectureProjet = { projet: null, taches: [], portes: {}, chantiers: [], erreursChantiers: [], erreurs: [] }
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
    const c = await lireChantiersDetail(fs, dossier, r.projet.equipe)
    sortie.chantiers = c.chantiers
    sortie.erreursChantiers = c.erreurs
    return sortie
  } catch {
    // Dernier filet : une anomalie imprévue ne doit jamais faire tomber le panneau.
    return { projet: null, taches: [], portes: {}, chantiers: [], erreursChantiers: [], erreurs: ['Le projet n’a pas pu être lu.'] }
  }
}

/**
 * Fiches de chantier de l'équipe : `equipe/<prénom>/chantiers/*.md` (en cours) et `equipe/<prénom>/archive/*.md` (archivées, `archive` forcé à vrai).
 * `auteur` = le prénom de `equipe` qui correspond au dossier (sinon le nom du dossier). Copies de conflit ignorées ; les fiches
 * illisibles ou invalides sont écartées et listées dans `erreurs`. Deux membres peuvent avoir le même id : les deux sont gardées.
 */
const MAX_ARCHIVES = 100
const MAX_FICHE = 256 * 1024

async function lireChantiersDetail(fs: FsLike, dossier: string, equipe: string[]): Promise<{ chantiers: Chantier[]; erreurs: string[] }> {
  const sortie: { chantiers: Chantier[]; erreurs: string[] } = { chantiers: [], erreurs: [] }
  try {
    const membres = await liste(fs, `${dossier}/equipe`)
    if (membres === null) return sortie
    for (const d of membres.filter(n => !estCopieDeConflit(n)).sort()) {
      const auteur = equipe.find(m => memeMembre(m, d)) ?? d
      for (const sous of ['chantiers', 'archive'] as const) {
        const noms = await liste(fs, `${dossier}/equipe/${d}/${sous}`)
        if (noms === null) {
          // Un dossier simplement absent n'est pas une erreur ; on ne le distingue pas d'une panne de liste, sauf si le parent le contient.
          const parent = await liste(fs, `${dossier}/equipe/${d}`)
          if (parent?.includes(sous)) sortie.erreurs.push(`Le dossier ${sous} de ${auteur} (.pilotage/equipe/${d}/${sous}) n’a pas pu être lu.`)
          continue
        }
        let fiches = noms.filter(n => /\.md$/i.test(n) && !estCopieDeConflit(n)).sort()
        // Les archives ne font que grandir : on ne lit que les MAX_ARCHIVES dernières par nom (ordre alphabétique décroissant,
        // donc les identifiants ou horodatages les plus grands d'abord) ; les actifs sont toujours lus en entier.
        if (sous === 'archive' && fiches.length > MAX_ARCHIVES) {
          const ecartees = fiches.length - MAX_ARCHIVES
          fiches = fiches.slice(ecartees)
          sortie.erreurs.push(`(info) ${ecartees > 1 ? `${ecartees} fiches archivées plus anciennes ne sont pas affichées` : '1 fiche archivée plus ancienne n’est pas affichée'}.`)
        }
        for (const nom of fiches) {
          const chemin = `.pilotage/equipe/${d}/${sous}/${nom}`
          let texte: string
          try {
            texte = await fs.read(`${dossier}/equipe/${d}/${sous}/${nom}`)
          } catch {
            sortie.erreurs.push(`La fiche de chantier ${chemin} n’a pas pu être lue.`)
            continue
          }
          if (texte.length > MAX_FICHE) {
            sortie.erreurs.push(`Fiche trop volumineuse (> 256 Ko) : ${nom}`)
            continue
          }
          const f = parseChantier(texte, auteur)
          if (f.ok) {
            sortie.chantiers.push(sous === 'archive' ? { ...f.chantier, archive: true } : f.chantier)
            for (const a of f.avertissements) sortie.erreurs.push(`(avertissement) ${chemin} : ${a}`)
          }
          else sortie.erreurs.push(`La fiche de chantier ${chemin} est écartée : ${f.erreurs.join(' ')}`)
        }
      }
    }
  } catch {
    sortie.erreurs.push('Les chantiers n’ont pas pu être lus.')
  }
  return sortie
}

/** Fiches de chantier valides de toute l'équipe (voir `lireChantiersDetail` pour les règles). Ne lève jamais. */
export async function lireChantiers(fs: FsLike, racine: string, equipe: string[]): Promise<Chantier[]> {
  try {
    if (typeof racine !== 'string' || racine.trim() === '') return []
    return (await lireChantiersDetail(fs, `${normaliser(racine)}/.pilotage`, Array.isArray(equipe) ? equipe : [])).chantiers
  } catch {
    return []
  }
}

/** Lien d'une session vers un chantier, avec le membre dont le `sessions.json` le porte (le nom du projet, sinon le nom du dossier). */
export type LienSession = { chantier: string; auteur: string }

/**
 * Liens session -> chantier : `.pilotage/equipe/<prénom>/sessions.json` = { "<id de session>": "<id du chantier>" }, tous
 * membres confondus (en cas de conflit sur un id de session, le premier dossier par ordre alphabétique gagne). Fichier absent, illisible, trop gros ou mal
 * formé : ignoré ; les valeurs qui ne sont pas du texte aussi. Lecture seule, ne lève jamais.
 */
export async function lireSessions(fs: FsLike, racine: string, equipe: string[] = []): Promise<Map<string, LienSession>> {
  const carte = new Map<string, LienSession>()
  try {
    if (typeof racine !== 'string' || racine.trim() === '') return carte
    const dossier = `${normaliser(racine)}/.pilotage/equipe`
    const membres = await liste(fs, dossier)
    if (membres === null) return carte
    for (const d of membres.filter(n => !estCopieDeConflit(n)).sort()) {
      try {
        const auteur = equipe.find(m => memeMembre(m, d)) ?? d
        const texte = await fs.read(`${dossier}/${d}/sessions.json`)
        if (texte.length > MAX_FICHE) continue
        const v: unknown = JSON.parse(texte)
        if (typeof v !== 'object' || v === null || Array.isArray(v)) continue
        for (const [cle, val] of Object.entries(v)) if (typeof val === 'string' && !carte.has(cle)) carte.set(cle, { chantier: val, auteur })
      } catch {
        // Pas de sessions.json chez ce membre, ou fichier mal formé : rien à lier.
      }
    }
  } catch {
    // Les chantiers restent lisibles sans les liens de session.
  }
  return carte
}
