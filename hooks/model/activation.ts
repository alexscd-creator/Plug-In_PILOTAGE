// Activation par dossier : le panneau s'ouvre seul dans une session dont le dossier (ou un parent) contient
// `.pilotage/projet.json`. Logique pure : le disque arrive par FsLike (les hooks tournent hors Node).
import { estCopieDeConflit } from './plan.ts'
import { memeMembre, parseProjet } from './projet.ts'
import type { Projet } from './projet.ts'

/**
 * Le disque vu du modèle. `list` ne rend jamais une entrée lien (symbolique ou jonction) : l'adaptateur la retire et ajoute son chemin à
 * `liens` (facultatif), pour que la lecture le dise ; un lien n'est donc jamais lu ni parcouru.
 */
export type FsLike = { read(p: string): Promise<string>; list(p: string): Promise<string[]>; liens?: string[] }

export type Trouve = { racine: string; projet: Projet } | { racine: string; erreurs: string[] }

const MARQUEUR = 'projet.json'
const LIEN = 'Le dossier .pilotage ou son fichier projet.json est un lien (il peut mener hors du projet) : Pilotage ne le lit pas. Le remplacer par un vrai dossier et un vrai fichier.'

/** Barres obliques, sans barre finale ; la racine du disque devient `C:` (Windows) ou `` (POSIX). */
const BS = String.fromCharCode(92)
const normaliser = (p: string): string => p.replaceAll(BS, '/').replace(/\/+/g, '/').replace(/\/$/, '')

/** Dossiers à visiter, du plus proche au plus haut (racine du disque comprise). */
function ancetres(dossier: string): string[] {
  const sortie: string[] = []
  let d = normaliser(dossier)
  for (;;) {
    sortie.push(d)
    const i = d.lastIndexOf('/')
    if (i < 0) return sortie
    d = d.slice(0, i)
  }
}

/** Remonte depuis `dossier` jusqu'à la racine du disque. Ne lève jamais. */
export async function trouverProjet(fs: FsLike, dossier: string): Promise<Trouve | null> {
  if (typeof dossier !== 'string' || dossier.trim() === '') return null
  for (const d of ancetres(dossier)) {
    try {
      const avant = fs.liens?.length ?? 0
      const noms = await fs.list(`${d}/.pilotage`)
      const lien = (chemin: string): boolean => (fs.liens ?? []).slice(avant).some(l => normaliser(l) === chemin)
      if (lien(`${d}/.pilotage/${MARQUEUR}`)) return { racine: d, erreurs: [LIEN] }
      // Seul le nom exact compte : « projet (1).json » est une copie de conflit.
      if (!noms.some(n => n === MARQUEUR && !estCopieDeConflit(n))) continue
      // `.pilotage` lui-même ne doit pas être un lien : son dossier parent le dit.
      await fs.list(d === '' ? '/' : d).catch(() => [])
      if (lien(`${d}/.pilotage`)) return { racine: d, erreurs: [LIEN] }
      const r = parseProjet(await fs.read(`${d}/.pilotage/${MARQUEUR}`))
      return r.ok ? { racine: d, projet: r.projet } : { racine: d, erreurs: r.erreurs }
    } catch {
      // Dossier absent ou illisible : on continue de remonter.
    }
  }
  return null
}

/** Le membre de l'équipe qui correspond au prénom de la config, tel qu'écrit dans le projet ; sinon null. */
export function membreCourant(projet: Projet, prenomConfig: string | null): string | null {
  if (!prenomConfig || prenomConfig.trim() === '') return null
  return projet.equipe.find(m => memeMembre(m, prenomConfig)) ?? null
}

/** Prénom lu dans `<home>/.claude/pilotage/config.json` (`{ "prenom": ... }`) ; null à la moindre anomalie. */
export async function lirePrenomConfig(
  home: string | undefined,
  lire: (chemin: string) => Promise<string>,
): Promise<string | null> {
  if (!home) return null
  const sep = home.includes(BS) ? BS : '/'
  const chemin = [home.replace(/[/]+$/, '').replace(new RegExp(`${BS}${BS}+$`), ''),'.claude', 'pilotage', 'config.json'].join(sep)
  try {
    const brut: unknown = JSON.parse(await lire(chemin))
    const prenom = typeof brut === 'object' && brut !== null ? (brut as Record<string, unknown>).prenom : undefined
    return typeof prenom === 'string' && prenom.trim() !== '' ? prenom : null
  } catch {
    return null
  }
}
