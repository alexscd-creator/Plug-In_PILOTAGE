// Page « Vue d'ensemble » (maquette §6, écran 01) : carte projet, pôles, plan, chantiers en cours. LIT seulement.
import type { Chantier } from '../model/chantier.ts'
import { grouperChantiers, resumeErreurs, separerAvis } from '../model/chantiers.ts'
import type { Portes } from '../model/phases.ts'
import type { Tache } from '../model/plan.ts'
import { avancementGlobal, avancementPole, resumerPhases } from '../model/synthese.ts'
import type { Projet } from '../model/projet.ts'
import { libelle } from '../model/presets.ts'
import type { NomIcone } from './icones'
import { avatar, barreProgression, bulle, carte, iconeEl, titreSection } from './kit'
import type { Ctx } from './kit'
import { carteVide } from './chantiers'
import { cles, ligneChantier } from './ligne-chantier'
import { couleurPole } from './theme'

export type DonneesApercu = {
  projet: Projet
  taches: Tache[]
  moi: string
  portes: Record<string, Portes>
  iconeType: NomIcone
  ouvrirPlan: () => void | Promise<void>
  /** Fiches de chantier lues avec le projet, leurs erreurs de lecture, l'heure et la copie d'un texte. */
  chantiers: Chantier[]
  erreursChantiers: string[]
  maintenant: number
  copier: (texte: string, surface?: string) => Promise<void>
}

export const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`

/** Pastille d'étiquette (type du projet, phase) : fond doux d'accent, icône facultative. */
function etiquette(c: Ctx, cle: string, texte: string, icone?: NomIcone) {
  const { Box, Text } = c.ui
  return (
    <Box key={cle} alignSelf="flex-start" flexDirection="row" alignItems="center" gap="xs" paddingX="sm" flexShrink={1} borderStyle="round" borderColor={c.j.accentSoft} backgroundColor={c.j.accentSoft}>
      {icone ? iconeEl(c, icone, 14, c.j.accent) : null}
      <Text weight="semibold" size="footnote" color={c.j.accent}>{texte}</Text>
    </Box>
  )
}

function carteProjet(c: Ctx, d: DonneesApercu) {
  const { Box, Text } = c.ui
  const { j } = c
  const g = avancementGlobal(d.taches)
  const enCours = grouperChantiers(d.chantiers).enCours.length
  const ph = resumerPhases(d.projet, d.taches, d.moi, d.portes)
  return carte(c, [
    <Box key="etiquettes" flexDirection="row" flexWrap="wrap" gap="sm">
      {etiquette(c, 'etiquette-type', libelle(d.projet, 'type'), d.iconeType)}
      {ph.actuelle
        ? etiquette(c, 'etiquette-phase', `Phase ${ph.indice} sur ${ph.sur} : ${ph.actuelle.titre}`)
        : ph.sur > 0 ? etiquette(c, 'etiquette-phase', 'Toutes les phases sont franchies') : null}
    </Box>,
    <Text key="nom" weight="bold" size="title" color={j.texte}>{d.projet.nom}</Text>,
    <Text key="objectif" color={j.texteSec}>{`Objectif : ${d.projet.but}`}</Text>,
    <Box key="progression" flexDirection="column" gap="sm">
      <Text weight="semibold" color={j.texte}>Progression du projet</Text>
      {barreProgression(c, 'Progression du projet', g.pourcent / 100)}
      <Text size="caption" color={j.texteDim}>{`${pluriel(g.faites, 'tâche terminée', 'tâches terminées')} sur ${g.total}${enCours > 0 ? ` · ${pluriel(enCours, 'chantier en cours', 'chantiers en cours')}` : ''}`}</Text>
    </Box>,
  ], { cle: 'carte-projet' })
}

/** Icône d'un pôle d'après son rang dans le projet (le projet n'en définit pas) : cible, code, crayon, bouclier, puis on recommence. */
export const ICONES_POLE: readonly NomIcone[] = ['cible', 'code', 'crayon', 'bouclier']

function cartePole(c: Ctx, d: DonneesApercu, i: number) {
  const { Box, Text } = c.ui
  const pole = d.projet.poles[i]!
  const teinte = couleurPole(pole.couleur, i)
  const a = avancementPole(d.projet, d.taches, pole.id, d.chantiers)
  const resume = a.total === 0 ? 'Aucune tâche rattachée' : `${pluriel(a.faites, 'tâche terminée', 'tâches terminées')} sur ${a.total}${a.dansChantiers > 0 ? ` (dont ${a.dansChantiers} dans des chantiers)` : ''}`
  return carte(c, [
    <Box key="entete" flexDirection="row" alignItems="center" gap="md">
      {bulle(c, ICONES_POLE[i % ICONES_POLE.length]!, 40, teinte)}
      <Box flexDirection="column" flexShrink={1}>
        <Text weight="semibold" color={c.j.texte}>{pole.titre}</Text>
        <Text size="caption" color={c.j.texteDim}>{resume}</Text>
      </Box>
    </Box>,
    barreProgression(c, `Avancement du pôle ${pole.titre}`, a.pourcent / 100, teinte, { partage: 2 }),
    <Box key="agents" flexDirection="column" gap="xs">
      <Text size="caption" weight="semibold" color={c.j.texteSec}>{a.agents.length === 0 ? 'Aucun agent' : pluriel(a.agents.length, 'agent', 'agents')}</Text>
      {a.agents.map(ag => (
        <Box key={`agent-${ag.id}`} flexDirection="row" alignItems="center" gap="sm">
          {avatar(c, ag.titre, teinte)}
          <Text color={c.j.texteSec} wrap="truncate-end">{ag.titre}</Text>
        </Box>
      ))}
    </Box>,
  ], { cle: `pole-${pole.id}` })
}

/** Grille de pôles : 2 colonnes (écart 16), une seule colonne sur mobile. */
function sectionPoles(c: Ctx, d: DonneesApercu) {
  const { Box, Text } = c.ui
  const cartes = d.projet.poles.map((_, i) => cartePole(c, d, i))
  const rangees: unknown[][] = []
  for (let i = 0; i < cartes.length; i += c.mobile ? 1 : 2) rangees.push(cartes.slice(i, i + (c.mobile ? 1 : 2)))
  return (
    <Box key="poles" flexDirection="column" gap="lg">
      {titreSection(c, 'Pôles du projet', 'Renommez-les ou ajoutez-en dans Paramètres.')}
      {cartes.length === 0 ? <Text color={c.j.texteDim}>Aucun pôle défini pour ce projet.</Text> : null}
      {rangees.map((r, k) => (
        <Box key={`rangee-${k}`} flexDirection="row" gap="lg">
          {r.map((x, m) => <Box key={`cellule-${k}-${m}`} flexGrow={1} flexShrink={1} width="50%">{x as never}</Box>)}
          {!c.mobile && r.length === 1 ? <Box key="cellule-vide" flexGrow={1} flexShrink={1} width="50%" /> : null}
        </Box>
      ))}
    </Box>
  )
}

function cartePlan(c: Ctx, d: DonneesApercu) {
  const { Box, Text, Button } = c.ui
  const ph = resumerPhases(d.projet, d.taches, d.moi, d.portes)
  const ouvertes = d.taches.filter(t => t.statut === 'a faire' || t.statut === 'en cours')
  const dansPhase = ph.actuelle ? ouvertes.filter(t => t.phase === ph.actuelle!.id).length : 0
  const resume = ouvertes.length === 0
    ? 'Aucune tâche ne reste à faire.'
    : `${ouvertes.length > 1 ? `${ouvertes.length} tâches restent` : '1 tâche reste'} à faire${ph.actuelle ? `, dont ${dansPhase} dans la phase en cours` : ''}`
  return carte(c, [
    <Box key="plan" flexDirection="row" alignItems="center" gap="md">
      {bulle(c, 'plan', 48)}
      <Box flexDirection="column" flexShrink={1}>
        <Text weight="semibold" size="heading" color={c.j.texte}>Plan</Text>
        <Text color={c.j.texteSec}>{resume}</Text>
      </Box>
    </Box>,
    <Box key="ouvrir" alignSelf="flex-start">
      <Button key="ouvrir-plan" label="Ouvrir le plan" variant="primary" onPress={() => d.ouvrirPlan()} />
    </Box>,
  ], { cle: 'carte-plan' })
}

/** « Chantiers en cours » : les vrais chantiers (mêmes lignes que la page Chantiers) ; sinon un état vide honnête. */
function sectionChantiers(c: Ctx, d: DonneesApercu) {
  const { Box, Text } = c.ui
  const { enCours } = grouperChantiers(d.chantiers)
  const ligne = { projet: d.projet, maintenant: d.maintenant, copier: d.copier }
  const nb = cles(enCours)
  // Seules les vraies erreurs comptent : un avertissement ou une info (archives omises) ne cache rien.
  const erreurs = separerAvis(d.erreursChantiers).erreurs
  const illisibles = erreurs.length
  return (
    <Box key="chantiers" flexDirection="column" gap="lg">
      {titreSection(c, 'Chantiers en cours', enCours.length > 0 ? 'Mis à jour toutes les 5 secondes.' : undefined)}
      {enCours.map((ch, i) => ligneChantier(c, ligne, ch, nb[i]!))}
      {enCours.length === 0 && d.chantiers.length === 0 && illisibles === 0 ? carteVide(c) : null}
      {enCours.length === 0 && d.chantiers.length > 0 ? <Text color={c.j.texteDim}>Aucun chantier en cours : tous sont archivés.</Text> : null}
      {illisibles > 0 ? <Text color={c.j.texteDim}>{`${resumeErreurs(erreurs)} : voir la page Chantiers.`}</Text> : null}
      <Text size="caption" color={c.j.texteDim}>Pour lancer un chantier : tapez /pilotage:chantier suivi de son nom dans la conversation.</Text>
    </Box>
  )
}

export function pageApercu(c: Ctx, d: DonneesApercu) {
  return [carteProjet(c, d), sectionPoles(c, d), cartePlan(c, d), sectionChantiers(c, d)]
}
