// Aides pures pour les chantiers affichés (liste, bandeau, Vue d'ensemble) : regroupement, tri, résolution
// session -> chantier, textes courts. Pas de fs ni de process (les hooks tournent hors Node).
import { etatAffiche } from './chantier.ts'
import type { Chantier, EtatChantier } from './chantier.ts'
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

/** Chantier en cours lié à la session par `sessions.json` (`carte`: id de session -> id de chantier). Null sinon. */
export function chantierDeSession(chantiers: Chantier[], carte: Map<string, string>, sessionId: string): Chantier | null {
  try {
    if (typeof sessionId !== 'string' || sessionId === '' || !(carte instanceof Map)) return null
    const id = carte.get(sessionId)
    if (id === undefined) return null
    return (Array.isArray(chantiers) ? chantiers : []).find(c => !c.archive && c.id === id) ?? null
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
/** Sépare les lignes de lecture : les erreurs, et les avertissements (sans leur préfixe). */
export function separerAvis(lignes: string[]): { erreurs: string[]; avertissements: string[] } {
  const sortie = { erreurs: [] as string[], avertissements: [] as string[] }
  for (const l of Array.isArray(lignes) ? lignes : []) {
    if (l.startsWith(AVERTISSEMENT)) sortie.avertissements.push(l.slice(AVERTISSEMENT.length))
    else sortie.erreurs.push(l)
  }
  return sortie
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
