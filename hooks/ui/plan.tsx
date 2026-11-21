// Page « Plan » (maquette §6, écran 02) : légende des états, bandeau de porte, une carte par phase et ses tâches.
// LIT seulement : le fichier plan.md se modifie à la main, jamais d'ici.
import type { Portes } from '../model/phases.ts'
import type { Statut, Tache } from '../model/plan.ts'
import { avancementGlobal, bandeauPorte, resumerPhases } from '../model/synthese.ts'
import type { Projet } from '../model/projet.ts'
import { pluriel } from './apercu'
import type { NomIcone } from './icones'
import { avatar, banniere, barreProgression, boutonCopier, carte, iconeEl, titreSection } from './kit'
import type { Ctx } from './kit'

export type DonneesPlan = {
  projet: Projet
  taches: Tache[]
  moi: string
  portes: Record<string, Portes>
  copier: (texte: string, surface?: string) => Promise<void>
}

const STATUTS: Statut[] = ['a faire', 'en cours', 'termine', 'reporte', 'abandonne']
const LIBELLES: Record<Statut, string> = { 'a faire': 'À faire', 'en cours': 'En cours', termine: 'Terminé', reporte: 'Reporté', abandonne: 'Abandonné' }
const ICONES: Record<Statut, NomIcone> = { 'a faire': 'a-faire', 'en cours': 'en-cours', termine: 'termine', reporte: 'reporte', abandonne: 'abandonne' }

/** Couleur d'un statut (maquette §6) : jamais seule, toujours avec l'icône et le libellé. */
function couleurStatut(c: Ctx, s: Statut): string {
  const { j } = c
  return { 'a faire': j.texteDim, 'en cours': j.etats.travail.fg, termine: j.etats.termine.fg, reporte: j.etats.attente.fg, abandonne: j.etats.arrete.fg }[s]
}

export function statut(c: Ctx, s: Statut, cle: string) {
  const { Box, Text } = c.ui
  const col = couleurStatut(c, s)
  return (
    <Box key={cle} flexDirection="row" alignItems="center" gap="xs" flexShrink={0}>
      <Box>{iconeEl(c, ICONES[s], 18, col)}</Box>
      <Text weight="semibold" size="footnote" color={col}>{LIBELLES[s]}</Text>
    </Box>
  )
}

function legende(c: Ctx) {
  const { Box } = c.ui
  return carte(c, [
    titreSection(c, 'États d’une tâche'),
    <Box key="etats" flexDirection="row" flexWrap="wrap" gap="lg">{STATUTS.map(s => statut(c, s, `legende-${s}`))}</Box>,
  ], { cle: 'carte-legende' })
}

/** Ligne de tâche : large (statut, titre et chemin, responsable, copier) ou compacte sur mobile (empilée). */
export function ligneTache(c: Ctx, t: Tache, copier: DonneesPlan['copier']) {
  const { Box, Text } = c.ui
  const { j } = c
  const titre = (
    <Text key="titre" color={t.statut === 'abandonne' ? j.texteDim : t.statut === 'termine' ? j.texteSec : j.texte} {...(t.statut === 'abandonne' ? { strikethrough: true } : {})}>{t.titre}</Text>
  )
  const chemin = t.fichier ? <Text key="chemin" size="caption" mono color={j.texteDim}>{t.fichier}</Text> : null
  const responsable = t.auteur ? (
    <Box key="responsable" flexDirection="row" alignItems="center" gap="sm" flexShrink={0}>
      {avatar(c, t.auteur)}
      <Text size="footnote" color={j.texteSec}>{t.auteur}</Text>
    </Box>
  ) : null
  const copie = t.fichier ? boutonCopier(c, t.id, t.fichier, copier) : null
  if (c.mobile) {
    return (
      <Box key={`tache-${t.id}`} flexDirection="column" gap="xs" paddingY="sm" borderStyle="round" borderColor={j.bord}>
        <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap="sm">
          {statut(c, t.statut, `statut-${t.id}`)}
          {copie}
        </Box>
        {titre}
        {chemin}
        {responsable}
      </Box>
    )
  }
  return (
    <Box key={`tache-${t.id}`} flexDirection="row" alignItems="center" gap="md" paddingY="sm" borderStyle="round" borderColor={j.bord}>
      <Box key="colonne-statut" width={14} flexShrink={0}>{statut(c, t.statut, `statut-${t.id}`)}</Box>
      <Box key="colonne-titre" flexDirection="column" flexGrow={1} flexShrink={1}>
        {titre}
        {chemin}
      </Box>
      {responsable}
      {copie}
    </Box>
  )
}

export const ETATS_PHASE = {
  terminee: { libelle: 'Terminée', etat: 'termine' },
  'en-cours': { libelle: 'En cours', etat: 'travail' },
  'a-venir': { libelle: 'À venir', etat: 'arrete' },
} as const

export function chipEtatPhase(c: Ctx, etat: keyof typeof ETATS_PHASE) {
  const { Box, Text } = c.ui
  const t = c.j.etats[ETATS_PHASE[etat].etat]
  return (
    <Box key="etat-phase" alignSelf="flex-start" flexDirection="row" alignItems="center" gap="xs" paddingX="sm" borderStyle="round" borderColor={t.soft} backgroundColor={t.soft}>
      {iconeEl(c, t.icone, 14, t.fg)}
      <Text weight="semibold" size="footnote" color={t.fg}>{ETATS_PHASE[etat].libelle}</Text>
    </Box>
  )
}

function cartePhase(c: Ctx, cle: string, titre: string, etat: keyof typeof ETATS_PHASE | null, taches: Tache[], copier: DonneesPlan['copier'], pied?: string) {
  const { Box, Text } = c.ui
  const g = avancementGlobal(taches)
  return carte(c, [
    <Box key="entete" flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
      <Text weight="semibold" size="heading" color={c.j.texte}>{titre}</Text>
      {etat ? chipEtatPhase(c, etat) : null}
    </Box>,
    barreProgression(c, `Avancement : ${titre}`, g.pourcent / 100),
    taches.length === 0
      ? <Text key="vide" size="footnote" color={c.j.texteDim}>Aucune tâche dans cette phase.</Text>
      : <Box key="taches" flexDirection="column">{taches.map(t => ligneTache(c, t, copier))}</Box>,
    pied ? <Text key="pied" size="footnote" weight="semibold" color={c.j.etats.attente.fg}>{pied}</Text> : null,
  ], { cle })
}

export function pagePlan(c: Ctx, d: DonneesPlan) {
  const { Box, Text } = c.ui
  const intro = (
    <Box key="intro" flexDirection="column" gap="xs">
      <Text color={c.j.texteSec}>Le cahier des charges est le plan de travail : chaque point à faire est une tâche.</Text>
      <Text color={c.j.texteSec}>Chaque tâche liée à un fichier a un bouton « Copier le chemin » pour l’ouvrir dans votre éditeur.</Text>
    </Box>
  )
  if (d.taches.length === 0) {
    return [intro, legende(c), carte(c, [
      <Text key="titre" weight="semibold" color={c.j.texte}>Aucune tâche dans le plan</Text>,
      <Text key="aide" size="caption" color={c.j.texteDim}>Le plan se remplit dans le fichier .pilotage/plan.md : une ligne par tâche.</Text>,
    ], { cle: 'carte-plan-vide' })]
  }
  const ph = resumerPhases(d.projet, d.taches, d.moi, d.portes)
  const connues = new Set(d.projet.phases.map(p => p.id))
  const sections: unknown[] = []
  const courante = ph.actuelle ? bandeauPorte(d.taches, ph.actuelle.id) : { bloquee: false, ouvertes: [] as Tache[] }
  if (ph.actuelle && courante.bloquee) {
    const n = courante.ouvertes.length
    sections.push(banniere(c, 'avertissement', 'Tâches ouvertes : impossible de valider la porte',
      `Phase ${ph.indice} « ${ph.actuelle.titre} » : ${n > 1 ? `${n} tâches ne sont ni terminées, ni reportées, ni abandonnées` : '1 tâche n’est ni terminée, ni reportée, ni abandonnée'}. Choisissez un état pour chacune avant de valider la porte.`))
  }
  ph.historique.forEach((h, i) => {
    const ici = d.taches.filter(t => t.phase === h.phase.id)
    const pied = h.etat === 'en-cours' && courante.bloquee
      ? `Porte verrouillée : ${pluriel(courante.ouvertes.length, 'tâche ouverte', 'tâches ouvertes')}. Chaque tâche doit être terminée, reportée ou abandonnée.`
      : undefined
    sections.push(cartePhase(c, `phase-${h.phase.id}`, `Phase ${i + 1} · ${h.phase.titre}`, h.etat, ici, d.copier, pied))
  })
  const orphelines = d.taches.filter(t => !connues.has(t.phase))
  if (orphelines.length > 0) sections.push(cartePhase(c, 'phase-sans', 'Sans phase', null, orphelines, d.copier))
  return [intro, legende(c), ...sections]
}
