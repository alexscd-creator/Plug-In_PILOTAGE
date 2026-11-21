// Suivi des agents en direct : logique pure, sans fs ni process (les hooks tournent hors Node).
// Un appel de l'outil `Agent` dure tant que l'agent travaille : début = « en travail », fin = « prêt » (ok) ou « bloqué » (erreur).
// Les états viennent de ce que le moteur montre ; rien n'est inventé : sans appel ni fiche, l'agent est « arrêté » (source « aucune »).
// « En attente d'une réponse » : seul signe fiable côté moteur, un appel de l'outil de question (`AskUserQuestion`) en cours ;
// il concerne la session (donc le chantier), jamais un agent précis : l'état « attente » d'un agent ne vient que des fiches.
import { etatAgentAffiche } from './chantiers.ts'
import type { Chantier, EtatChantier } from './chantier.ts'

export type AppelLive = { cle: string; agent: string; quoi: string; depuis: number }
/** Issue du dernier appel d'un agent dont plus aucun appel ne dure. */
export type FinLive = { agent: string; etat: 'pret' | 'bloque'; quoi: string; depuis: number }
export type Live = { appels: AppelLive[]; derniers: FinLive[]; /** Identifiants des appels de question en cours. */ attentes: string[] }
export type SourceEtat = 'live' | 'fiche' | 'aucune'
export type EtatAgent = { agent: string; etat: EtatChantier; quoi: string; depuis: number | null; source: SourceEtat }

export const LIVE_VIDE: Live = { appels: [], derniers: [], attentes: [] }

const ID_RE = /^[a-z0-9-]+$/
const MAX_ID = 60
const MAX_QUOI = 200
const MAX_APPELS = 200

const idSur = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= MAX_ID && ID_RE.test(s)
const quoiNet = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').replaceAll('|', '/').trim().slice(0, MAX_QUOI).trim()
const liste = (l: Live | undefined): Live => (l && Array.isArray(l.appels) && Array.isArray(l.derniers) && Array.isArray(l.attentes) ? l : LIVE_VIDE)

/**
 * Identifiant d'agent du projet d'après le `subagent_type` de l'outil Agent : le préfixe de plugin (`plugin:agent`) est retiré.
 * Null si ce n'est pas un agent du projet (agent intégré, autre plugin, valeur illisible).
 */
export function agentDeSousType(sousType: unknown, agentsProjet: { id: string }[]): string | null {
  if (typeof sousType !== 'string' || !Array.isArray(agentsProjet)) return null
  const id = sousType.slice(sousType.lastIndexOf(':') + 1).trim()
  return idSur(id) && agentsProjet.some(a => a?.id === id) ? id : null
}

/** Nombre d'appels en cours d'un agent. */
export const nombreAppels = (live: Live, agent: string): number => liste(live).appels.filter(a => a.agent === agent).length

/** Un appel commence : l'agent travaille. Clé déjà vue, identifiant invalide : rien ne change (même objet). Ne modifie jamais `live`. */
export function debutAppel(live: Live, cle: string, agentId: string, quoi: string, maintenant: number): Live {
  const l = liste(live)
  if (typeof cle !== 'string' || cle === '' || !idSur(agentId) || !Number.isFinite(maintenant)) return l
  if (l.appels.some(a => a.cle === cle) || l.appels.length >= MAX_APPELS) return l
  return {
    ...l,
    appels: [...l.appels, { cle, agent: agentId, quoi: quoiNet(quoi), depuis: maintenant }],
    derniers: l.derniers.filter(d => d.agent !== agentId),
  }
}

/**
 * Un appel finit : `ok` = prêt, `erreur` = bloqué. L'issue n'est gardée qu'avec le dernier appel de l'agent ; clé inconnue : rien ne change.
 */
export function finAppel(live: Live, cle: string, maintenant: number, issue: 'ok' | 'erreur'): Live {
  const l = liste(live)
  const appel = l.appels.find(a => a.cle === cle)
  if (!appel) return l
  const appels = l.appels.filter(a => a.cle !== cle)
  if (appels.some(a => a.agent === appel.agent)) return { ...l, appels }
  const fin: FinLive = { agent: appel.agent, etat: issue === 'ok' ? 'pret' : 'bloque', quoi: appel.quoi, depuis: maintenant }
  return { ...l, appels, derniers: [...l.derniers.filter(d => d.agent !== appel.agent), fin] }
}

/** Une question à la personne est posée (appel en cours). Clé vide ou déjà vue : rien ne change. */
export function debutAttente(live: Live, cle: string): Live {
  const l = liste(live)
  if (typeof cle !== 'string' || cle === '' || l.attentes.includes(cle) || l.attentes.length >= MAX_APPELS) return l
  return { ...l, attentes: [...l.attentes, cle] }
}

/** La question a reçu sa réponse (ou a échoué). Clé inconnue : rien ne change. */
export function finAttente(live: Live, cle: string): Live {
  const l = liste(live)
  return l.attentes.includes(cle) ? { ...l, attentes: l.attentes.filter(k => k !== cle) } : l
}

const date = (c: Chantier): number => {
  const t = Date.parse(c.maj)
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t
}

/**
 * Un état par agent du projet, dans l'ordre du projet : un appel en cours (en travail) ; sinon le signe le plus récent entre
 * l'issue du dernier appel (live) et la fiche la plus fraîche d'un chantier non archivé (« en travail » ou « en attente » sans
 * nouvelle depuis plus de 15 minutes = prêt à reprendre) ; sinon « arrêté » (aucun signe). Les agents inconnus du projet sont ignorés.
 */
export function fusionnerEtats(agentsProjet: { id: string }[], live: Live, chantiers: Chantier[], maintenant: number): EtatAgent[] {
  if (!Array.isArray(agentsProjet)) return []
  const l = liste(live)
  const fiches = (Array.isArray(chantiers) ? chantiers : []).filter(c => c && !c.archive && Array.isArray(c.agents))
  return agentsProjet.map(({ id }): EtatAgent => {
    const appels = l.appels.filter(a => a.agent === id)
    if (appels.length > 0) {
      const dernier = appels.reduce((a, b) => (b.depuis >= a.depuis ? b : a))
      return { agent: id, etat: 'en-travail', quoi: dernier.quoi, depuis: Math.min(...appels.map(a => a.depuis)), source: 'live' }
    }
    let meilleure: { c: Chantier; etat: EtatChantier; quoi: string } | null = null
    for (const c of fiches) {
      const a = c.agents.find(x => x.id === id)
      if (a && (meilleure === null || date(c) > date(meilleure.c))) meilleure = { c, etat: a.etat, quoi: a.quoi }
    }
    const fin = l.derniers.find(d => d.agent === id)
    if (fin && (meilleure === null || fin.depuis >= date(meilleure.c))) {
      return { agent: id, etat: fin.etat, quoi: fin.quoi, depuis: fin.depuis, source: 'live' }
    }
    if (meilleure) {
      const t = date(meilleure.c)
      return { agent: id, etat: etatAgentAffiche(meilleure.c, meilleure.etat, maintenant), quoi: meilleure.quoi, depuis: Number.isFinite(t) ? t : null, source: 'fiche' }
    }
    return { agent: id, etat: 'arrete', quoi: '', depuis: null, source: 'aucune' }
  })
}
