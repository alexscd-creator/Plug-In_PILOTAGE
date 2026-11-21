// Page « Chantiers » (maquette §6, écran 04) : « En cours » et « Archivés », une carte non bloquante pour les fiches
// illisibles ou à avertissement. LIT seulement : les fiches se créent avec /chantier, jamais d'ici.
import { progressionChantier } from '../model/chantier.ts'
import type { Chantier } from '../model/chantier.ts'
import { grouperChantiers, nomAgent, resumeErreurs, resumePassation, separerAvis } from '../model/chantiers.ts'
import { pluriel } from './apercu'
import { banniere, bulle, carte, iconeEl, titreSection } from './kit'
import type { Ctx } from './kit'
import { cles, ligneChantier, ligneFichier } from './ligne-chantier'
import type { DonneesLigne } from './ligne-chantier'

export type DonneesChantiers = DonneesLigne & { chantiers: Chantier[]; erreursChantiers: string[] }

export const PHRASE_VIDE = 'Aucun chantier pour l’instant. Lancer un chantier : /chantier <nom> dans la conversation'

/** Carte « Aucun chantier » honnête : jamais d'exemple, seulement la commande qui en crée un. */
export function carteVide(c: Ctx) {
  const { Box, Text } = c.ui
  return carte(c, [
    <Box key="bulle" alignSelf="center">{bulle(c, 'chantier', 48)}</Box>,
    <Text key="phrase" weight="semibold" color={c.j.texte}>{PHRASE_VIDE}</Text>,
  ], { cle: 'carte-chantiers-vide', centre: true })
}

/** Fiches illisibles (erreur), chemins écartés (avertissement), archives omises (info, une simple ligne) : jamais de quoi cacher les chantiers lus. */
function cartesLecture(c: Ctx, lignes: string[]) {
  const { Box, Text } = c.ui
  const { erreurs, avertissements, infos } = separerAvis(lignes)
  return [
    erreurs.length > 0
      ? <Box key="chantiers-lecture-erreurs">{banniere(c, 'erreur', resumeErreurs(erreurs), erreurs.join(String.fromCharCode(10)))}</Box>
      : null,
    avertissements.length > 0
      ? <Box key="chantiers-lecture-avertissements">{banniere(c, 'avertissement', 'À vérifier dans les fiches', avertissements.join(String.fromCharCode(10)))}</Box>
      : null,
    infos.length > 0 ? <Box key="chantiers-lecture-infos"><Text size="caption" color={c.j.texteDim}>{infos.join(' ')}</Text></Box> : null,
  ]
}

function ligneArchive(c: Ctx, d: DonneesChantiers, ch: Chantier, cle: string) {
  const { Box, Text } = c.ui
  const { j } = c
  const p = progressionChantier(ch)
  const noms = ch.agents.map(a => nomAgent(d.projet, a.id))
  const fait = (k: string, icone: 'coche' | 'fichier' | 'agent', texte: string) => (
    <Box key={k} flexDirection="row" alignItems="center" gap="xs">
      {iconeEl(c, icone, 14, j.texteSec)}
      <Text size="footnote" color={j.texteSec}>{texte}</Text>
    </Box>
  )
  return carte(c, [
    <Box key="entete" flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap="md">
      <Box flexDirection="row" alignItems="center" gap="md" flexShrink={1}>
        {bulle(c, 'archive', 40)}
        <Box flexDirection="column" flexShrink={1}>
          <Text weight="semibold" color={j.texte}>{ch.titre}</Text>
          <Text size="caption" color={j.texteDim}>{`Du ${ch.cree.slice(0, 10)} au ${ch.maj.slice(0, 10)}`}</Text>
        </Box>
      </Box>
      <Box key={`badge-${cle}`} alignSelf="flex-start" flexDirection="row" alignItems="center" gap="xs" paddingX="sm" borderStyle="round" borderColor={j.bordFort} backgroundColor={j.releve}>
        {iconeEl(c, 'archive', 14, j.texteSec)}
        <Text weight="semibold" size="footnote" color={j.texteSec}>Archivé</Text>
      </Box>
    </Box>,
    <Box key="faits" flexDirection="row" flexWrap="wrap" gap="lg">
      {fait('faits-taches', 'coche', `${pluriel(p.faites, 'tâche faite', 'tâches faites')}`)}
      {fait('faits-fichiers', 'fichier', pluriel(ch.fichiers.length, 'fichier produit', 'fichiers produits'))}
      {fait('faits-agents', 'agent', noms.length === 0 ? 'Aucun agent' : `${noms.length > 1 ? 'Agents' : 'Agent'} : ${noms.join(', ')}`)}
    </Box>,
    <Box key="passation" flexDirection="column" gap="xs">
      <Text weight="semibold" size="footnote" color={j.texte}>Passation</Text>
      <Text color={j.texteSec}>{resumePassation(ch.passation)}</Text>
    </Box>,
    ch.fichiers.length > 0
      ? <Box key="fichiers" flexDirection="column" gap="sm">{ch.fichiers.map((f, k) => ligneFichier(c, d, `${cle}-${k}`, f))}</Box>
      : null,
  ], { cle: `chantier-${cle}` })
}

export function pageChantiers(c: Ctx, d: DonneesChantiers) {
  const { Box, Text } = c.ui
  const { enCours, archives } = grouperChantiers(d.chantiers)
  const lecture = cartesLecture(c, d.erreursChantiers)
  const clesEnCours = cles(enCours), clesArchives = cles(archives)
  return [
    <Text key="intro" color={c.j.texteSec}>Un chantier = une fiche + une sous-session. Mis à jour toutes les 5 secondes à partir des fiches de chantier. Les archivés gardent leur trace.</Text>,
    ...lecture,
    ...(enCours.length === 0 && archives.length === 0 && d.erreursChantiers.length === 0 ? [carteVide(c)] : []),
    enCours.length > 0 ? (
      <Box key="section-en-cours" flexDirection="column" gap="lg">
        {titreSection(c, `En cours · ${enCours.length}`, 'Session ouverte. « Copier le nom de la session » copie son nom : collez-le avec /resume pour revenir dans la sous-session du chantier.')}
        {enCours.map((ch, i) => ligneChantier(c, d, ch, clesEnCours[i]!))}
      </Box>
    ) : null,
    archives.length > 0 ? (
      <Box key="section-archives" flexDirection="column" gap="lg">
        {titreSection(c, `Archivés · ${archives.length}`, 'Session fermée. La trace reste : dates, tâches faites, passation, fichiers produits, agents intervenus.')}
        {archives.map((ch, i) => ligneArchive(c, d, ch, clesArchives[i]!))}
      </Box>
    ) : null,
  ]
}
