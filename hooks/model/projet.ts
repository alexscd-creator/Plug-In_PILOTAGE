// Modèle du projet (`projet.json`) : logique pure, sans fs ni process (les hooks tournent hors Node).
// Les pôles, phases et agents viennent des données : rien n'est codé en dur pour un type de projet précis.

/** Teintes de pôle de la maquette (palette `color/pole/<teinte>`). */
export const TEINTES_POLE = ['violet', 'bleu', 'sarcelle', 'vert', 'orange', 'rose'] as const
export type Pole = { id: string; titre: string; couleur?: string }
export type PhaseDef = { id: string; titre: string; taches: string[] }
/** `outils` : outils que l'agent demande en plus de la lecture seule (le moteur n'en accorde jamais de Bash ni de publication, voir agents-registre.ts). */
export type AgentDef = { id: string; titre: string; pole: string; skills: string[]; pourquoi: string; outils?: string[]
  /** Faux : l'agent est désactivé (non enregistré, grisé). Absent : actif. */
  actif?: boolean }
export type Workflow = { outils: { role: string; outil: string }[] }
/** Libellés affichés dans l'interface : ils suivent le type de projet (« Nom du site », « Nom de l'application »...). */
export type Vocabulaire = { type: string; nomDuProjet: string; leProjet: string; unProjet: string; objectif: string; fini: string }
/** Réglage propre à un type de projet : sa définition (les valeurs sont dans `reglages`). */
export type ReglageDef = { id: string; libelle: string; genre: 'texte' | 'choix' | 'oui-non'; options?: string[]; defaut?: string | boolean; aide?: string }
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
  vocabulaire: Vocabulaire
  reglagesDef: ReglageDef[]
  reglages: Record<string, string | boolean>
}

/** Vocabulaire neutre : celui d'un fichier de projet qui n'en a pas (version 1 plus ancienne ou écrite à la main). */
export const DEFAUT_VOCABULAIRE: Vocabulaire = {
  type: 'Projet', nomDuProjet: 'Nom du projet', leProjet: 'le projet', unProjet: 'un projet',
  objectif: 'Objectif du projet', fini: 'Ce que « fini » veut dire',
}
const CLES_VOCABULAIRE = ['type', 'nomDuProjet', 'leProjet', 'unProjet', 'objectif', 'fini'] as const
const GENRES = ['texte', 'choix', 'oui-non'] as const
const ID_REGLAGE = /^[a-z0-9-]+$/
const MAX_ID_REGLAGE = 60
const MAX_VALEUR = 500
const MAX_TITRE = 200
// Plafonds des textes qui finissent dans le prompt d'un agent (voir agents-registre.ts).
const MAX_POURQUOI = 500
const MAX_SKILL = 60
const MAX_SKILLS = 20
const MAX_FLUX = 120
const MAX_LIGNES_FLUX = 30

export type ResultatProjet = { ok: true; projet: Projet } | { ok: false; erreurs: string[] }

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const texteNonVide = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
/** Signale un texte trop long (le début seul est cité dans l'erreur). */
const trop = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > max

// --- LA règle des prénoms (dossier d'un membre et comparaison), partagée par les scripts (qui l'importent) et par le panneau ---
/** Lettres que NFD ne décompose pas, ramenées à des lettres a-z (minuscules : `plier` passe en minuscules avant). */
const LETTRES: Record<string, string> = { ø: 'o', ł: 'l', æ: 'ae', œ: 'oe', ß: 'ss', đ: 'd', ð: 'd', þ: 'th', ı: 'i' }
/** Minuscules sans accent, lettres non décomposables remplacées (Ø → o, Ł → l, Æ → ae, Œ → oe, ß → ss, Đ/Ð → d, Þ → th, ı → i). */
export const plier = (s: string): string =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[øłæœßđðþı]/g, c => LETTRES[c] ?? c)
/** Le dossier d'un membre (`.pilotage/equipe/<dossier>`) : `plier`, puis a-z, 0-9 et tirets seulement ('' si rien ne reste). */
export const dossierMembre = (prenom: string): string => plier(prenom).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
/** Vrai si des lettres du prénom se perdraient dans son nom de dossier (écriture non latine, par exemple). */
export const prenomPerdDesLettres = (prenom: string): boolean => /[^\x00-\x7f]/.test(plier(prenom).replace(/[^\p{L}\p{N}]/gu, ''))
const cleMembre = (s: string): string => plier(s).replace(/[^a-z]+/g, ' ').trim()

/**
 * Deux écritures d'un prénom (« Léa », « lea », « Jean-Luc », « jean luc », « Ølaf », « olaf ») désignent le même membre : même règle
 * que `dossierMembre`, donc un prénom et son dossier se reconnaissent toujours. Sans aucune lettre a-z (écriture non latine), on compare
 * les textes pliés tels quels.
 */
export const memeMembre = (a: string, b: string): boolean => {
  const ka = cleMembre(a), kb = cleMembre(b)
  return ka !== '' || kb !== '' ? ka === kb : plier(a).replace(/\s+/g, ' ').trim() === plier(b).replace(/\s+/g, ' ').trim()
}
/** Le dossier d'un membre parmi ceux de `equipe/` : son nom exact (`dossierMembre`) d'abord, sinon le premier que `memeMembre` reconnaît. */
export const dossierDe = (prenom: string, dossiers: string[]): string | undefined =>
  dossiers.find(d => d === dossierMembre(prenom)) ?? dossiers.find(d => memeMembre(prenom, d))

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

function lireVocabulaire(v: unknown, erreurs: string[]): Vocabulaire {
  if (v === undefined) return { ...DEFAUT_VOCABULAIRE }
  if (!estObjet(v)) { erreurs.push('Le vocabulaire doit être un objet.'); return { ...DEFAUT_VOCABULAIRE } }
  const sortie = { ...DEFAUT_VOCABULAIRE }
  for (const cle of CLES_VOCABULAIRE) {
    const x = v[cle]
    if (!texteNonVide(x)) erreurs.push(`Le vocabulaire : « ${cle} » doit être un texte non vide.`)
    else sortie[cle] = x
  }
  return sortie
}

function lireReglagesDef(v: unknown, erreurs: string[]): ReglageDef[] {
  if (v === undefined) return []
  const defs: ReglageDef[] = []
  listeObjets(v, 'reglagesDef', erreurs).forEach((o, i) => {
    const n = `Réglage ${i + 1}`
    let ok = true
    const faux = (m: string) => { erreurs.push(`${n} : ${m}`); ok = false }
    if (!texteNonVide(o.id)) faux("l'identifiant est manquant.")
    else if (o.id.length > MAX_ID_REGLAGE) faux(`l'identifiant « ${o.id.slice(0, 30)}... » dépasse ${MAX_ID_REGLAGE} caractères.`)
    else if (!ID_REGLAGE.test(o.id)) faux(`l'identifiant « ${o.id.slice(0, 30)} » doit s'écrire en minuscules, chiffres et tirets seulement.`)
    if (!texteNonVide(o.libelle)) faux('le libellé est manquant.')
    else if (trop(o.libelle, MAX_TITRE)) faux(`le libellé dépasse ${MAX_TITRE} caractères.`)
    const genre = GENRES.find(g => g === o.genre)
    if (!genre) faux(`le genre doit être « texte », « choix » ou « oui-non » (trouvé : ${JSON.stringify(o.genre) ?? 'absent'}).`)
    let options: string[] | undefined
    if (genre === 'choix') {
      if (!Array.isArray(o.options) || o.options.length === 0 || o.options.some(x => !texteNonVide(x))) faux('les options doivent être une liste non vide de textes non vides.')
      else options = o.options as string[]
    } else if (o.options !== undefined) faux("les options ne servent qu'au genre « choix ».")
    let defaut: string | boolean | undefined
    if (o.defaut !== undefined) {
      if (genre === 'oui-non' && typeof o.defaut === 'boolean') defaut = o.defaut
      else if (genre === 'texte' && typeof o.defaut === 'string') defaut = o.defaut
      else if (genre === 'choix' && typeof o.defaut === 'string' && options?.includes(o.defaut)) defaut = o.defaut
      else if (genre) faux(`le défaut ne convient pas au genre « ${genre} »${genre === 'choix' ? ' (il doit être une des options)' : ''}.`)
    }
    if (o.aide !== undefined && typeof o.aide !== 'string') faux("l'aide doit être un texte.")
    if (!ok || !genre) return
    const def: ReglageDef = { id: o.id as string, libelle: o.libelle as string, genre }
    if (options) def.options = [...options]
    if (defaut !== undefined) def.defaut = defaut
    if (typeof o.aide === 'string') def.aide = o.aide
    defs.push(def)
  })
  doublons(defs.map(d => d.id), 'Réglages', erreurs)
  return defs
}

function lireReglages(v: unknown, defs: ReglageDef[], erreurs: string[]): Record<string, string | boolean> {
  if (v === undefined) return {}
  if (!estObjet(v)) { erreurs.push('Les valeurs de réglages (reglages) doivent former un objet.'); return {} }
  const sortie: Record<string, string | boolean> = {}
  for (const def of defs) {
    if (!Object.hasOwn(v, def.id)) continue
    const x = v[def.id]
    if (trop(x, MAX_VALEUR)) erreurs.push(`Réglage « ${def.id} » : la valeur dépasse ${MAX_VALEUR} caractères.`)
    else if (def.genre === 'oui-non' && typeof x !== 'boolean') erreurs.push(`Réglage « ${def.id} » : la valeur doit être oui ou non (vrai ou faux).`)
    else if (def.genre === 'texte' && typeof x !== 'string') erreurs.push(`Réglage « ${def.id} » : la valeur doit être un texte.`)
    else if (def.genre === 'choix' && !(typeof x === 'string' && def.options?.includes(x))) erreurs.push(`Réglage « ${def.id} » : la valeur doit être une des options (${(def.options ?? []).join(', ')}).`)
    else sortie[def.id] = x as string | boolean
  }
  const connus = new Set(defs.map(d => d.id))
  for (const id of Object.keys(v)) if (!connus.has(id)) erreurs.push(`Réglage « ${id.slice(0, 30)} » : aucune définition dans reglagesDef.`)
  return sortie
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
    if (cle === 'nom' && v.length > MAX_TITRE) { erreurs.push(`Le champ « nom » dépasse ${MAX_TITRE} caractères.`); return '' }
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
    else if (trop(o.titre, MAX_TITRE)) erreurs.push(`Pôle ${i + 1} : le titre dépasse ${MAX_TITRE} caractères.`)
    let couleur: string | undefined
    if (o.couleur !== undefined) {
      if (typeof o.couleur === 'string' && (TEINTES_POLE as readonly string[]).includes(o.couleur)) couleur = o.couleur
      else erreurs.push(`Pôle ${i + 1} : la couleur doit être une de ${TEINTES_POLE.join(', ')}.`)
    }
    return { id: texteNonVide(o.id) ? o.id : '', titre: texteNonVide(o.titre) ? o.titre : '', ...(couleur ? { couleur } : {}) }
  })
  {
    const vues = new Set<string>()
    for (const p of poles) {
      if (!p.couleur) continue
      if (vues.has(p.couleur)) erreurs.push(`Pôles : la teinte « ${p.couleur} » est donnée à deux pôles.`)
      vues.add(p.couleur)
    }
  }
  doublons(poles.map(p => p.id).filter(Boolean), 'Pôles', erreurs)

  const phases: PhaseDef[] = listeObjets(brut.phases, 'Les phases', erreurs).map((o, i) => {
    if (!texteNonVide(o.id)) erreurs.push(`Phase ${i + 1} : l'identifiant est manquant.`)
    if (!texteNonVide(o.titre)) erreurs.push(`Phase ${i + 1} : le titre est manquant.`)
    else if (trop(o.titre, MAX_TITRE)) erreurs.push(`Phase ${i + 1} : le titre dépasse ${MAX_TITRE} caractères.`)
    const taches = listeTextes(o.taches, `Phase ${i + 1} : les tâches`, erreurs)
    return { id: texteNonVide(o.id) ? o.id : '', titre: texteNonVide(o.titre) ? o.titre : '', taches }
  })
  doublons(phases.map(p => p.id).filter(Boolean), 'Phases', erreurs)

  const idsPoles = new Set(poles.map(p => p.id))
  const agents: AgentDef[] = listeObjets(brut.agents, 'Les agents', erreurs).map((o, i) => {
    if (!texteNonVide(o.id)) erreurs.push(`Agent ${i + 1} : l'identifiant est manquant.`)
    if (!texteNonVide(o.titre)) erreurs.push(`Agent ${i + 1} : le titre est manquant.`)
    else if (trop(o.titre, MAX_TITRE)) erreurs.push(`Agent ${i + 1} : le titre dépasse ${MAX_TITRE} caractères.`)
    if (!texteNonVide(o.pole)) erreurs.push(`Agent ${i + 1} : le pôle est manquant.`)
    else if (!idsPoles.has(o.pole)) erreurs.push(`Agent ${i + 1} : le pôle « ${o.pole} » n'existe pas.`)
    if (typeof o.pourquoi !== 'string') erreurs.push(`Agent ${i + 1} : « pourquoi » doit être un texte.`)
    else if (trop(o.pourquoi, MAX_POURQUOI)) erreurs.push(`Agent ${i + 1} : « pourquoi » dépasse ${MAX_POURQUOI} caractères.`)
    const skills = listeTextes(o.skills, `Agent ${i + 1} : les skills`, erreurs)
    if (skills.length > MAX_SKILLS) erreurs.push(`Agent ${i + 1} : au plus ${MAX_SKILLS} skills (trouvé : ${skills.length}).`)
    skills.forEach((s, k) => { if (trop(s, MAX_SKILL)) erreurs.push(`Agent ${i + 1} : le skill ${k + 1} dépasse ${MAX_SKILL} caractères.`) })
    const outils = o.outils === undefined ? [] : listeTextes(o.outils, `Agent ${i + 1} : les outils`, erreurs)
    if (o.actif !== undefined && typeof o.actif !== 'boolean') erreurs.push(`Agent ${i + 1} : « actif » doit être vrai ou faux.`)
    return {
      id: texteNonVide(o.id) ? o.id : '', titre: texteNonVide(o.titre) ? o.titre : '',
      pole: texteNonVide(o.pole) ? o.pole : '', skills, pourquoi: typeof o.pourquoi === 'string' ? o.pourquoi : '',
      ...(outils.length > 0 ? { outils } : {}),
      ...(o.actif === false ? { actif: false } : {}),
    }
  })
  doublons(agents.map(a => a.id).filter(Boolean), 'Agents', erreurs)

  const outils: { role: string; outil: string }[] = []
  if (!estObjet(brut.workflow)) erreurs.push('Le workflow doit être un objet.')
  else listeObjets(brut.workflow.outils, 'Les outils du workflow', erreurs).forEach((o, i) => {
    if (!texteNonVide(o.role) || !texteNonVide(o.outil)) erreurs.push(`Outil ${i + 1} du workflow : « role » et « outil » sont requis.`)
    else if (trop(o.role, MAX_FLUX) || trop(o.outil, MAX_FLUX)) erreurs.push(`Outil ${i + 1} du workflow : « role » et « outil » dépassent ${MAX_FLUX} caractères.`)
    else outils.push({ role: o.role, outil: o.outil })
  })
  if (Array.isArray((brut.workflow as { outils?: unknown } | undefined)?.outils) && (brut.workflow as { outils: unknown[] }).outils.length > MAX_LIGNES_FLUX) {
    erreurs.push(`Le workflow : au plus ${MAX_LIGNES_FLUX} outils (trouvé : ${(brut.workflow as { outils: unknown[] }).outils.length}).`)
  }

  const vocabulaire = lireVocabulaire(brut.vocabulaire, erreurs)
  const reglagesDef = lireReglagesDef(brut.reglagesDef, erreurs)
  const reglages = lireReglages(brut.reglages, reglagesDef, erreurs)

  if (erreurs.length) return { ok: false, erreurs }
  return { ok: true, projet: { version: 1, nom, but, fini, preset, equipe, poles, phases, agents, workflow: { outils }, vocabulaire, reglagesDef, reglages } }
}

/** JSON indenté, clés dans un ordre fixe. */
export function serializeProjet(p: Projet): string {
  const o = {
    version: p.version, nom: p.nom, but: p.but, fini: p.fini, preset: p.preset, equipe: p.equipe,
    poles: p.poles.map(x => ({ id: x.id, titre: x.titre, ...(x.couleur ? { couleur: x.couleur } : {}) })),
    phases: p.phases.map(x => ({ id: x.id, titre: x.titre, taches: x.taches })),
    agents: p.agents.map(x => ({ id: x.id, titre: x.titre, pole: x.pole, skills: x.skills, pourquoi: x.pourquoi, ...(x.outils?.length ? { outils: x.outils } : {}), ...(x.actif === false ? { actif: false } : {}) })),
    workflow: { outils: p.workflow.outils.map(x => ({ role: x.role, outil: x.outil })) },
    vocabulaire: CLES_VOCABULAIRE.reduce((acc, k) => ({ ...acc, [k]: (p.vocabulaire ?? DEFAUT_VOCABULAIRE)[k] }), {} as Vocabulaire),
    reglagesDef: (p.reglagesDef ?? []).map(d => ({
      id: d.id, libelle: d.libelle, genre: d.genre,
      ...(d.options ? { options: [...d.options] } : {}), ...(d.defaut !== undefined ? { defaut: d.defaut } : {}), ...(d.aide !== undefined ? { aide: d.aide } : {}),
    })),
    reglages: Object.fromEntries((p.reglagesDef ?? []).filter(d => p.reglages && Object.hasOwn(p.reglages, d.id)).map(d => [d.id, p.reglages[d.id]])),
  }
  return JSON.stringify(o, null, 2) + '\n'
}
