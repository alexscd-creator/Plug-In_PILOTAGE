// Page « Idées » : les idées lancées et les retours donnés dans la conversation, classés automatiquement (une note par fichier,
// chez son auteur), de toute l'équipe. Pas d'écran dédié dans la maquette : mêmes cartes, puces, pastilles et bannières que la page
// Chantiers. LIT seulement : les notes se classent et se retirent dans la conversation, jamais d'ici. Le texte des notes est une
// donnée : il n'est jamais interprété, seulement affiché (extrait borné).
import { separerAvis } from '../model/chantiers.ts'
import type { NoteLue } from '../model/lecture.ts'
import type { Projet } from '../model/projet.ts'
import { avatar, banniere, boutonCopier, bulle, carte, iconeEl } from './kit'
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
}

export const PHRASE_VIDE = 'Aucune idée ni retour classé pour l’instant. Lancez une idée dans la conversation : elle sera classée automatiquement.'
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

/** Clé d'une note : le dossier du membre et l'identifiant (deux membres peuvent avoir le même identifiant). */
const cleNote = (n: NoteLue): string => `${n.chemin.split('/')[2] ?? n.auteur}-${n.id}`
const extrait = (t: string): string => {
  const s = t.replace(/\s+/g, ' ').trim()
  return s.length > MAX_EXTRAIT ? `${s.slice(0, MAX_EXTRAIT).trimEnd()}…` : s
}

function puceType(c: Ctx, n: NoteLue, cle: string) {
  const { Box, Text } = c.ui
  const idee = n.type === 'idee'
  const t = idee ? { fg: c.j.accent, soft: c.j.accentSoft } : c.j.poles.sarcelle
  return (
    <Box key={`chip-${cle}`} alignSelf="flex-start" flexDirection="row" alignItems="center" gap="xs" paddingX="sm" borderStyle="round" borderColor={t.soft} backgroundColor={t.soft}>
      {iconeEl(c, idee ? 'idee' : 'crayon', 14, t.fg)}
      <Text weight="semibold" size="footnote" color={t.fg}>{idee ? 'Idée' : 'Retour'}</Text>
    </Box>
  )
}

function carteNote(c: Ctx, d: DonneesIdees, n: NoteLue) {
  const { Box, Text } = c.ui
  const { j } = c
  const cle = cleNote(n)
  const phase = n.phase === '' ? null : (d.projet.phases.find(p => p.id === n.phase)?.titre ?? n.phase)
  const racine = d.racine.replaceAll(String.fromCharCode(92), '/').replace(/\/+$/, '')
  const texte = extrait(n.texte)
  return carte(c, [
    <Box key="entete" flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap="md">
      <Box flexDirection="row" alignItems="center" gap="md" flexShrink={1}>
        {avatar(c, n.auteur)}
        <Box flexDirection="column" flexShrink={1}>
          <Text weight="semibold" color={j.texte}>{n.titre}</Text>
          <Text size="caption" color={j.texteDim}>{`${n.date.slice(0, 10)} · ${n.auteur}`}</Text>
        </Box>
      </Box>
      {puceType(c, n, cle)}
    </Box>,
    texte === '' ? null : <Text key="texte" color={j.texteSec}>{texte}</Text>,
    phase !== null || n.chantier !== '' ? (
      <Box key="liens" flexDirection="row" flexWrap="wrap" gap="lg">
        {phase !== null ? <Text key="lien-phase" size="footnote" color={j.texteSec}>{`Phase : ${phase}`}</Text> : null}
        {n.chantier !== '' ? <Text key="lien-chantier" size="footnote" color={j.texteSec}>{`Chantier : ${n.chantier}`}</Text> : null}
      </Box>
    ) : null,
    <Box key="actions" flexDirection="row" gap="sm">{boutonCopier(c, `note-${cle}`, `${racine}/${n.chemin}`, d.copier)}</Box>,
  ], { cle: `note-${cle}` })
}

function filtres(c: Ctx, d: DonneesIdees) {
  const { Box, Button } = c.ui
  const nb = (t: 'idee' | 'feedback') => d.notes.filter(n => n.type === t).length
  const bouton = (id: FiltreIdees, label: string) => (
    <Button key={`filtre-${id}`} label={label} variant={d.filtre === id ? 'primary' : 'secondary'} onPress={() => d.filtrer(id)} />
  )
  return (
    <Box key="filtres" flexDirection="row" flexWrap="wrap" gap="sm">
      {bouton('tout', `Tout · ${d.notes.length}`)}
      {bouton('idee', `Idées · ${nb('idee')}`)}
      {bouton('feedback', `Retours · ${nb('feedback')}`)}
    </Box>
  )
}

/** Carte « Aucune idée ni retour » honnête : jamais d'exemple, seulement ce qui en crée. */
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
  const visibles = d.notes.filter(n => filtre === 'tout' || n.type === filtre)
  const vide = d.notes.length === 0 && d.erreursNotes.length === 0
  return [
    <Text key="intro" color={c.j.texteSec}>Les idées lancées et les retours donnés dans la conversation, classés automatiquement : une note par fichier, chez son auteur. Pour en retirer une, le demander dans la conversation.</Text>,
    ...cartesLecture(c, d.erreursNotes),
    ...(vide ? [carteVide(c)] : []),
    ...(d.notes.length > 0 ? [filtres(c, d)] : []),
    ...(d.notes.length > 0 && visibles.length === 0
      ? [<Text key="aucune-visible" color={c.j.texteDim}>{filtre === 'idee' ? 'Aucune idée classée pour l’instant.' : 'Aucun retour classé pour l’instant.'}</Text>]
      : []),
    visibles.length > 0 ? <Box key="liste-notes" flexDirection="column" gap="lg">{visibles.map(n => carteNote(c, d, n))}</Box> : null,
  ]
}
