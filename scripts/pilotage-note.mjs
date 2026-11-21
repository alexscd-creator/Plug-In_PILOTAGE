// Classe les idées et les retours de l'équipe : une note par fichier, `.pilotage/equipe/<prénom>/idees/<id>.md` ou `.../feedback/<id>.md`.
// Usage : node scripts/pilotage-note.mjs <dossier> <idee|feedback|retirer> <json | fichier.json | id> --membre <prénom> [--type idee|feedback]
// Actions :
//   idee | feedback  {titre, texte, phase?, chantier?}  nouvelle note, jamais d'écrasement : l'identifiant est « <date>-<titre en tirets> »,
//                    suivi de -2, -3... si le même titre existe déjà ce jour-là ; titre 200 caractères au plus, texte 4000 au plus
//   retirer          <id>  supprime une note QUE CE MEMBRE A CRÉÉE (dossier du membre + auteur écrit dans la note) ; --type précise le dossier si l'id existe dans les deux
// Rien n'est écrit en dehors de `.pilotage/equipe/<prénom>/` (le prénom est celui de `--membre`, vérifié contre l'équipe de projet.json).
// Codes : 0 ok ; 1 entrée invalide ou refus (rien n'est écrit) ; 3 trop de notes de même titre ; 4 écriture impossible (tout est remis comme avant) ;
//   5 dossier introuvable, qui n'est pas un dossier, ou sans projet ; 64 usage incorrect.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CheminNonSur, ID, Transaction, dossierExistant, echec, erreursNom, importerModele, ligne, slug, verifierChemin } from './lib/ecriture.mjs'

const USAGE = 'usage : node scripts/pilotage-note.mjs <dossier> <idee|feedback|retirer> <json | fichier.json | id> --membre <prénom> [--type idee|feedback]'
const ACTIONS = ['idee', 'feedback', 'retirer']
const MAX_JSON = 64 * 1024
const MAX_COLLISIONS = 99

// --- arguments ------------------------------------------------------------------------------------------------------
const positionnels = []
const options = { membre: '', type: '' }
{
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--membre') { options.membre = args[++i] ?? ''; if (options.membre === '') usage() }
    else if (a === '--type') { options.type = args[++i] ?? ''; if (!['idee', 'feedback'].includes(options.type)) usage('--type attend « idee » ou « feedback ».') }
    else if (a.startsWith('--')) usage(`option inconnue : ${a.slice(0, 30)}`)
    else positionnels.push(a)
  }
}
function usage(message) { console.error((message ? message + '\n' : '') + USAGE); process.exit(64) }
const [dossierArg, action, arg] = positionnels
if (positionnels.length !== 3 || !ACTIONS.includes(action)) usage()
if (options.membre === '') usage('--membre <prénom> est obligatoire.')
if (options.type !== '' && action !== 'retirer') usage('--type ne sert qu’à « retirer ».')

const [notesModele, projetModele] = await importerModele(['notes', 'projet'], 4)
const { DOSSIER_NOTE, MAX_FICHIER_NOTE, MAX_TEXTE_NOTE, MAX_TITRE_NOTE, idNote, parseNote, serializeNote, validerNote } = notesModele
const { parseProjet, memeMembre } = projetModele

const tx = new Transaction()

// --- aides ----------------------------------------------------------------------------------------------------------
const estObjet = v => typeof v === 'object' && v !== null && !Array.isArray(v)
const court = s => String(s).slice(0, 40)
const estFichier = p => { try { return statSync(p).isFile() } catch { return false } }

function lireJson() {
  let brut = arg
  const depuisFichier = !/^\s*[[{"]/.test(brut)
  if (depuisFichier) {
    try {
      if (statSync(resolve(brut)).size > MAX_JSON) echec(`Le fichier JSON dépasse ${MAX_JSON / 1024} Ko.`)
      brut = readFileSync(resolve(brut), 'utf8')
    } catch {
      echec('Les données ne sont ni du JSON ni un fichier JSON lisible.')
    }
  }
  if (brut.length > MAX_JSON) echec(`Les données dépassent ${MAX_JSON / 1024} Ko.`)
  let v
  // Le message d'erreur de JSON.parse cite le début du texte : jamais repris (le fichier peut contenir autre chose que du JSON).
  try { v = JSON.parse(brut) } catch { echec(depuisFichier ? 'Le fichier d\'entrée n\'est pas un JSON valide.' : 'Les données ne sont pas du JSON valide.') }
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

function texte(valeur, quoi, max) {
  if (typeof valeur !== 'string') echec(`${quoi} doit être un texte.`)
  if (valeur.length > max) echec(`${quoi} dépasse ${max} caractères.`)
  if (ligne(valeur) === '') echec(`${quoi} est vide.`)
  return valeur
}

// --- actions --------------------------------------------------------------------------------------------------------
function principal() {
  const dossier = dossierExistant(dossierArg)
  const donnees = action === 'retirer' ? null : lireJson()
  const projet = chargerProjet(dossier)
  const membre = nomMembre(projet)
  const racine = join(dossier, '.pilotage', 'equipe', membre.sl)
  // Liens et jonctions : rien ne s'écrit au travers d'un lien qui mène hors du projet.
  tx.proteger(dossier)
  verifierChemin(dossier, racine)
  const rel = f => f.slice(dossier.length + 1).replaceAll('\\', '/')
  return action === 'retirer' ? retirer(membre, racine, rel) : creer(action, donnees, projet, membre, racine, rel)
}

function creer(type, d, projet, membre, racine, rel) {
  const titre = texte(d.titre, 'Le titre', MAX_TITRE_NOTE)
  const corps = texte(d.texte, 'Le texte', MAX_TEXTE_NOTE)
  const phase = d.phase === undefined ? '' : d.phase
  if (phase !== '' && (typeof phase !== 'string' || !projet.phases.some(p => p.id === phase))) echec(`La phase « ${court(phase)} » n'existe pas dans le projet.`)
  const chantier = d.chantier === undefined ? '' : d.chantier
  if (chantier !== '' && (typeof chantier !== 'string' || !ID.test(chantier) || chantier.length > 60))
    echec('Le chantier doit s\'écrire en minuscules, chiffres et tirets seulement (60 caractères au plus).')
  const date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const dir = join(racine, DOSSIER_NOTE[type])
  const base = idNote(date, titre)
  let id = base
  for (let n = 2; existsSync(join(dir, `${id}.md`)); n++) {
    if (n > MAX_COLLISIONS) echec(`Plus de ${MAX_COLLISIONS} notes portent déjà ce titre aujourd'hui : en choisir un autre. Rien n'est écrit.`, 3)
    id = `${base}-${n}`
  }
  const note = { id, type, titre, date, auteur: membre.prenom, phase, chantier, texte: corps }
  const e = validerNote(note)
  if (e.length) echec(e)
  const sortie = serializeNote(note)
  const r = parseNote(sortie, membre.prenom)
  if (!r.ok || r.note.titre === '' || r.note.texte === '' || r.note.id !== id || r.note.type !== type || r.note.phase !== phase || r.note.chantier !== chantier || r.avertissements.length)
    echec('La note contient des éléments qui ne seraient pas relus (texte ou titre vide après nettoyage) : rien n\'est écrit.')
  const f = join(dir, `${id}.md`)
  tx.ecrire(f, sortie)
  console.log(`note écrite : ${rel(f)}`)
}

function retirer(membre, racine, rel) {
  if (!ID.test(arg) || arg.length > 60) echec('L\'identifiant d\'une note s\'écrit en minuscules, chiffres et tirets seulement (60 caractères au plus) : rien n\'est supprimé.')
  const types = (options.type === '' ? ['idee', 'feedback'] : [options.type]).filter(t => estFichier(join(racine, DOSSIER_NOTE[t], `${arg}.md`)))
  if (types.length === 0) echec(`La note « ${arg} » est introuvable ou n'est pas une note chez ${membre.prenom} (on ne retire que ses propres notes) : rien n'est supprimé.`)
  if (types.length > 1) echec(`La note « ${arg} » existe dans idees et dans feedback : relancer avec --type idee ou --type feedback. Rien n'est supprimé.`)
  const f = join(racine, DOSSIER_NOTE[types[0]], `${arg}.md`)
  if (statSync(f).size > MAX_FICHIER_NOTE) echec(`La note « ${arg} » est trop volumineuse pour être une note de Pilotage : rien n'est supprimé.`)
  const r = parseNote(readFileSync(f, 'utf8'), membre.prenom)
  if (!r.ok) echec([`« ${arg} » n'est pas une note valide de Pilotage : rien n'est supprimé.`, ...r.erreurs])
  if (r.note.id !== arg || r.note.type !== types[0]) echec(`« ${arg} » ne correspond pas à son en-tête (id ou type) : rien n'est supprimé.`)
  if (r.auteurDeclare === '' || !memeMembre(r.auteurDeclare, membre.prenom)) echec(`« ${arg} » n'a pas été créée par ${membre.prenom} : rien n'est supprimé.`)
  tx.supprimer(f)
  console.log(`note retirée : ${rel(f)}`)
}

try {
  principal()
} catch (e) {
  tx.annuler()
  if (e instanceof CheminNonSur) echec(e.message, 1)
  echec(`Écriture impossible (${e instanceof Error ? e.message.split(String.fromCharCode(10))[0] : 'erreur inconnue'}) : tout est remis comme avant.`, 4)
}
