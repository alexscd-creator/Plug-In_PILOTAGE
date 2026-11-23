// Page « À faire » (maquette, section 09) : les idées, retours et petites tâches de toute l'équipe, classés dans la conversation (une
// note par fichier, chez son auteur). Une note se complète en discutant avec Claude ; « Lancer en chantier » (notes du membre
// courant seulement) en fait un chantier, et la note passe dans « Déjà en chantier ». Le texte des notes est une donnée : il n'est
// jamais interprété, seulement affiché (extrait borné).
import { separerAvis } from '../model/chantiers.ts'
import type { NoteLue } from '../model/lecture.ts'
import { memeMembre } from '../model/projet.ts'
import type { Projet } from '../model/projet.ts'
import { GLYPHES } from './icones'
import { banniere, boutonCopier, bulle, carte } from './kit'
import type { Ctx } from './kit'

export type FiltreIdees = 'tout' | 'idee' | 'feedback'
export type DonneesIdees = {
  projet: Projet
  /** Dossier racine du projet : le chemin copié est absolu. */
  racine: string
  notes: NoteLue[]
  /** Lignes de lecture : erreurs, `(avertissement) ` et `(info) ` (voir `separerAvis`). */
  erreursNotes: string[]
  filtre: FiltreIdees
  filtrer: (f: FiltreIdees) => void | Promise<void>
  copier: (texte: string, surface?: string) => Promise<void>
  /** Section « Déjà en chantier » dépliée. */
  dejaOuvert: boolean
  basculerDeja: () => void | Promise<void>
  /** Membre courant ('' : inconnu, donc pas de bouton « Lancer en chantier »). */
  moi: string
  /** Lance la note en chantier ; absent : pas de bouton. Le bouton n'apparaît que sur les notes rangées chez `moi`. */
  lancer?: (n: NoteLue) => void | Promise<void>
}

export const PHRASE_VIDE = 'Rien à faire pour l’instant. Lancez une idée ou un retour dans la conversation : il sera classé ici.'
export const INTRO = 'Les idées, retours et petites tâches du projet. Complétez-les avec Claude ; un bouton les lance en chantier.'
const MAX_EXTRAIT = 280

/** Une phrase pour les notes ou dossiers illisibles. */
function resumeErreurs(erreurs: string[]): string {
  const notes = erreurs.filter(e => e.startsWith('La note') || e.startsWith('Note trop volumineuse')).length
  const dossiers = erreurs.length - notes
  const phrases: string[] = []
  if (notes > 0) phrases.push(`${notes} ${notes > 1 ? 'notes n’ont pas pu être lues' : 'note n’a pas pu être lue'}`)
  if (dossiers > 0) phrases.push('Un dossier de notes n’a pas pu être lu.')
  return phrases.join('. ')
}

/** Notes illisibles (erreur), auteur différent (avertissement), notes anciennes omises (info) : jamais de quoi cacher les notes lues. */
function cartesLecture(c: Ctx, lignes: string[]) {
  const { Box, Text } = c.ui
  const { erreurs, avertissements, infos } = separerAvis(lignes)
  return [
    erreurs.length > 0 ? <Box key="notes-lecture-erreurs">{banniere(c, 'erreur', resumeErreurs(erreurs), erreurs.join(String.fromCharCode(10)))}</Box> : null,
    avertissements.length > 0
      ? <Box key="notes-lecture-avertissements">{banniere(c, 'avertissement', 'À vérifier dans les notes', avertissements.join(String.fromCharCode(10)))}</Box>
      : null,
    infos.length > 0 ? <Box key="notes-lecture-infos"><Text size="caption" color={c.j.texteDim}>{infos.join(' ')}</Text></Box> : null,
  ]
}

/** Dossier du membre qui range la note (`.pilotage/equipe/<dossier>/…`). */
const dossierNote = (n: NoteLue): string => n.chemin.split('/')[2] ?? ''
/** Clé d'une note : le dossier du membre et l'identifiant (deux membres peuvent avoir le même identifiant). */
const cleNote = (n: NoteLue): string => `${dossierNote(n) || n.auteur}-${n.id}`
const extrait = (t: string): string => {
  const s = t.replace(/\s+/g, ' ').trim()
  return s.length > MAX_EXTRAIT ? `${s.slice(0, MAX_EXTRAIT).trimEnd()}…` : s
}
/** jj/mm d'une date ISO. */
const jourMois = (d: string): string => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[2]}/${m[1]}` : d.slice(0, 10)
}
const meta = (n: NoteLue): string => `${n.type === 'idee' ? 'Idée' : 'Retour'} · ${n.auteur} · ${jourMois(n.date)}`
/** Une note encore à faire : pas encore lancée en chantier. */
export const aFaire = (n: NoteLue): boolean => (n.lance ?? '') === ''
/** Une note que le membre courant peut lancer : rangée dans son propre dossier (on n'écrit que chez soi). */
export const notePropre = (n: NoteLue, moi: string): boolean => moi !== '' && dossierNote(n) !== '' && memeMembre(dossierNote(n), moi)

function copierNote(c: Ctx, d: DonneesIdees, n: NoteLue) {
  const racine = d.racine.replaceAll(String.fromCharCode(92), '/').replace(/\/+$/, '')
  return boutonCopier(c, `note-${cleNote(n)}`, `${racine}/${n.chemin}`, d.copier, c.surface === 'terminal' ? 'Copier le chemin' : GLYPHES.copier)
}

function carteNote(c: Ctx, d: DonneesIdees, n: NoteLue) {
  const { Box, Button, Text } = c.ui
  const { j } = c
  const cle = cleNote(n)
  const phase = n.phase === '' ? null : (d.projet.phases.find(p => p.id === n.phase)?.titre ?? n.phase)
  const texte = extrait(n.texte)
  const lancer = d.lancer
  return carte(c, [
    <Box key="entete" flexDirection="row" alignItems="flex-start" justifyContent="space-between" gap="md">
      <Box flexDirection="row" alignItems="center" gap="md" flexShrink={1}>
        {bulle(c, n.type === 'idee' ? 'idee' : 'alerte', 36)}
        <Box flexDirection="column" flexShrink={1}>
          <Text weight="semibold" color={j.texte}>{n.titre}</Text>
          <Text size="caption" color={j.texteDim}>{meta(n)}</Text>
        </Box>
      </Box>
      {copierNote(c, d, n)}
    </Box>,
    texte === '' ? null : <Text key="texte" color={j.texteSec}>{texte}</Text>,
    phase !== null || n.chantier !== '' ? (
      <Box key="liens" flexDirection="row" flexWrap="wrap" gap="lg">
        {phase !== null ? <Text key="lien-phase" size="footnote" color={j.texteDim}>{`Phase : ${phase}`}</Text> : null}
        {n.chantier !== '' ? <Text key="lien-chantier" size="footnote" color={j.texteDim}>{`Chantier : ${n.chantier}`}</Text> : null}
      </Box>
    ) : null,
    lancer && notePropre(n, d.moi) ? (
      <Box key="actions" flexDirection="row" justifyContent="flex-end">
        <Button key={`lancer-${cle}`} label={`${GLYPHES.play}  Lancer en chantier`} variant="primary" onPress={(() => lancer(n)) as never} />
      </Box>
    ) : null,
  ], { cle: `note-${cle}` })
}

function filtres(c: Ctx, d: DonneesIdees, notes: NoteLue[]) {
  const { Box, Button } = c.ui
  const nb = (t: 'idee' | 'feedback') => notes.filter(n => n.type === t).length
  const bouton = (id: FiltreIdees, label: string) => (
    <Button key={`filtre-${id}`} label={label} variant={d.filtre === id ? 'primary' : 'secondary'} onPress={() => d.filtrer(id)} />
  )
  return (
    <Box key="filtres" flexDirection="row" flexWrap="wrap" gap="sm">
      {bouton('tout', `${GLYPHES.plan}  Tout · ${notes.length}`)}
      {bouton('idee', `${GLYPHES.idee}  Idées · ${nb('idee')}`)}
      {bouton('feedback', `${GLYPHES.alerte}  Retours · ${nb('feedback')}`)}
    </Box>
  )
}

/** Section repliable « Déjà en chantier · n » : les notes lancées, avec le chantier qu'elles sont devenues. */
function dejaEnChantier(c: Ctx, d: DonneesIdees, lancees: NoteLue[]) {
  const { Box, Button, Text } = c.ui
  const { j } = c
  const resume = (n: NoteLue) => `${n.titre} → chantier « ${n.lance} »`
  return (
    <Box key="deja-en-chantier" flexDirection="column" gap="sm" paddingX="lg" paddingY="sm" borderStyle="round" borderColor={j.bord} backgroundColor={j.surface}>
      <Box flexDirection="row" alignItems="center" gap="md" flexWrap="wrap">
        <Button key="basculer-deja" label={`${d.dejaOuvert ? '⌄' : GLYPHES.chevron}  Déjà en chantier · ${lancees.length}`} onPress={(() => d.basculerDeja()) as never} />
        {d.dejaOuvert ? null : <Text size="caption" color={j.texteDim} wrap="truncate-end">{resume(lancees[0]!)}</Text>}
      </Box>
      {d.dejaOuvert
        ? lancees.map(n => (
            <Box key={`lancee-${cleNote(n)}`} flexDirection="row" alignItems="center" justifyContent="space-between" gap="sm">
              <Box flexDirection="column" flexShrink={1}>
                <Text color={j.texteSec}>{resume(n)}</Text>
                <Text size="caption" color={j.texteDim}>{meta(n)}</Text>
              </Box>
              {copierNote(c, d, n)}
            </Box>
          ))
        : null}
    </Box>
  )
}

/** Carte « Rien à faire » honnête : jamais d'exemple, seulement ce qui en crée. */
export function carteVide(c: Ctx) {
  const { Box, Text } = c.ui
  return carte(c, [
    <Box key="bulle" alignSelf="center">{bulle(c, 'idee', 48)}</Box>,
    <Text key="phrase" weight="semibold" color={c.j.texte}>{PHRASE_VIDE}</Text>,
  ], { cle: 'carte-idees-vide', centre: true })
}

export function pageIdees(c: Ctx, d: DonneesIdees) {
  const { Box, Text } = c.ui
  const filtre: FiltreIdees = d.filtre === 'idee' || d.filtre === 'feedback' ? d.filtre : 'tout'
  const ouvertes = d.notes.filter(aFaire)
  const lancees = d.notes.filter(n => !aFaire(n))
  const visibles = ouvertes.filter(n => filtre === 'tout' || n.type === filtre)
  const vide = ouvertes.length === 0 && d.erreursNotes.length === 0
  return [
    <Box key="intro" flexDirection="column" gap="xs">
      <Text key="titre-page" weight="bold" size="title" color={c.j.texte}>À faire</Text>
      <Text color={c.j.texteSec}>{INTRO}</Text>
    </Box>,
    ...cartesLecture(c, d.erreursNotes),
    ...(vide ? [carteVide(c)] : []),
    ...(ouvertes.length > 0 ? [filtres(c, d, ouvertes)] : []),
    ...(ouvertes.length > 0 && visibles.length === 0
      ? [<Text key="aucune-visible" color={c.j.texteDim}>{filtre === 'idee' ? 'Aucune idée à faire pour l’instant.' : 'Aucun retour à faire pour l’instant.'}</Text>]
      : []),
    visibles.length > 0 ? <Box key="liste-notes" flexDirection="column" gap="lg">{visibles.map(n => carteNote(c, d, n))}</Box> : null,
    lancees.length > 0 ? dejaEnChantier(c, d, lancees) : null,
  ]
}
