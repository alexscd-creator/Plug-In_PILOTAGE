// « Lancer en chantier » depuis la page À faire : crée la fiche d'un chantier à partir d'une note, puis marque la note (`lance:`),
// côté hooks. Mêmes garanties que l'écriture d'état (`ecriture-chantier.ts`) et que scripts/pilotage-chantier.mjs (action `creer`) :
//  - on n'écrit que chez soi : la note doit être rangée dans le dossier du membre courant, la fiche y est créée ;
//  - la fiche vient des vrais sérialiseurs (`serializeChantier` + `validerChantier`), relue avant écriture ;
//  - jamais d'écrasement : identifiant déjà pris (chantiers ou archive) → suffixe `-2`, `-3`… ; fiche apparue entre-temps → refus ;
//  - la note est relue sur le disque avant tout : illisible ou déjà lancée → rien n'est écrit.
// `$.fs` ne supprime pas : la note n'est pas supprimée, elle est marquée. Si la fiche s'écrit mais pas la note, l'erreur le dit et
// la fiche reste (un second appui crée un autre identifiant, jamais un écrasement). Rien ne lève. Logique pure : le disque arrive par FsEcriture.
import { MAX_PASSATION, parseChantier, serializeChantier, validerChantier } from './chantier.ts'
import type { Chantier } from './chantier.ts'
import type { FsEcriture } from './ecriture-chantier.ts'
import type { NoteLue } from './lecture.ts'
import { parseNote, serializeNote, validerNote } from './notes.ts'
import type { Note } from './notes.ts'
import { dossierDe, memeMembre } from './projet.ts'

export type ResultatLancer = { ok: true; id: string; titre: string } | { ok: false; erreur: string }

const MAX_ID = 60
const BS = String.fromCharCode(92)
const ID_RE = /^[a-z0-9-]+$/
const normaliser = (p: string): string => p.replaceAll(BS, '/').replace(/\/+/g, '/').replace(/\/$/, '')
const nomSur = (n: string): boolean => n !== '' && n !== '.' && n !== '..' && !/[\\/:\0]/.test(n)
const refus = (erreur: string): ResultatLancer => ({ ok: false, erreur })
const premiereLigne = (e: unknown): string => (e instanceof Error ? e.message.split('\n')[0]! : 'erreur inconnue')
const slug = (s: string, max: number): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '')

/** La fiche d'un chantier tirée d'une note : id du titre (60 caractères, suffixe si pris), état `attente`, une tâche, passation = texte. */
export function chantierDepuisNote(n: Note, idsPris: string[], phase: string, maintenantIso: string): Chantier {
  const pris = new Set(idsPris)
  const brut = slug(String(n.titre ?? ''), MAX_ID) || 'chantier'
  let id = brut
  for (let i = 2; pris.has(id); i++) {
    const suffixe = `-${i}`
    id = `${brut.slice(0, MAX_ID - suffixe.length).replace(/-+$/, '')}${suffixe}`
  }
  const titre = String(n.titre ?? '').trim() || id
  return {
    id, titre, pole: '', phase: ID_RE.test(phase) ? phase : '', etat: 'attente', session: '', agents: [],
    taches: [{ titre, statut: 'a faire' }], fichiers: [], cree: maintenantIso, maj: maintenantIso,
    passation: String(n.texte ?? '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_PASSATION).trim(), archive: false, auteur: String(n.auteur ?? ''),
  }
}

/** Les identifiants des fiches d'un dossier (`<id>.md`) ; dossier absent : aucun. */
async function idsDe(fs: FsEcriture, dossier: string): Promise<string[]> {
  try {
    return (await fs.list(dossier)).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3))
  } catch {
    return []
  }
}

/** Crée le chantier d'une note du membre courant, puis marque la note. Ne lève jamais. */
export async function lancerNote(fs: FsEcriture, racine: string, moi: string, n: NoteLue, phase: string, maintenantIso: string): Promise<ResultatLancer> {
  try {
    if (typeof moi !== 'string' || moi.trim() === '') return refus('Prénom inconnu : rien n’est écrit.')
    if (!n || typeof n.chemin !== 'string') return refus('Note illisible : rien n’est écrit.')
    if ((n.lance ?? '') !== '') return refus('Cette note est déjà lancée en chantier.')
    const equipe = `${normaliser(String(racine ?? ''))}/.pilotage/equipe`
    const parties = n.chemin.split('/')
    if (parties.length !== 5 || parties[0] !== '.pilotage' || parties[1] !== 'equipe' || !nomSur(parties[2]!) || !nomSur(parties[4]!)) {
      return refus('Chemin de note inattendu : rien n’est écrit.')
    }
    const dossiers = (await fs.list(equipe)).filter(nomSur).sort()
    const dossier = dossierDe(moi, dossiers)
    if (dossier === undefined || parties[2] !== dossier || !memeMembre(parties[2]!, moi)) {
      return refus('Cette note n’est pas la vôtre : on ne lance que ses propres notes.')
    }

    const cheminNote = `${equipe}/${dossier}/${parties[3]}/${parties[4]}`
    const surDisque = parseNote(await fs.read(cheminNote), moi)
    if (!surDisque.ok) return refus(`La note n’a pas pu être relue : ${surDisque.erreurs[0] ?? 'illisible'} Rien n’est écrit.`)
    if (surDisque.note.lance !== '') return refus('Cette note est déjà lancée en chantier.')
    const marquee: Note = { ...surDisque.note }

    const dossierChantiers = `${equipe}/${dossier}/chantiers`
    const pris = [...(await idsDe(fs, dossierChantiers)), ...(await idsDe(fs, `${equipe}/${dossier}/archive`))]
    const c = chantierDepuisNote(marquee, pris, phase, maintenantIso)
    const invalides = validerChantier(c)
    if (invalides.length > 0) return refus(`La fiche serait invalide : ${invalides[0]} Rien n’est écrit.`)
    const fiche = serializeChantier(c)
    const relue = parseChantier(fiche, moi)
    if (!relue.ok) return refus(`La fiche ne se relirait pas : ${relue.erreurs[0] ?? 'illisible'} Rien n’est écrit.`)
    const cheminFiche = `${dossierChantiers}/${c.id}.md`
    // Relu juste avant d'écrire (une autre session a pu créer la fiche entre-temps) : un fichier présent n'est jamais écrasé.
    if ((await idsDe(fs, dossierChantiers)).includes(c.id)) return refus('Une fiche porte déjà ce nom : rien n’est écrit.')

    marquee.lance = c.id
    const erreursNote = validerNote(marquee)
    if (erreursNote.length > 0) return refus(`La note marquée serait invalide : ${erreursNote[0]} Rien n’est écrit.`)
    const texteNote = serializeNote(marquee)

    await fs.write(cheminFiche, fiche)
    try {
      await fs.write(cheminNote, texteNote)
    } catch (e) {
      return refus(`Chantier « ${c.id} » créé, mais la note n’a pas pu être marquée (${premiereLigne(e)}) : elle reste dans « À faire ».`)
    }
    return { ok: true, id: c.id, titre: c.titre }
  } catch (e) {
    return refus(`Le chantier n’a pas pu être créé (${premiereLigne(e)}).`)
  }
}
