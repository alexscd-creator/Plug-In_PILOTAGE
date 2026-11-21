// Garanties communes des scripts qui écrivent dans `.pilotage/` : sortie avec code, import du modèle, dossier valide,
// identifiants et noms de dossier sûrs, écriture transactionnelle (tout ce qu'un lancement a fait est défait en cas d'échec).
// Codes de sortie communs : 0 ok ; 1 entrée invalide (rien n'est écrit) ; 3 existe déjà ; 4 écriture impossible (rien n'est resté) ;
//   5 dossier introuvable ou qui n'est pas un dossier ; 64 usage incorrect.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

export const ID = /^[a-z0-9-]+$/
export const RESERVES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/
export const MAX_NOM = 60

export const echec = (messages, code = 1) => { console.error([].concat(messages).join('\n')); process.exit(code) }

const premiereLigne = e => (e instanceof Error ? e.message.split(String.fromCharCode(10))[0] : 'erreur inconnue')

/** Importe des fichiers du modèle (`hooks/model/<nom>.ts`) ; s'ils manquent : message français et sortie avec `codeEchec`. */
export async function importerModele(noms, codeEchec, suite = "Rien n'est écrit.") {
  try {
    return await Promise.all(noms.map(n => import(new URL(`../../hooks/model/${n}.ts`, import.meta.url).href)))
  } catch (e) {
    return echec(`Le modèle du plugin est introuvable ou illisible (${premiereLigne(e)}) : réinstaller le plugin. ${suite}`, codeEchec)
  }
}

/** Dossier absolu, ou sortie code 5 s'il est introuvable ou n'est pas un dossier (rien n'est créé). */
export function dossierExistant(arg) {
  const dossier = resolve(arg)
  try {
    if (!statSync(dossier).isDirectory()) echec(`« ${dossier} » n'est pas un dossier : rien n'est créé.`, 5)
  } catch {
    echec(`Le dossier « ${dossier} » est introuvable : rien n'est créé.`, 5)
  }
  return dossier
}

/** Titre en identifiant (chantier) : minuscules sans accent, a-z 0-9 et tirets ('' si rien ne reste). Le dossier d'un membre suit, lui, `dossierMembre` (hooks/model/projet.ts). */
export const slug = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
/** Texte sur une seule ligne. */
export const ligne = s => String(s).replace(/\s*[\r\n]+\s*/g, ' ').trim()

/** Un nom devenant un fichier ou un dossier : pas trop long, pas un nom réservé par Windows. */
export function erreursNom(quoi, nom) {
  const e = []
  if (nom.length > MAX_NOM) e.push(`${quoi} « ${nom.slice(0, 20)}... » dépasse ${MAX_NOM} caractères.`)
  if (RESERVES.test(nom)) e.push(`${quoi} « ${nom} » est un nom réservé par Windows.`)
  return e
}

// --- liens et jonctions -----------------------------------------------------------------------------------------------
export const MESSAGE_LIEN = 'Chemin non sûr (lien hors du projet) : rien n\'est écrit. Un dossier ou un fichier de .pilotage est un lien (ou une jonction) qui mène ailleurs : le remplacer par un vrai dossier.'
/** Levée quand un chemin d'écriture passe par un lien qui mène hors du projet : le script s'arrête (code 1) et défait tout. */
export class CheminNonSur extends Error {
  constructor() { super(MESSAGE_LIEN) }
}
const DISQUE = { realpathSync: p => realpathSync.native(p), lstatSync }
const sous = (p, racine) => {
  const a = process.platform === 'win32' ? p.toLowerCase() : p
  const b = process.platform === 'win32' ? racine.toLowerCase() : racine
  return a === b || a.startsWith(b.endsWith(sep) ? b : b + sep)
}
/**
 * Chaque morceau EXISTANT du chemin `cible`, de la racine du projet (exclue) jusqu'à la cible, doit se résoudre (realpath : liens et
 * jonctions suivis) sous le chemin réel de la racine. Un lien cassé, une cible hors de la racine : refusés. Lève CheminNonSur.
 * `fs` : realpathSync et lstatSync (remplaçables pour les tests).
 */
export function verifierChemin(racine, cible, fs = DISQUE) {
  const reelle = fs.realpathSync(racine)
  const rel = relative(racine, cible)
  if (rel === '' ) return
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new CheminNonSur()
  let c = racine
  for (const morceau of rel.split(sep).filter(Boolean)) {
    c = join(c, morceau)
    try { fs.lstatSync(c) } catch { return } // n'existe pas encore : rien à suivre plus loin
    let r
    try { r = fs.realpathSync(c) } catch { throw new CheminNonSur() } // lien cassé : on ne sait pas où il mène
    if (!sous(r, reelle)) throw new CheminNonSur()
  }
}

/** Écriture transactionnelle : chaque opération enregistre son défaire ; `annuler()` les rejoue à l'envers (sans jamais lever). */
export class Transaction {
  #defaire = []
  #n = 0
  #racine = null
  /** Toute écriture de cette transaction devra rester sous `racine` (voir verifierChemin), liens et jonctions compris. */
  proteger(racine) { this.#racine = racine; return this }
  #verifier(f) { if (this.#racine !== null) verifierChemin(this.#racine, f) }
  /** Crée le dossier et ses parents manquants ; seuls ceux créés ici seront retirés. */
  dossierSur(d) {
    this.#verifier(d)
    if (existsSync(d)) return
    this.dossierSur(join(d, '..'))
    mkdirSync(d)
    this.#defaire.push(() => rmSync(d, { recursive: true, force: true }))
  }
  /** Crée un fichier neuf (jamais d'écrasement : lève s'il existe, et le fichier existant n'est pas touché). */
  ecrire(f, texte) {
    this.#verifier(f)
    this.dossierSur(join(f, '..'))
    writeFileSync(f, texte, { flag: 'wx' })
    this.#defaire.push(() => rmSync(f, { force: true }))
  }
  /** Remplace (ou crée) un fichier de façon atomique : fichier temporaire à côté, puis renommage. */
  remplacer(f, texte) {
    this.#verifier(f)
    let avant = null
    try { avant = readFileSync(f) } catch (e) { if (e?.code !== 'ENOENT') throw e }
    this.dossierSur(join(f, '..'))
    const tmp = `${f}.tmp-${process.pid}-${++this.#n}`
    try {
      writeFileSync(tmp, texte, { flag: 'wx' })
      renameSync(tmp, f)
    } catch (e) {
      try { rmSync(tmp, { force: true }) } catch { /* reste à la main */ }
      throw e
    }
    this.#defaire.push(() => { if (avant === null) rmSync(f, { force: true }); else writeFileSync(f, avant) })
  }
  /** Supprime un fichier (son contenu est gardé en mémoire pour pouvoir le remettre). */
  supprimer(f) {
    this.#verifier(f)
    const avant = readFileSync(f)
    unlinkSync(f)
    this.#defaire.push(() => writeFileSync(f, avant))
  }
  annuler() {
    for (const d of this.#defaire.reverse()) { try { d() } catch { /* reste à la main */ } }
    this.#defaire = []
  }
}
