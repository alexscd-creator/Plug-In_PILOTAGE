// Liens (symboliques) et jonctions dans le projet, côté panneau : logique pure, sans `$`. Un lien peut mener n'importe où (une clé
// privée, un dossier de commandes de l'utilisateur) : le panneau ne lit jamais une entrée que `$.fs.list` marque `isLink` (l'adaptateur
// du disque la retire de la liste et la note dans `FsLike.liens`), et n'écrit jamais au travers d'un lien (ecritureSure).
import type { FsLike } from './activation.ts'

export const MESSAGE_LIEN_PANNEAU = 'Chemin non sûr (lien hors du projet) : rien n’est écrit. Un dossier ou un fichier de .pilotage est un lien : le remplacer par un vrai dossier.'

const BS = String.fromCharCode(92)
const normaliser = (p: string): string => p.replaceAll(BS, '/').replace(/\/+/g, '/').replace(/\/$/, '')
/** Les chemins Windows ne distinguent pas la casse ; les autres, si. */
const cle = (p: string): string => (/^[A-Za-z]:/.test(p) ? p.toLowerCase() : p)
const sous = (p: string, racine: string): boolean => cle(p) === cle(racine) || cle(p).startsWith(cle(racine) + '/')

/** Ce que `$.fs.stat(p, { resolve: true })` dit d'un chemin ; null quand il n'existe pas ou ne se contrôle pas. */
export type StatLien = (p: string) => Promise<{ isLink: boolean; realPath?: string } | null>

/**
 * Vrai si le panneau peut écrire `cible` : aucun morceau existant du chemin, de la racine (exclue) à la cible (comprise), n'est un lien,
 * et chacun se résout sous le chemin réel de la racine. Une cible hors de la racine : faux. La racine elle-même ne se contrôle pas
 * (l'API ne répond pas) : vrai, faute de pouvoir vérifier. Ne lève jamais (une anomalie vaut refus).
 */
export async function ecritureSure(stat: StatLien, racine: string, cible: string): Promise<boolean> {
  try {
    const r = normaliser(racine), c = normaliser(cible)
    if (!sous(c, r) || cle(c) === cle(r)) return false
    const infoRacine = await stat(r).catch(() => null)
    if (!infoRacine) return true // contrôle impossible ici : l'écriture suit son cours, comme avant
    const reelle = normaliser(infoRacine.realPath ?? r)
    let chemin = r
    for (const morceau of c.slice(r.length + 1).split('/')) {
      chemin = `${chemin}/${morceau}`
      const s = await stat(chemin).catch(() => null)
      if (!s) return true // n'existe pas encore : rien au-delà ne peut être un lien
      if (s.isLink) return false
      if (s.realPath !== undefined && !sous(normaliser(s.realPath), reelle)) return false
    }
    return true
  } catch {
    return false
  }
}

/** Avertissements en français pour les liens que la lecture a sautés, chemins relatifs au projet (une fois chacun). */
export function avisLiens(fs: FsLike, racine: string, depuis = 0): string[] {
  const r = normaliser(racine)
  const vus = [...new Set((fs.liens ?? []).slice(depuis).map(normaliser))]
  return vus.map(p => `(avertissement) Lien ignoré (il peut mener hors du projet, il n’est pas lu) : ${sous(p, r) ? p.slice(r.length + 1) : p}`)
}
