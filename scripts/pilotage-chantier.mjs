// Écrit les chantiers de l'équipe : fiches `equipe/<prénom>/chantiers/<id>.md`, archives, liens de session, tâches du plan, portes de phase.
// Usage : node scripts/pilotage-chantier.mjs <dossier> <action> <json | fichier.json> [--membre <prénom>] [--force-report] [--confirme]
// Actions (le JSON dit quoi) :
//   creer         {id?, titre, pole?, phase?, etat?, session?, agents?, taches?, fichiers?, passation?}  nouvelle fiche, jamais d'écrasement
//   maj           {id, etat?, agent?, tache?, fichier?, passation?}   met la fiche à jour (`maj` = maintenant) ; `termine` seulement par `archiver`
//   lier-session  {id, sessionId?, nom?}   `equipe/<prénom>/sessions.json` : { "<id de session>": "<id du chantier>" } ; `nom` : nom de la sous-session dans la fiche
//   archiver      {id, passation}  fiche déplacée dans `archive/`, état `termine` ; refusé tant que des tâches « a faire » ou « en cours » restent, sauf `--force-report` (elles passent à `reporte`)
//   tache         {id, statut}     statut d'une tâche du plan partagé `.pilotage/plan.md`, modifié EN PLACE (seule la marque de la ligne change, le reste du fichier est conservé) ; --membre facultatif
//   porte         {phase, mode: valider|forcer|repondre, note?}   `equipe/<prénom>/portes.md` ; `forcer` et `repondre` exigent `--confirme` ; `valider` et `forcer` exigent qu'aucune tâche de la phase soit ouverte
// Hors `tache`, rien n'est écrit en dehors de `.pilotage/equipe/<prénom>/` (le prénom est celui de `--membre`, vérifié contre l'équipe de projet.json).
// Codes : 0 ok ; 1 entrée invalide (rien n'est écrit) ; 3 existe déjà ou déjà lié (rien n'est écrit) ; 4 écriture impossible (tout est remis comme avant) ;
//   5 dossier introuvable, qui n'est pas un dossier, ou sans projet ; 64 usage incorrect.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ID, Transaction, dossierExistant, echec, erreursNom, importerModele, ligne, slug } from './lib/ecriture.mjs'

const USAGE = 'usage : node scripts/pilotage-chantier.mjs <dossier> <creer|maj|lier-session|archiver|tache|porte> <json | fichier.json> [--membre <prénom>] [--force-report] [--confirme]'
const ACTIONS = ['creer', 'maj', 'lier-session', 'archiver', 'tache', 'porte']
const MAX_JSON = 64 * 1024
const MAX_TEXTE = 200, MAX_PASSATION = 4000, MAX_TACHES = 100, MAX_AGENTS = 20, MAX_FICHIERS = 200
const ETATS = ['en-travail', 'attente', 'arrete', 'pret', 'bloque', 'termine']
const STATUTS = ['a faire', 'en cours', 'termine', 'reporte', 'abandonne']
const TACHE_RE = /^(\s*[-*]\s+\[.?\]\s+)(.*)$/ // même grammaire de ligne de tâche que plan.ts
const MARQUES = { 'a faire': ' ', 'en cours': '~', termine: 'x', reporte: '>', abandonne: '-' }
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/

// --- arguments ------------------------------------------------------------------------------------------------------
const positionnels = []
const options = { membre: '', forceReport: false, confirme: false }
{
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--membre') { options.membre = args[++i] ?? ''; if (options.membre === '') usage() }
    else if (a === '--force-report') options.forceReport = true
    else if (a === '--confirme') options.confirme = true
    else if (a.startsWith('--')) usage(`option inconnue : ${a.slice(0, 30)}`)
    else positionnels.push(a)
  }
}
function usage(message) { console.error((message ? message + '\n' : '') + USAGE); process.exit(64) }
const [dossierArg, action, jsonArg] = positionnels
if (positionnels.length !== 3 || !ACTIONS.includes(action)) usage()
if (action !== 'tache' && options.membre === '') usage('--membre <prénom> est obligatoire pour cette action.')

const [chantierModele, planModele, phasesModele, projetModele] = await importerModele(['chantier', 'plan', 'phases', 'projet'], 4)
const { parseChantier, serializeChantier, validerChantier } = chantierModele
const { parsePlan, portePossible } = planModele
const { lirePortes, serializePortes } = phasesModele
const { parseProjet, memeMembre } = projetModele

const tx = new Transaction()

// --- aides ----------------------------------------------------------------------------------------------------------
const estObjet = v => typeof v === 'object' && v !== null && !Array.isArray(v)
const maintenant = () => new Date().toISOString()
const court = s => String(s).slice(0, 40)
const cheminSur = f => typeof f === 'string' && f !== '' && f.length <= 260 && !/^[/\\]|^[a-zA-Z]:|[\\\0:|]|[\r\n]/.test(f) && !f.split('/').includes('..')
const sain = s => ligne(s).replace(/\|/g, '/')

function lireJson() {
  let brut = jsonArg
  let depuisFichier = false
  if (!/^\s*[[{"]/.test(brut)) {
    try {
      if (statSync(resolve(brut)).size > MAX_JSON) echec(`Le fichier JSON dépasse ${MAX_JSON / 1024} Ko.`)
      brut = readFileSync(resolve(brut), 'utf8')
      depuisFichier = true
    } catch {
      echec('Les données ne sont ni du JSON ni un fichier JSON lisible.')
    }
  }
  if (brut.length > MAX_JSON) echec(`Les données dépassent ${MAX_JSON / 1024} Ko.`)
  let v
  // Le message d'erreur de JSON.parse cite le début du texte : jamais repris (le fichier peut contenir autre chose que du JSON).
  try { v = JSON.parse(brut) } catch { echec(depuisFichier ? "Le fichier d'entrée n'est pas un JSON valide." : 'Les données ne sont pas du JSON valide.') }
  if (!estObjet(v)) echec('Les données doivent être un objet JSON.')
  return v
}

function chargerProjet(dossier) {
  const f = join(dossier, '.pilotage', 'projet.json')
  if (!existsSync(f)) echec(`Aucun projet Pilotage dans « ${dossier} » (.pilotage/projet.json absent) : rien n'est écrit.`, 5)
  let r
  try { r = parseProjet(readFileSync(f, 'utf8')) } catch (e) { echec(`Le fichier projet est illisible (${e instanceof Error ? e.message : 'erreur inconnue'}).`) }
  if (!r.ok) echec(r.erreurs)
  return r.projet
}

function nomMembre(projet) {
  const m = projet.equipe.find(x => memeMembre(x, options.membre))
  if (!m) echec(`« ${court(options.membre)} » ne fait pas partie de l'équipe (${projet.equipe.join(', ')}) : rien n'est écrit.`)
  const sl = slug(m)
  const e = sl === '' ? ['Le prénom ne donne aucun nom de dossier valide.'] : erreursNom('Le dossier du membre', sl)
  if (e.length) echec(e)
  return { prenom: m, sl }
}

function identifiant(valeur, quoi = 'L\'identifiant du chantier') {
  if (typeof valeur !== 'string' || !ID.test(valeur)) echec(`${quoi} doit s'écrire en minuscules, chiffres et tirets seulement (60 caractères au plus).`)
  const e = erreursNom(quoi, valeur)
  if (e.length) echec(e)
  return valeur
}

function texte(valeur, quoi, { vide = false, max = MAX_TEXTE } = {}) {
  if (typeof valeur !== 'string') echec(`${quoi} doit être un texte.`)
  if (valeur.length > max) echec(`${quoi} dépasse ${max} caractères.`)
  if (!vide && ligne(valeur) === '') echec(`${quoi} est vide.`)
  return valeur
}
const etatValide = (v, quoi) => { if (!ETATS.includes(v)) echec(`${quoi} « ${court(v)} » est inconnu (attendus : ${ETATS.join(', ')}).`); return v }
const statutValide = (v, quoi) => { if (!STATUTS.includes(v)) echec(`${quoi} « ${court(v)} » est inconnu (attendus : ${STATUTS.join(', ')}).`); return v }

/** La fiche, relue telle qu'elle serait écrite : mêmes tâches, agents et fichiers, rien d'écarté, titre non vide. */
function verifierRelecture(c, prenom) {
  const e = validerChantier(c)
  if (e.length) echec(e)
  const sortie = serializeChantier(c)
  const r = parseChantier(sortie, prenom)
  if (!r.ok) echec(['La fiche ne pourrait pas être relue :', ...r.erreurs])
  const n = r.chantier
  if (r.avertissements.length || n.taches.length !== c.taches.length || n.agents.length !== c.agents.length || n.fichiers.length !== c.fichiers.length || n.titre === '')
    echec('La fiche contient des éléments qui ne seraient pas relus (titre vide, chemin de fichier non sûr, ligne non valide) : rien n\'est écrit.')
  return sortie
}

function ficheExistante(racine, id, prenom) {
  const f = join(racine, 'chantiers', `${id}.md`)
  if (!existsSync(f)) {
    echec(existsSync(join(racine, 'archive', `${id}.md`)) ? `Le chantier « ${id} » est archivé : il ne se modifie plus.` : `Le chantier « ${id} » est introuvable chez ${prenom} (on n'écrit que chez soi).`)
  }
  let r
  try { r = parseChantier(readFileSync(f, 'utf8'), prenom) } catch (e) { echec(`La fiche « ${id} » est illisible (${e instanceof Error ? e.message : 'erreur inconnue'}).`) }
  if (!r.ok) echec([`La fiche « ${id} » est invalide, rien n'est modifié :`, ...r.erreurs])
  return { f, c: r.chantier, avertissements: r.avertissements }
}

function lireSessions(racine) {
  const f = join(racine, 'sessions.json')
  const carte = Object.create(null)
  if (!existsSync(f)) return { f, carte, existe: false }
  let v
  try { v = JSON.parse(readFileSync(f, 'utf8')) } catch { echec('sessions.json est illisible (JSON invalide) : rien n\'est modifié, le corriger ou le supprimer à la main.') }
  if (!estObjet(v)) echec('sessions.json doit être un objet { "<id de session>": "<id du chantier>" } : rien n\'est modifié.')
  for (const [k, val] of Object.entries(v)) if (typeof val === 'string') carte[k] = val
  return { f, carte, existe: true }
}
const texteSessions = carte => JSON.stringify(Object.fromEntries(Object.entries(carte).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n'

function ouvertes(taches) {
  return taches.filter(t => t.statut === 'a faire' || t.statut === 'en cours')
}
function refuserOuvertes(liste, debut) {
  echec([debut, ...liste.map(t => `  - ${t.id ? t.id + ' : ' : ''}${t.titre} (${t.statut})`)])
}

// --- actions --------------------------------------------------------------------------------------------------------
function principal() {
  const dossier = dossierExistant(dossierArg)
  const donnees = lireJson()
  const projet = chargerProjet(dossier)
  const pilotage = join(dossier, '.pilotage')
  const membre = action === 'tache' && options.membre === '' ? null : nomMembre(projet)
  const racine = membre ? join(pilotage, 'equipe', membre.sl) : ''
  const rel = f => f.slice(dossier.length + 1).replaceAll('\\', '/')
  switch (action) {
    case 'creer': return creer(donnees, projet, membre, racine, rel)
    case 'maj': return maj(donnees, projet, membre, racine, rel)
    case 'lier-session': return lierSession(donnees, membre, racine, rel)
    case 'archiver': return archiver(donnees, membre, racine, rel)
    case 'tache': return tache(donnees, projet, pilotage, rel)
    case 'porte': return porte(donnees, projet, membre, pilotage, racine, rel)
  }
}

function creer(d, projet, membre, racine, rel) {
  const titre = texte(d.titre, 'Le titre du chantier')
  let id = d.id
  if (id === undefined) {
    id = slug(titre).slice(0, 60).replace(/-+$/, '')
    if (id === '') echec('Le titre ne donne aucun identifiant valide : donner un « id ».')
  }
  identifiant(id)
  const pole = d.pole === undefined ? '' : texte(d.pole, 'Le pôle', { vide: true })
  if (pole !== '' && !projet.poles.some(p => p.id === pole)) echec(`Le pôle « ${court(pole)} » n'existe pas dans le projet.`)
  const phase = d.phase === undefined ? '' : texte(d.phase, 'La phase', { vide: true })
  if (phase !== '' && !projet.phases.some(p => p.id === phase)) echec(`La phase « ${court(phase)} » n'existe pas dans le projet.`)
  const etat = d.etat === undefined ? 'attente' : etatValide(d.etat, 'L\'état')
  if (etat === 'termine') echec('Un chantier ne naît pas « termine » : l\'état « termine » vient de l\'archivage.')
  const session = d.session === undefined ? id : texte(d.session, 'Le nom de session', { vide: true })
  const passation = d.passation === undefined ? '' : texte(d.passation, 'La passation', { vide: true, max: MAX_PASSATION })
  const liste = (v, quoi, max) => {
    if (v === undefined) return []
    if (!Array.isArray(v)) echec(`${quoi} doit être une liste.`)
    if (v.length > max) echec(`${quoi} : ${max} éléments au plus.`)
    return v
  }
  const agents = liste(d.agents, 'Les agents', MAX_AGENTS).map(a => {
    if (!estObjet(a)) echec('Chaque agent doit être un objet {id, etat?, quoi?}.')
    if (typeof a.id !== 'string' || !projet.agents.some(x => x.id === a.id)) echec(`L'agent « ${court(a.id)} » n'existe pas dans le projet.`)
    return { id: a.id, etat: a.etat === undefined ? etat : etatValide(a.etat, 'L\'état de l\'agent'), quoi: a.quoi === undefined ? '' : texte(a.quoi, 'La tâche de l\'agent', { vide: true }) }
  })
  const taches = liste(d.taches, 'Les tâches', MAX_TACHES).map(t => {
    if (typeof t === 'string') return { titre: texte(t, 'Le titre d\'une tâche'), statut: 'a faire' }
    if (!estObjet(t)) echec('Chaque tâche doit être un texte ou un objet {titre, statut?}.')
    return { titre: texte(t.titre, 'Le titre d\'une tâche'), statut: t.statut === undefined ? 'a faire' : statutValide(t.statut, 'Le statut de la tâche') }
  })
  const fichiers = liste(d.fichiers, 'Les fichiers', MAX_FICHIERS).map(f => {
    if (!cheminSur(f)) echec(`Le fichier « ${court(f)} » n'est pas un chemin relatif au projet (ni « .. », ni chemin absolu, ni « \\ »).`)
    return f
  })
  const date = maintenant()
  const c = { id, titre, pole, phase, etat, session, agents, taches, fichiers, cree: date, maj: date, passation, archive: false, auteur: membre.prenom }
  const sortie = verifierRelecture(c, membre.prenom)

  const f = join(racine, 'chantiers', `${id}.md`)
  if (existsSync(f)) echec(`Le chantier « ${id} » existe déjà (${rel(f)}) : rien n'est écrit.`, 3)
  if (existsSync(join(racine, 'archive', `${id}.md`))) echec(`Le chantier « ${id} » existe déjà dans les archives : rien n'est écrit.`, 3)
  tx.ecrire(f, sortie)
  console.log(`fiche écrite : ${rel(f)}`)
}

function maj(d, projet, membre, racine, rel) {
  const id = identifiant(d.id)
  const { f, c, avertissements } = ficheExistante(racine, id, membre.prenom)
  let change = false
  if (d.etat !== undefined) {
    etatValide(d.etat, 'L\'état')
    if (d.etat === 'termine') echec('L\'état « termine » ne se pose que par l\'archivage (action archiver).')
    c.etat = d.etat; change = true
  }
  if (d.agent !== undefined) {
    if (!estObjet(d.agent)) echec('agent doit être un objet {id, etat?, quoi?}.')
    if (typeof d.agent.id !== 'string' || !projet.agents.some(x => x.id === d.agent.id)) echec(`L'agent « ${court(d.agent.id)} » n'existe pas dans le projet.`)
    const actuel = c.agents.find(a => a.id === d.agent.id)
    const neuf = { id: d.agent.id, etat: d.agent.etat === undefined ? (actuel?.etat ?? 'attente') : etatValide(d.agent.etat, 'L\'état de l\'agent'), quoi: d.agent.quoi === undefined ? (actuel?.quoi ?? '') : texte(d.agent.quoi, 'La tâche de l\'agent', { vide: true }) }
    if (actuel) Object.assign(actuel, neuf)
    else if (c.agents.length >= MAX_AGENTS) echec(`${MAX_AGENTS} agents au plus par chantier.`)
    else c.agents.push(neuf)
    change = true
  }
  if (d.tache !== undefined) {
    if (!estObjet(d.tache)) echec('tache doit être un objet {titre, statut?}.')
    const titre = texte(d.tache.titre, 'Le titre de la tâche')
    const statut = d.tache.statut === undefined ? undefined : statutValide(d.tache.statut, 'Le statut de la tâche')
    const actuel = c.taches.find(t => t.titre === sain(titre))
    if (actuel) { if (statut) actuel.statut = statut }
    else if (c.taches.length >= MAX_TACHES) echec(`${MAX_TACHES} tâches au plus par chantier.`)
    else c.taches.push({ titre, statut: statut ?? 'a faire' })
    change = true
  }
  if (d.fichier !== undefined) {
    if (!cheminSur(d.fichier)) echec(`Le fichier « ${court(d.fichier)} » n'est pas un chemin relatif au projet (ni « .. », ni chemin absolu, ni « \\ »).`)
    if (!c.fichiers.includes(d.fichier)) {
      if (c.fichiers.length >= MAX_FICHIERS) echec(`${MAX_FICHIERS} fichiers au plus par chantier.`)
      c.fichiers.push(d.fichier)
    }
    change = true
  }
  if (d.passation !== undefined) { c.passation = texte(d.passation, 'La passation', { vide: true, max: MAX_PASSATION }); change = true }
  if (!change) echec('Rien à mettre à jour (attendus : etat, agent, tache, fichier ou passation).')
  c.maj = maintenant()
  const sortie = verifierRelecture(c, membre.prenom)
  for (const a of avertissements) console.log(`avertissement : ${a}`)
  tx.remplacer(f, sortie)
  console.log(`fiche mise à jour : ${rel(f)}`)
}

function lierSession(d, membre, racine, rel) {
  const id = identifiant(d.id)
  const { f, c } = ficheExistante(racine, id, membre.prenom)
  if (d.sessionId === undefined && d.nom === undefined) echec('Il faut un « sessionId » (id de la session) ou un « nom » (nom de la sous-session).')
  let sessions = null
  if (d.sessionId !== undefined) {
    if (typeof d.sessionId !== 'string' || !SESSION_ID.test(d.sessionId)) echec('L\'id de session doit s\'écrire en lettres, chiffres, « - » et « _ » (100 caractères au plus, sans commencer par « _ »).')
    const s = lireSessions(racine)
    if (s.carte[d.sessionId] !== undefined && s.carte[d.sessionId] !== id) echec(`La session « ${d.sessionId} » est déjà liée au chantier « ${s.carte[d.sessionId]} » : rien n'est modifié.`, 3)
    sessions = s
  }
  let sortie = null
  if (d.nom !== undefined) {
    c.session = texte(d.nom, 'Le nom de session')
    c.maj = maintenant()
    sortie = verifierRelecture(c, membre.prenom)
  }
  if (sessions && sessions.carte[d.sessionId] !== id) {
    sessions.carte[d.sessionId] = id
    tx.remplacer(sessions.f, texteSessions(sessions.carte))
  }
  if (sortie !== null) tx.remplacer(f, sortie)
  console.log(`session liée : ${d.sessionId !== undefined ? `${d.sessionId} -> ${id} (${rel(join(racine, 'sessions.json'))})` : ''}${d.nom !== undefined ? ` nom « ${c.session} »` : ''}`.trimEnd())
}

function archiver(d, membre, racine, rel) {
  const id = identifiant(d.id)
  const { f, c } = ficheExistante(racine, id, membre.prenom)
  const passation = texte(d.passation ?? '', 'La passation', { max: MAX_PASSATION })
  const ouv = ouvertes(c.taches)
  if (ouv.length && !options.forceReport)
    refuserOuvertes(ouv, `Des tâches restent à faire ou en cours : rien n'est archivé. Les terminer, les abandonner, ou relancer avec --force-report (elles passent à « reporte ») :`)
  for (const t of ouv) t.statut = 'reporte'
  for (const a of c.agents) a.etat = 'termine'
  c.etat = 'termine'; c.archive = true; c.maj = maintenant(); c.passation = passation
  const sortie = verifierRelecture(c, membre.prenom)
  const dest = join(racine, 'archive', `${id}.md`)
  if (existsSync(dest)) echec(`Une archive « ${id} » existe déjà (${rel(dest)}) : rien n'est archivé.`, 3)
  const s = lireSessions(racine)
  const liens = Object.keys(s.carte).filter(k => s.carte[k] === id)
  tx.ecrire(dest, sortie)
  tx.supprimer(f)
  if (liens.length) {
    for (const k of liens) delete s.carte[k]
    tx.remplacer(s.f, texteSessions(s.carte))
  }
  console.log(`chantier archivé : ${rel(dest)}${ouv.length ? ` (${ouv.length} tâche(s) reportée(s))` : ''}`)
}

function tache(d, projet, pilotage, rel) {
  if (typeof d.id !== 'string' || d.id === '') echec('Il faut l\'« id » de la tâche.')
  statutValide(d.statut, 'Le statut')
  const f = join(pilotage, 'plan.md')
  if (!existsSync(f)) echec('Le plan (.pilotage/plan.md) est introuvable : rien n\'est écrit.')
  // Édition en place : seule la marque de la ligne de cette tâche change, tout le reste du fichier est conservé tel quel.
  const ancien = readFileSync(f, 'utf8')
  const morceaux = ancien.split(/(\r?\n)/) // lignes et fins de ligne alternées : on les remet telles quelles
  const idLigne = l => { const m = TACHE_RE.exec(l); return m ? m[2].split('|')[0].trim() : null }
  const trouvees = []
  for (let i = 0; i < morceaux.length; i += 2) if (idLigne(morceaux[i]) === d.id) trouvees.push(i)
  if (trouvees.length === 0) echec(`La tâche « ${court(d.id)} » n'existe pas dans le plan.`)
  if (trouvees.length > 1) echec(`L'identifiant « ${court(d.id)} » apparaît sur plusieurs lignes du plan : le corriger à la main (un identifiant par tâche), rien n'est écrit.`)
  morceaux[trouvees[0]] = morceaux[trouvees[0]].replace(TACHE_RE, (_, debut, reste) => debut.replace(/\[.?\]/,`[${MARQUES[d.statut]}]`) + reste)
  const sortie = morceaux.join('')
  // Garde-fou : relu, le plan est identique à l'ancien, sauf le statut de cette seule tâche.
  const avant = parsePlan(ancien), apres = parsePlan(sortie)
  const attendu = avant.map(t => (t.id === d.id ? { ...t, statut: d.statut } : t))
  if (JSON.stringify(apres) !== JSON.stringify(attendu)) throw new Error('le plan ne se relirait pas comme prévu')
  tx.remplacer(f, sortie)
  console.log(`tâche ${d.id} : ${d.statut} (${rel(f)})`)
}

function porte(d, projet, membre, pilotage, racine, rel) {
  const phase = typeof d.phase === 'string' ? d.phase : ''
  if (!projet.phases.some(p => p.id === phase)) echec(`La phase « ${court(d.phase)} » n'existe pas dans le projet.`)
  if (!['valider', 'forcer', 'repondre'].includes(d.mode)) echec('Le mode doit être « valider », « forcer » ou « repondre ».')
  if (d.mode !== 'valider' && !options.confirme)
    echec(`« ${d.mode} » demande la confirmation explicite de l'utilisateur : relancer avec --confirme une fois qu'il l'a donnée. Rien n'est écrit.`)
  if (d.mode !== 'repondre') {
    const planFichier = join(pilotage, 'plan.md')
    const taches = existsSync(planFichier) ? parsePlan(readFileSync(planFichier, 'utf8')) : []
    const p = portePossible(taches, phase)
    if (!p.ok) refuserOuvertes(p.ouvertes, `La porte « ${phase} » n'est pas possible : ${p.ouvertes.length} tâche(s) ouverte(s). Les terminer, reporter ou abandonner (action tache), puis recommencer :`)
  }
  const note = d.note === undefined ? '' : texte(d.note, 'La note', { vide: true })
  const f = join(racine, 'portes.md')
  // Édition en place : seules les entrées de cette phase changent, les autres lignes (notes à la main comprises) restent telles quelles.
  const ancien = existsSync(f) ? readFileSync(f, 'utf8') : ''
  const eol = ancien.includes('\r\n') ? '\r\n' : '\n'
  const lignes = ancien === '' ? [] : ancien.split(/\r?\n/)
  if (lignes.at(-1) === '') lignes.pop()
  const cle = l => { const i = l.indexOf(':'); if (i <= 0) return null; const r = l.slice(i + 1); const b = r.indexOf('|'); return { cle: l.slice(0, i).trim(), phase: (b < 0 ? r : r.slice(0, b)).trim() } }
  const cle0 = { valider: 'porte', forcer: 'force', repondre: 'refus' }[d.mode]
  // Une entrée contraire à la nouvelle est retirée ; une entrée identique est gardée en place (sauf un refus, remplacé par le nouveau).
  const contraires = d.mode === 'repondre' ? ['porte', 'force', 'refus'] : ['refus']
  const gardees = lignes.filter(l => { const k = cle(l); return !(k && k.phase === phase && contraires.includes(k.cle)) })
  const dejaLa = d.mode !== 'repondre' && gardees.some(l => { const k = cle(l); return k && k.phase === phase && k.cle === cle0 })
  const entree = serializePortes({ valides: d.mode === 'valider' ? [phase] : [], forces: d.mode === 'forcer' ? [phase] : [], refus: d.mode === 'repondre' ? [{ phase, note }] : [] }).trimEnd()
  if (!dejaLa) gardees.push(entree)
  const sortie = gardees.join(eol) + eol
  const relue = lirePortes(sortie)
  if (!(d.mode === 'valider' ? relue.valides : d.mode === 'forcer' ? relue.forces : relue.refus.map(r => r.phase)).includes(phase)) throw new Error('la porte ne se relirait pas comme prévu')
  if (sortie !== ancien) tx.remplacer(f, sortie)
  console.log(`porte « ${phase} » : ${d.mode} (${rel(f)})`)
}

try {
  principal()
} catch (e) {
  tx.annuler()
  echec(`Écriture impossible (${e instanceof Error ? e.message.split(String.fromCharCode(10))[0] : 'erreur inconnue'}) : tout est remis comme avant.`, 4)
}
