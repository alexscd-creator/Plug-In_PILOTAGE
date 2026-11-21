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
/** Question en cours : identifiant de l'appel et début (ms). */
export type AttenteLive = { cle: string; depuis: number }
export type Live = { appels: AppelLive[]; derniers: FinLive[]; /** Appels de question en cours. */ attentes: AttenteLive[] }
export type SourceEtat = 'live' | 'fiche' | 'aucune'
export type EtatAgent = { agent: string; etat: EtatChantier; quoi: string; depuis: number | null; source: SourceEtat }

export const LIVE_VIDE: Live = { appels: [], derniers: [], attentes: [] }

/**
 * Au-delà, un appel (ou une question) encore « en cours » dans l'état live est tenu pour périmé : sa fin n'a jamais été vue
 * (étape de suivi perdue, processus tué). L'agent est alors montré « prêt » et la question n'est plus une attente.
 */
export const PEREMPTION_APPEL_MS = 30 * 60 * 1000

const ID_RE = /^[a-z0-9-]+$/
const MAX_ID = 60
const MAX_QUOI = 200
const MAX_APPELS = 200

const idSur = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= MAX_ID && ID_RE.test(s)
const quoiNet = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').replaceAll('|', '/').trim().slice(0, MAX_QUOI).trim()
const liste = (l: Live | undefined): Live => (l && Array.isArray(l.appels) && Array.isArray(l.derniers) && Array.isArray(l.attentes) ? l : LIVE_VIDE)

/**
 * Identifiant d'agent du projet d'après le `subagent_type` de l'outil Agent : le préfixe de plugin (`plugin:agent`) est retiré.
 * `plugin` = nom de ce plugin quand on le connaît : seul son propre préfixe est alors accepté (l'agent d'un autre plugin qui
 * porterait le même identifiant n'est pas celui du projet) ; sinon tout préfixe est retiré, et seuls les agents DÉFINIS dans le projet comptent.
 * Null si ce n'est pas un agent du projet (agent intégré, autre plugin, valeur illisible).
 */
export function agentDeSousType(sousType: unknown, agentsProjet: { id: string }[], plugin?: string): string | null {
  if (typeof sousType !== 'string' || !Array.isArray(agentsProjet)) return null
  const i = sousType.lastIndexOf(':')
  const prefixe = i < 0 ? '' : sousType.slice(0, i)
  if (typeof plugin === 'string' && plugin !== '' && prefixe !== '' && prefixe !== plugin) return null
  const id = sousType.slice(i + 1).trim()
  return idSur(id) && agentsProjet.some(a => a?.id === id) ? id : null
}

/** Identifiant de l'appel d'outil ; vide s'il manque ou est illisible (un appel sans identifiant n'est jamais suivi). Ne lève jamais. */
export function cleDAppel(e: unknown): string {
  try {
    const cle = (e as { tool_use_id?: unknown } | null | undefined)?.tool_use_id
    return typeof cle === 'string' ? cle : ''
  } catch {
    return ''
  }
}

/** Issue d'un appel d'après ce que `next` a rendu : refus ou erreur = `erreur`, tout le reste (même rien) = `ok`. Ne lève jamais. */
export function classerResultat(r: unknown): 'ok' | 'erreur' {
  try {
    const x = r as { deny?: unknown; isError?: unknown } | null | undefined
    return x?.deny !== undefined || x?.isError === true ? 'erreur' : 'ok'
  } catch {
    return 'ok'
  }
}

/**
 * Appel qui rend la main alors que l'agent continue (`run_in_background`, isolation distante) : son retour ne dit rien de sa fin,
 * on n'écrit donc jamais « prêt » à ce moment-là. Ne lève jamais.
 */
export function appelEnFond(e: unknown): boolean {
  try {
    const x = e as { run_in_background?: unknown; isolation?: unknown } | null | undefined
    return x?.run_in_background === true || x?.isolation === 'remote'
  } catch {
    return false
  }
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
export function debutAttente(live: Live, cle: string, maintenant: number): Live {
  const l = liste(live)
  if (typeof cle !== 'string' || cle === '' || !Number.isFinite(maintenant)) return l
  if (l.attentes.some(a => a.cle === cle) || l.attentes.length >= MAX_APPELS) return l
  return { ...l, attentes: [...l.attentes, { cle, depuis: maintenant }] }
}

/** La question a reçu sa réponse (ou a échoué). Clé inconnue : rien ne change. */
export function finAttente(live: Live, cle: string): Live {
  const l = liste(live)
  return l.attentes.some(a => a.cle === cle) ? { ...l, attentes: l.attentes.filter(a => a.cle !== cle) } : l
}

const perime = (depuis: number, maintenant: number): boolean => Number.isFinite(maintenant) && maintenant - depuis > PEREMPTION_APPEL_MS

/** Une question est-elle en cours (de moins de 30 minutes) ? Ne lève jamais. */
export function attenteEnCours(live: Live, maintenant: number): boolean {
  return liste(live).attentes.some(a => !perime(a.depuis, maintenant))
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
      const vifs = appels.filter(a => !perime(a.depuis, maintenant))
      const choisis = vifs.length > 0 ? vifs : appels
      const dernier = choisis.reduce((a, b) => (b.depuis >= a.depuis ? b : a))
      // Appel périmé (jamais vu finir depuis plus de 30 minutes) : l'agent est montré prêt, pas en travail pour toujours.
      return { agent: id, etat: vifs.length > 0 ? 'en-travail' : 'pret', quoi: dernier.quoi, depuis: Math.min(...choisis.map(a => a.depuis)), source: 'live' }
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
