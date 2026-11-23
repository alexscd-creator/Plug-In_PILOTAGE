// Aides pures pour les chantiers affichés (liste, bandeau, Aperçu) : regroupement, tri, résolution
// session -> chantier, textes courts. Pas de fs ni de process (les hooks tournent hors Node).
import { etatAffiche } from './chantier.ts'
import type { Chantier, EtatChantier } from './chantier.ts'
import type { LienSession } from './lecture.ts'
import type { Projet } from './projet.ts'

/** État de pastille du panneau (voir ui/theme.ts) pour chaque état de fiche. */
export type StatutPastille = 'travail' | 'attente' | 'arrete' | 'reprendre' | 'bloque' | 'termine'
const STATUTS: Record<EtatChantier, StatutPastille> = {
  'en-travail': 'travail', attente: 'attente', arrete: 'arrete', pret: 'reprendre', bloque: 'bloque', termine: 'termine',
}
export const etatStatut = (e: EtatChantier): StatutPastille => STATUTS[e] ?? 'arrete'

const date = (c: Chantier): number => {
  const t = Date.parse(c.maj)
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

/** En cours (non archivés) et archivés, chacun du plus récemment mis à jour au plus ancien (égalité : par id). */
export function grouperChantiers(chantiers: Chantier[]): { enCours: Chantier[]; archives: Chantier[] } {
  const liste = Array.isArray(chantiers) ? chantiers : []
  const tri = (a: Chantier, b: Chantier): number => {
    const d = date(b) === date(a) ? 0 : date(b) > date(a) ? 1 : -1
    return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }
  return { enCours: liste.filter(c => !c.archive).sort(tri), archives: liste.filter(c => c.archive).sort(tri) }
}

/**
 * Chantier en cours lié à la session par `sessions.json` (`carte`: id de session -> chantier et propriétaire du lien).
 * Le chantier est celui du propriétaire ; l'id seul ne sert que si UN SEUL chantier porte cet id. Null sinon (archivé compris).
 */
export function chantierDeSession(chantiers: Chantier[], carte: Map<string, LienSession>, sessionId: string): Chantier | null {
  try {
    if (typeof sessionId !== 'string' || sessionId === '' || !(carte instanceof Map)) return null
    const lien = carte.get(sessionId)
    if (lien === undefined) return null
    const memeId = (Array.isArray(chantiers) ? chantiers : []).filter(c => c.id === lien.chantier)
    const trouve = memeId.find(c => c.auteur === lien.auteur) ?? (memeId.length === 1 ? memeId[0]! : null)
    return trouve && !trouve.archive ? trouve : null
  } catch {
    return null
  }
}

/** État d'un agent tel qu'on le dit : actif dans un chantier sans nouvelle depuis 15 minutes = prêt (même règle que le chantier). */
export function etatAgentAffiche(c: Chantier, etat: EtatChantier, maintenant: number): EtatChantier {
  if (etat !== 'en-travail' && etat !== 'attente') return etat
  return etatAffiche({ ...c, etat: 'en-travail' }, maintenant) === 'pret' ? 'pret' : etat
}

const AVERTISSEMENT = '(avertissement) '
const INFO = '(info) '
/** Sépare les lignes de lecture : erreurs (fiche ou dossier illisible), avertissements (fiche gardée, chemin écarté) et infos (archives omises), sans préfixe. */
export function separerAvis(lignes: string[]): { erreurs: string[]; avertissements: string[]; infos: string[] } {
  const sortie = { erreurs: [] as string[], avertissements: [] as string[], infos: [] as string[] }
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (l.startsWith(AVERTISSEMENT)) sortie.avertissements.push(l.slice(AVERTISSEMENT.length))
    else if (l.startsWith(INFO)) sortie.infos.push(l.slice(INFO.length))
    else sortie.erreurs.push(l)
  }
  return sortie
}

/** Une phrase pour les erreurs de lecture : les fiches (écartées ou trop grosses) et les dossiers de chantiers n'ont pas la même formule. */
export function resumeErreurs(erreurs: string[]): string {
  const liste = Array.isArray(erreurs) ? erreurs : []
  const fiches = liste.filter(e => e.startsWith('La fiche de chantier') || e.startsWith('Fiche trop volumineuse')).length
  const dossiers = liste.length - fiches
  const phrases: string[] = []
  if (fiches > 0) phrases.push(`${fiches} ${fiches > 1 ? 'fiches de chantier n’ont pas pu être lues' : 'fiche de chantier n’a pas pu être lue'}`)
  if (dossiers > 0) phrases.push('Un dossier de chantiers n’a pas pu être lu.')
  return phrases.join('. ')
}

const MAX_RESUME = 280
/** Passation sur une ligne, bornée ; texte vide : le dit. */
export function resumePassation(texte: string): string {
  const t = String(texte ?? '').replace(/\s+/g, ' ').trim()
  if (t === '') return 'Aucune passation écrite.'
  return t.length > MAX_RESUME ? `${t.slice(0, MAX_RESUME).trimEnd()}…` : t
}

/** Titre de l'agent s'il est défini dans le projet, sinon son identifiant. */
export const nomAgent = (projet: Projet, id: string): string => projet.agents.find(a => a.id === id)?.titre ?? id
