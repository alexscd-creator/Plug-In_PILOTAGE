// Modèle du projet (`projet.json`) : logique pure, sans fs ni process (les hooks tournent hors Node).
// Les pôles, phases et agents viennent des données : rien n'est codé en dur pour un jeu précis.

export type Pole = { id: string; titre: string }
export type PhaseDef = { id: string; titre: string; taches: string[] }
export type AgentDef = { id: string; titre: string; pole: string; skills: string[]; pourquoi: string }
export type Workflow = { outils: { role: string; outil: string }[] }
export type Projet = {
  version: 1
  nom: string
  but: string
  fini: string
  preset: string
  equipe: string[]
  poles: Pole[]
  phases: PhaseDef[]
  agents: AgentDef[]
  workflow: Workflow
}

export type ResultatProjet = { ok: true; projet: Projet } | { ok: false; erreurs: string[] }

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const texteNonVide = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''

const norme = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim()

/** Deux écritures d'un prénom (« Léa », « lea », « Jean-Luc », « jean luc ») désignent le même membre. */
export const memeMembre = (a: string, b: string): boolean =>
  norme(a).replace(/[-_0-9\s]+/g, ' ').trim() === norme(b).replace(/[-_0-9\s]+/g, ' ').trim()

function listeTextes(v: unknown, chemin: string, erreurs: string[]): string[] {
  if (!Array.isArray(v)) { erreurs.push(`${chemin} doit être une liste.`); return [] }
  const sortie: string[] = []
  v.forEach((x, i) => {
    if (typeof x !== 'string') erreurs.push(`${chemin}[${i + 1}] doit être un texte.`)
    else sortie.push(x)
  })
  return sortie
}

function listeObjets(v: unknown, chemin: string, erreurs: string[]): Record<string, unknown>[] {
  if (!Array.isArray(v)) { erreurs.push(`${chemin} doit être une liste.`); return [] }
  const sortie: Record<string, unknown>[] = []
  v.forEach((x, i) => {
    if (!estObjet(x)) erreurs.push(`${chemin}[${i + 1}] doit être un objet.`)
    else sortie.push(x)
  })
  return sortie
}

function doublons(ids: string[], chemin: string, erreurs: string[]): void {
  const vus = new Set<string>()
  for (const id of ids) {
    if (vus.has(id)) erreurs.push(`${chemin} : l'identifiant « ${id} » est utilisé deux fois.`)
    vus.add(id)
  }
}

export function parseProjet(texte: string): ResultatProjet {
  const erreurs: string[] = []
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch (e) {
    return { ok: false, erreurs: [`Le fichier projet n'est pas du JSON valide (${e instanceof Error ? e.message : 'erreur inconnue'}).`] }
  }
  if (!estObjet(brut)) return { ok: false, erreurs: ['Le fichier projet doit contenir un objet JSON.'] }

  if (brut.version !== 1) erreurs.push(`La version doit valoir 1 (trouvé : ${JSON.stringify(brut.version) ?? 'absente'}).`)
  const champ = (cle: 'nom' | 'but' | 'fini' | 'preset'): string => {
    const v = brut[cle]
    if (!texteNonVide(v)) { erreurs.push(`Le champ « ${cle} » doit être un texte non vide.`); return '' }
    return v
  }
  const nom = champ('nom'), but = champ('but'), fini = champ('fini'), preset = champ('preset')

  const equipe = listeTextes(brut.equipe, "L'équipe", erreurs)
  if (Array.isArray(brut.equipe)) {
    if (equipe.length < 1 || equipe.length > 3) erreurs.push(`L'équipe doit compter de 1 à 3 membres (trouvé : ${equipe.length}).`)
    if (equipe.some(m => m.trim() === '')) erreurs.push("L'équipe contient un prénom vide.")
    for (let i = 0; i < equipe.length; i++) for (let j = i + 1; j < equipe.length; j++)
      if (memeMembre(equipe[i]!, equipe[j]!)) erreurs.push(`L'équipe : « ${equipe[i]} » et « ${equipe[j]} » désignent le même membre.`)
  }

  const poles: Pole[] = listeObjets(brut.poles, 'Les pôles', erreurs).map((o, i) => {
    if (!texteNonVide(o.id)) erreurs.push(`Pôle ${i + 1} : l'identifiant est manquant.`)
    if (!texteNonVide(o.titre)) erreurs.push(`Pôle ${i + 1} : le titre est manquant.`)
    return { id: texteNonVide(o.id) ? o.id : '', titre: texteNonVide(o.titre) ? o.titre : '' }
  })
  doublons(poles.map(p => p.id).filter(Boolean), 'Pôles', erreurs)

  const phases: PhaseDef[] = listeObjets(brut.phases, 'Les phases', erreurs).map((o, i) => {
    if (!texteNonVide(o.id)) erreurs.push(`Phase ${i + 1} : l'identifiant est manquant.`)
    if (!texteNonVide(o.titre)) erreurs.push(`Phase ${i + 1} : le titre est manquant.`)
    const taches = listeTextes(o.taches, `Phase ${i + 1} : les tâches`, erreurs)
    return { id: texteNonVide(o.id) ? o.id : '', titre: texteNonVide(o.titre) ? o.titre : '', taches }
  })
  doublons(phases.map(p => p.id).filter(Boolean), 'Phases', erreurs)

  const idsPoles = new Set(poles.map(p => p.id))
  const agents: AgentDef[] = listeObjets(brut.agents, 'Les agents', erreurs).map((o, i) => {
    if (!texteNonVide(o.id)) erreurs.push(`Agent ${i + 1} : l'identifiant est manquant.`)
    if (!texteNonVide(o.titre)) erreurs.push(`Agent ${i + 1} : le titre est manquant.`)
    if (!texteNonVide(o.pole)) erreurs.push(`Agent ${i + 1} : le pôle est manquant.`)
    else if (!idsPoles.has(o.pole)) erreurs.push(`Agent ${i + 1} : le pôle « ${o.pole} » n'existe pas.`)
    if (typeof o.pourquoi !== 'string') erreurs.push(`Agent ${i + 1} : « pourquoi » doit être un texte.`)
    const skills = listeTextes(o.skills, `Agent ${i + 1} : les skills`, erreurs)
    return {
      id: texteNonVide(o.id) ? o.id : '', titre: texteNonVide(o.titre) ? o.titre : '',
      pole: texteNonVide(o.pole) ? o.pole : '', skills, pourquoi: typeof o.pourquoi === 'string' ? o.pourquoi : '',
    }
  })
  doublons(agents.map(a => a.id).filter(Boolean), 'Agents', erreurs)

  const outils: { role: string; outil: string }[] = []
  if (!estObjet(brut.workflow)) erreurs.push('Le workflow doit être un objet.')
  else listeObjets(brut.workflow.outils, 'Les outils du workflow', erreurs).forEach((o, i) => {
    if (!texteNonVide(o.role) || !texteNonVide(o.outil)) erreurs.push(`Outil ${i + 1} du workflow : « role » et « outil » sont requis.`)
    else outils.push({ role: o.role, outil: o.outil })
  })

  if (erreurs.length) return { ok: false, erreurs }
  return { ok: true, projet: { version: 1, nom, but, fini, preset, equipe, poles, phases, agents, workflow: { outils } } }
}

/** JSON indenté, clés dans un ordre fixe. */
export function serializeProjet(p: Projet): string {
  const o = {
    version: p.version, nom: p.nom, but: p.but, fini: p.fini, preset: p.preset, equipe: p.equipe,
    poles: p.poles.map(x => ({ id: x.id, titre: x.titre })),
    phases: p.phases.map(x => ({ id: x.id, titre: x.titre, taches: x.taches })),
    agents: p.agents.map(x => ({ id: x.id, titre: x.titre, pole: x.pole, skills: x.skills, pourquoi: x.pourquoi })),
    workflow: { outils: p.workflow.outils.map(x => ({ role: x.role, outil: x.outil })) },
  }
  return JSON.stringify(o, null, 2) + '\n'
}
