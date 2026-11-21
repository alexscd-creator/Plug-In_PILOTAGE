// Lecture des idées et retours de toute l'équipe : `equipe/<prénom>/idees/*.md` et `equipe/<prénom>/feedback/*.md`. Logique pure : le
// disque arrive par FsLike et ne reçoit jamais d'écriture. Mêmes règles que les chantiers (lecture.ts) : copies de conflit ignorées,
// rien ne lève, anomalies en trois sortes de lignes (erreur, `(avertissement) `, `(info) `) que `separerAvis` sait séparer.
import type { FsLike } from './activation.ts'
import { DOSSIER_NOTE, MAX_FICHIER_NOTE, parseNote, TYPES_NOTE } from './notes.ts'
import type { Note } from './notes.ts'
import { estCopieDeConflit } from './plan.ts'
import { memeMembre } from './projet.ts'

/** Notes les plus récentes lues par membre et par type (les noms commencent par la date : l'ordre alphabétique est l'ordre du temps). */
export const MAX_NOTES_PAR_MEMBRE = 200

/** Une note lue, avec le chemin de son fichier relatif au projet (`.pilotage/equipe/<dossier>/<idees|feedback>/<nom>.md`). */
export type NoteLue = Note & { chemin: string }
export type LectureNotes = { notes: NoteLue[]; erreurs: string[] }

const BS = String.fromCharCode(92)
const normaliser = (p: string): string => p.replaceAll(BS, '/').replace(/\/+/g, '/').replace(/\/$/, '')
const liste = async (fs: FsLike, dossier: string): Promise<string[] | null> => {
  try {
    return await fs.list(dossier)
  } catch {
    return null
  }
}
const plusRecentes = (a: NoteLue, b: NoteLue): number => {
  const d = Date.parse(b.date) - Date.parse(a.date)
  return d !== 0 && !Number.isNaN(d) ? d : a.id < b.id ? 1 : a.id > b.id ? -1 : 0
}

/**
 * Notes valides de toute l'équipe, de la plus récente à la plus ancienne. `auteur` = le prénom de `equipe` qui correspond au dossier
 * (sinon le nom du dossier). Au plus 200 notes par membre et par type ; au-delà de 64 Ko ou invalide : écartée et dite. Ne lève jamais.
 */
export async function lireNotes(fs: FsLike, racine: string, equipe: string[]): Promise<LectureNotes> {
  const sortie: LectureNotes = { notes: [], erreurs: [] }
  try {
    if (typeof racine !== 'string' || racine.trim() === '') return sortie
    const membres = Array.isArray(equipe) ? equipe : []
    const dossier = `${normaliser(racine)}/.pilotage/equipe`
    const dossiers = await liste(fs, dossier)
    if (dossiers === null) return sortie
    for (const d of dossiers.filter(n => !estCopieDeConflit(n)).sort()) {
      const auteur = membres.find(m => memeMembre(m, d)) ?? d
      for (const type of TYPES_NOTE) {
        const sous = DOSSIER_NOTE[type]
        const noms = await liste(fs, `${dossier}/${d}/${sous}`)
        if (noms === null) {
          const parent = await liste(fs, `${dossier}/${d}`)
          if (parent?.includes(sous)) sortie.erreurs.push(`Le dossier ${sous} de ${auteur} (.pilotage/equipe/${d}/${sous}) n’a pas pu être lu.`)
          continue
        }
        let fiches = noms.filter(n => /\.md$/i.test(n) && !estCopieDeConflit(n)).sort()
        if (fiches.length > MAX_NOTES_PAR_MEMBRE) {
          const ecartees = fiches.length - MAX_NOTES_PAR_MEMBRE
          fiches = fiches.slice(ecartees)
          sortie.erreurs.push(`(info) ${ecartees > 1 ? `${ecartees} notes plus anciennes` : '1 note plus ancienne'} de ${auteur} (${sous}) ne ${ecartees > 1 ? 'sont' : 'est'} pas affichée${ecartees > 1 ? 's' : ''}.`)
        }
        for (const nom of fiches) {
          const chemin = `.pilotage/equipe/${d}/${sous}/${nom}`
          let texte: string
          try {
            texte = await fs.read(`${dossier}/${d}/${sous}/${nom}`)
          } catch {
            sortie.erreurs.push(`La note ${chemin} n’a pas pu être lue.`)
            continue
          }
          if (typeof texte !== 'string' || texte.length > MAX_FICHIER_NOTE) {
            sortie.erreurs.push(`Note trop volumineuse (> 64 Ko) : ${nom}`)
            continue
          }
          const r = parseNote(texte, auteur)
          if (!r.ok) sortie.erreurs.push(`La note ${chemin} est écartée : ${r.erreurs.join(' ')}`)
          else if (r.note.type !== type) sortie.erreurs.push(`La note ${chemin} est écartée : son type (${r.note.type}) n’est pas celui de son dossier (${type}).`)
          else {
            sortie.notes.push({ ...r.note, chemin })
            for (const a of r.avertissements) sortie.erreurs.push(`(avertissement) ${chemin} : ${a}`)
          }
        }
      }
    }
    sortie.notes.sort(plusRecentes)
  } catch {
    sortie.erreurs.push('Les notes n’ont pas pu être lues.')
  }
  return sortie
}
