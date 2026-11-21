// Crée, modifie ou supprime un skill du projet : `.pilotage/skills/<id>.md`.
// Usage : node scripts/pilotage-skill.mjs <dossier> <creer|supprimer|maj> <json | fichier.json | id>
// Actions :
//   creer      {id, description, corps}   nouveau skill (frontmatter name + description, puis le corps) ; ne remplace jamais un fichier existant
//   maj        {id, description?, corps?} réécrit un skill existant ; l'ancien texte est gardé dans `<id>.md.bak` ; ce qui n'est pas donné est conservé
//   supprimer  {id}  (ou l'identifiant seul)  retire le skill et sa copie .bak, mais REFUSE tant qu'un agent du projet l'utilise (le dire avec la liste des agents)
// La description est TOUJOURS écrite entre guillemets doubles (guillemets et antislash protégés) : une valeur non quotée qui contient « : » rend le
// frontmatter illisible et fait perdre toutes ses métadonnées au chargement. Corps : 8000 caractères au plus ; description : 500 au plus, sur une ligne.
// Rien ne s'écrit en dehors de `.pilotage/skills/` (ni au travers d'un lien ou d'une jonction qui mène hors du projet).
// Codes : 0 ok ; 1 entrée invalide ou refus (rien n'est changé) ; 3 le skill existe déjà (creer) ; 4 écriture impossible (tout est remis comme avant) ;
//   5 dossier introuvable, qui n'est pas un dossier, ou sans projet ; 64 usage incorrect.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CheminNonSur, ID, Transaction, dossierExistant, echec, erreursNom, importerModele, ligne, verifierChemin } from './lib/ecriture.mjs'

const USAGE = 'usage : node scripts/pilotage-skill.mjs <dossier> <creer|supprimer|maj> <json | fichier.json | id>'
const ACTIONS = ['creer', 'supprimer', 'maj']
const MAX_JSON = 64 * 1024
const MAX_CORPS = 8000
const MAX_DESCRIPTION = 500
// Caractères de contrôle (et séparateurs de ligne Unicode), construits par code pour que ce fichier reste lisible.
const plage = (a, b) => `${String.fromCharCode(a)}-${String.fromCharCode(b)}`
const CONTROLES_LIGNE = new RegExp(`[${plage(0, 31)}${String.fromCharCode(127, 133, 0x2028, 0x2029)}]`, 'g')
const CONTROLES_CORPS = new RegExp(`[${plage(0, 8)}${plage(11, 12)}${plage(14, 31)}${String.fromCharCode(127)}]`, 'g') // garde le saut de ligne et la tabulation

const args = process.argv.slice(2)
const [dossierArg, action, arg] = args
if (args.length !== 3 || !ACTIONS.includes(action) || args.some(a => a.startsWith('--'))) {
  console.error(USAGE)
  process.exit(64)
}

const [projetModele] = await importerModele(['projet'], 4)
const { parseProjet } = projetModele
const tx = new Transaction()

// --- aides ----------------------------------------------------------------------------------------------------------
const estObjet = v => typeof v === 'object' && v !== null && !Array.isArray(v)
const court = s => String(s).slice(0, 40)

function lireJson() {
  // Un identifiant seul (supprimer) n'est jamais pris pour un fichier.
  if (action === 'supprimer' && ID.test(arg) && arg.length <= 60) return { id: arg }
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
  // Le message d'erreur de JSON.parse cite le début du texte : jamais repris.
  try { v = JSON.parse(brut) } catch { echec(depuisFichier ? "Le fichier d'entrée n'est pas un JSON valide." : 'Les données ne sont pas du JSON valide.') }
  if (!estObjet(v)) echec('Les données doivent être un objet JSON.')
  return v
}

function chargerProjet(dossier) {
  const f = join(dossier, '.pilotage', 'projet.json')
  if (!existsSync(f)) echec(`Aucun projet Pilotage dans « ${dossier} » (.pilotage/projet.json absent) : rien n'est changé.`, 5)
  let r
  try { r = parseProjet(readFileSync(f, 'utf8')) } catch { echec('Le fichier projet est illisible : rien n\'est changé.') }
  if (!r.ok) echec(r.erreurs)
  return r.projet
}

function refuserInconnues(d, permises) {
  const en_trop = Object.keys(d).filter(k => !permises.includes(k))
  if (en_trop.length) echec(`Champ inconnu : « ${court(en_trop[0])} » (attendus : ${permises.join(', ')}). Rien n'est changé.`)
}

function identifiant(d) {
  const id = d.id
  if (typeof id !== 'string' || id === '') echec("L'identifiant du skill doit être un texte non vide.")
  if (!ID.test(id)) echec(`L'identifiant du skill « ${court(id)} » doit s'écrire en minuscules, chiffres et tirets seulement.`)
  const e = erreursNom("L'identifiant du skill", id)
  if (e.length) echec(e)
  return id
}

/** Une ligne, sans caractère de contrôle, au plus MAX_DESCRIPTION caractères. */
function descriptionPropre(v) {
  if (typeof v !== 'string') echec('La description doit être un texte.')
  if (v.length > MAX_DESCRIPTION * 4) echec(`La description dépasse ${MAX_DESCRIPTION} caractères.`)
  const d = ligne(v).replace(CONTROLES_LIGNE, ' ').replace(/ {2,}/g, ' ').trim()
  if (d === '') echec('La description est vide.')
  if (d.length > MAX_DESCRIPTION) echec(`La description dépasse ${MAX_DESCRIPTION} caractères.`)
  return d
}

function corpsPropre(v) {
  if (typeof v !== 'string') echec('Le corps doit être un texte.')
  if (v.length > MAX_CORPS) echec(`Le corps dépasse ${MAX_CORPS} caractères.`)
  const c = v.replace(/\r\n?/g, '\n').replace(CONTROLES_CORPS, '').replace(/^\n+/, '')
  if (c.trim() === '') echec('Le corps est vide.')
  return c.endsWith('\n') ? c : c + '\n'
}

/** La valeur est écrite entre guillemets doubles : antislash et guillemet protégés, jamais autre chose. */
const entreGuillemets = s => `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`

const texteSkill = (id, description, corps) => `---\nname: ${id}\ndescription: ${entreGuillemets(description)}\n---\n\n${corps}`

/** Relit (avec tolérance) la description et le corps d'un skill existant, même si son frontmatter est mal quoté. */
function lireExistant(texte) {
  const t = texte.replace(/\r\n?/g, '\n')
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(t)
  if (!m) return { description: '', corps: t.replace(/^\n+/, '') }
  const lignes = m[1].split('\n')
  const i = lignes.findIndex(l => /^description:/.test(l))
  let description = ''
  if (i >= 0) {
    const v = lignes[i].slice('description:'.length).trim()
    if (/^[|>]/.test(v)) {
      const suite = []
      for (const l of lignes.slice(i + 1)) { if (/^\s/.test(l) || l === '') suite.push(l.trim()); else break }
      description = suite.join(' ').trim()
    } else if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
      try { description = JSON.parse(v) } catch { description = v.slice(1, -1).replace(/\\(.)/g, '$1') }
    } else if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) {
      description = v.slice(1, -1).replaceAll("''", "'")
    } else {
      description = v
    }
  }
  return { description, corps: t.slice(m[0].length).replace(/^\n+/, '') }
}

const estFichier = p => { try { return statSync(p).isFile() } catch { return false } }

// --- actions --------------------------------------------------------------------------------------------------------
function principal() {
  const dossier = dossierExistant(dossierArg)
  const donnees = lireJson()
  const projet = chargerProjet(dossier)
  const skills = join(dossier, '.pilotage', 'skills')
  tx.proteger(dossier) // jamais au travers d'un lien ou d'une jonction qui mène hors du projet
  verifierChemin(dossier, skills)
  const rel = f => f.slice(dossier.length + 1).replaceAll('\\', '/')
  if (action === 'creer') return creer(donnees, skills, rel)
  if (action === 'maj') return maj(donnees, skills, rel)
  return supprimer(donnees, projet, skills, rel)
}

function creer(d, skills, rel) {
  refuserInconnues(d, ['id', 'description', 'corps'])
  const id = identifiant(d)
  const description = descriptionPropre(d.description)
  const corps = corpsPropre(d.corps)
  const f = join(skills, `${id}.md`)
  if (existsSync(f)) echec(`Le skill « ${id} » existe déjà (${rel(f)}) : rien n'est écrit. Pour le changer, utiliser l'action maj.`, 3)
  try {
    tx.ecrire(f, texteSkill(id, description, corps))
  } catch (e) {
    if (e?.code === 'EEXIST') { tx.annuler(); echec(`Le skill « ${id} » existe déjà : rien n'est écrit.`, 3) }
    throw e
  }
  console.log(`skill écrit : ${rel(f)}`)
}

function maj(d, skills, rel) {
  refuserInconnues(d, ['id', 'description', 'corps'])
  const id = identifiant(d)
  if (d.description === undefined && d.corps === undefined) echec('Rien à changer : donner une description ou un corps.')
  const description = d.description === undefined ? undefined : descriptionPropre(d.description)
  const corps = d.corps === undefined ? undefined : corpsPropre(d.corps)
  const f = join(skills, `${id}.md`)
  if (!estFichier(f)) echec(`Le skill « ${id} » n'existe pas (${rel(f)}) : rien n'est changé. Pour le créer, utiliser l'action creer.`)
  const avant = readFileSync(f, 'utf8')
  const ancien = lireExistant(avant)
  const descriptionFinale = description ?? ancien.description
  if (descriptionFinale === '') echec("La description actuelle du skill est introuvable : la fournir avec la mise à jour. Rien n'est changé.")
  const corpsFinal = corps ?? (ancien.corps.trim() === '' ? echec('Le skill n\'a pas de corps : le fournir. Rien n\'est changé.') : ancien.corps)
  const bak = `${f}.bak`
  tx.remplacer(bak, avant) // l'ancien texte d'abord : si cette copie échoue, le skill n'est pas touché
  tx.remplacer(f, texteSkill(id, descriptionPropre(descriptionFinale), corpsFinal.endsWith('\n') ? corpsFinal : corpsFinal + '\n'))
  console.log(`skill mis à jour : ${rel(f)} (ancien texte : ${rel(bak)})`)
}

function supprimer(d, projet, skills, rel) {
  refuserInconnues(d, ['id'])
  const id = identifiant(d)
  const f = join(skills, `${id}.md`)
  if (!estFichier(f)) echec(`Le skill « ${id} » n'existe pas (${rel(f)}) : rien n'est supprimé.`)
  const agents = projet.agents.filter(a => a.skills.includes(id))
  if (agents.length) {
    echec([
      `Le skill « ${id} » est encore utilisé par : ${agents.map(a => `${a.titre} (${a.id})`).join(', ')}. Rien n'est supprimé.`,
      "Le retirer d'abord de ces agents (page Agents du panneau, ou Paramètres), puis relancer.",
    ])
  }
  const bak = `${f}.bak`
  tx.supprimer(f)
  if (existsSync(bak)) tx.supprimer(bak)
  console.log(`skill supprimé : ${rel(f)}`)
}

try {
  principal()
} catch (e) {
  tx.annuler()
  if (e instanceof CheminNonSur) echec(e.message, 1)
  echec(`Écriture impossible (${e instanceof Error ? e.message.split(String.fromCharCode(10))[0] : 'erreur inconnue'}) : tout est remis comme avant.`, 4)
}
