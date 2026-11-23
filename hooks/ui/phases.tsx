// Page « Phases » (maquette §6, écran 03) : frise des phases du projet et détail de la phase choisie. LIT seulement.
import type { Portes } from '../model/phases.ts'
import type { Tache } from '../model/plan.ts'
import type { Projet } from '../model/projet.ts'
import { detailPhase, frisePhases } from '../model/synthese.ts'
import type { DetailPhase, EtapeFrise, FranchieVue, PorteVue } from '../model/synthese.ts'
import { pluriel } from './apercu'
import { barreProgression, boutonCopier, carte, iconeEl, titreSection } from './kit'
import type { Ctx } from './kit'
import { chipEtatPhase, ETATS_PHASE, ligneTache } from './plan'

export type DonneesPhases = {
  projet: Projet
  taches: Tache[]
  moi: string
  portes: Record<string, Portes>
  /** Phase ouverte dans le détail ('' : la phase en cours). */
  ouverte: string
  choisir: (id: string) => void | Promise<void>
  copier: (texte: string, surface?: string) => Promise<void>
}

/** Type de porte franchie, dit tel quel : une phase sautée n'est jamais « validée à deux ». */
const FRANCHIE: Record<FranchieVue, string> = { 'a-deux': 'Validée à deux', validee: 'Validée', forcee: 'Forcée', sautee: 'Passée (porte plus loin)' }

const LIGNE_PORTE: Record<PorteVue, string> = {
  'a-deux': 'Porte : validée à deux',
  validee: 'Porte : validée',
  forcee: 'Porte : forcée',
  passee: 'Porte : passée (porte plus loin)',
  'en-attente': 'Porte : en attente de l’associé',
  refusee: 'Porte : l’associé a répondu « pas encore »',
  'a-valider': 'Porte : à valider',
  inconnu: 'Porte : état inconnu — indiquez votre prénom',
}

function chipPorte(c: Ctx, franchie: FranchieVue) {
  const { Box, Text } = c.ui
  const t = franchie === 'forcee' ? c.j.etats.attente : { fg: c.j.accent, soft: c.j.accentSoft }
  return (
    <Box key="chip-porte" alignSelf="flex-start" flexDirection="row" alignItems="center" gap="xs" paddingX="sm" borderStyle="round" borderColor={t.soft} backgroundColor={t.soft}>
      {iconeEl(c, 'verrou', 14, t.fg)}
      <Text weight="semibold" size="footnote" color={t.fg}>{FRANCHIE[franchie]}</Text>
    </Box>
  )
}

/** Une étape de la frise (maquette) : icône d'état, titre (le bouton), état ; l'étape choisie est encadrée d'accent. */
function etape(c: Ctx, d: DonneesPhases, et: EtapeFrise, i: number, choisie: boolean) {
  const { Box, Text, Button } = c.ui
  const id = et.phase.id
  const t = c.j.etats[ETATS_PHASE[et.etat].etat]
  const sous = et.etat === 'en-cours' ? `${ETATS_PHASE[et.etat].libelle} · ${et.pourcent} %` : ETATS_PHASE[et.etat].libelle
  return (
    <Box
      key={`etape-cadre-${id}`}
      flexShrink={0}
      paddingX="md"
      paddingY="sm"
      borderStyle="round"
      borderColor={choisie ? c.j.accent : c.j.surface}
      {...(choisie ? { backgroundColor: c.j.accentSoft } : {})}
    >
      <Box flexDirection="column" gap="xs" alignItems="center">
        {iconeEl(c, t.icone, 24, t.fg)}
        <Button key={`etape-${id}`} label={`Phase ${i + 1} : ${et.phase.titre}`} onPress={() => d.choisir(id)}>
          <Text weight="semibold" color={c.j.texte}>{et.phase.titre}</Text>
        </Button>
        <Text size="caption" color={et.etat === 'en-cours' ? t.fg : c.j.texteDim}>{sous}</Text>
      </Box>
    </Box>
  )
}

/** Trait entre deux étapes : vert après une phase terminée, gris sinon (dessin seulement hors terminal et mobile). */
function liaison(c: Ctx, cle: string, faite: boolean) {
  const Svg = (c.surface === 'terminal' ? undefined : (c.ui as { Svg?: unknown }).Svg) as any
  if (!Svg || c.mobile) return null
  const couleur = faite ? c.j.etats.termine.fg : c.j.bord
  return (
    <Svg key={cle} alt="liaison" width={40} height={2}
      source={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 2" width="40" height="2"><rect x="0" y="0" width="40" height="2" fill="${couleur}"/></svg>`} />
  )
}

function frise(c: Ctx, d: DonneesPhases, choisie: string) {
  const { Box, Text } = c.ui
  const etapes = frisePhases(d.projet, d.taches, d.moi, d.portes)
  const enfants: unknown[] = []
  etapes.forEach((et, i) => {
    if (i > 0) enfants.push(liaison(c, `liaison-${et.phase.id}`, etapes[i - 1]!.etat === 'terminee'))
    enfants.push(etape(c, d, et, i, et.phase.id === choisie))
  })
  return carte(c, [
    <Box
      key="frise"
      flexDirection="row"
      alignItems="center"
      justifyContent="center"
      gap="xs"
      {...(c.mobile ? { overflowX: 'scroll' as const } : { flexWrap: 'wrap' as const })}
    >
      {enfants}
    </Box>,
    c.mobile ? <Text key="aide-frise" size="caption" color={c.j.texteDim}>Faites glisser la frise pour voir toutes les phases.</Text> : null,
  ], { cle: 'frise-bloc' })
}

/** Carte « Portes franchies » : une ligne par phase terminée, le type de porte dit tel quel. */
function portesFranchies(c: Ctx, d: DonneesPhases) {
  const { Box, Text } = c.ui
  const franchies = frisePhases(d.projet, d.taches, d.moi, d.portes).filter(et => et.franchie)
  if (franchies.length === 0) return null
  return carte(c, [
    titreSection(c, 'Portes franchies'),
    ...franchies.map(et => (
      <Box key={`porte-franchie-${et.phase.id}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
        {chipPorte(c, et.franchie!)}
        <Text color={c.j.texteSec}>{et.phase.titre}</Text>
      </Box>
    )),
  ], { cle: 'portes-franchies' })
}

function ligneFichier(c: Ctx, chemin: string, copier: DonneesPhases['copier']) {
  const { Box, Text } = c.ui
  return (
    <Box key={`fichier-${chemin}`} flexDirection="row" alignItems="center" justifyContent="space-between" gap="sm" paddingX="md" paddingY="sm" borderStyle="round" borderColor={c.j.releve} backgroundColor={c.j.releve}>
      <Box flexDirection="row" alignItems="center" gap="sm" flexShrink={1}>
        {iconeEl(c, 'fichier', 16, c.j.texteSec)}
        <Text size="caption" mono color={c.j.texteSec} wrap="truncate-middle">{chemin}</Text>
      </Box>
      {boutonCopier(c, `fichier-${chemin}`, chemin, copier)}
    </Box>
  )
}

function detail(c: Ctx, x: DetailPhase, copier: DonneesPhases['copier']) {
  const { Box, Text } = c.ui
  const { j } = c
  const terminee = x.etat === 'terminee'
  const laissees = x.reportees + x.abandonnees
  return carte(c, [
    terminee ? <Text key="surtitre" size="caption" weight="semibold" color={j.accent}>Phase terminée sélectionnée</Text> : null,
    <Box key="entete" flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
      <Text weight="semibold" size="heading" color={j.texte}>{`Phase ${x.indice} · ${x.phase.titre}`}</Text>
      {chipEtatPhase(c, x.etat)}
      {x.franchie ? chipPorte(c, x.franchie) : null}
    </Box>,
    <Text key="sous-titre" size="caption" color={j.texteDim}>{pluriel(x.taches.length, 'tâche', 'tâches')}</Text>,
    barreProgression(c, `Avancement : ${x.phase.titre}`, x.avancement.pourcent / 100),
    terminee && laissees > 0
      ? <Text key="laissees" size="footnote" color={j.texteSec}>{`${pluriel(x.reportees, 'tâche reportée', 'tâches reportées')}, ${pluriel(x.abandonnees, 'abandonnée', 'abandonnées')}`}</Text>
      : null,
    <Text key="porte" weight="semibold" color={j.texteSec}>{LIGNE_PORTE[x.porte]}</Text>,
    <Box key="taches" flexDirection="column" gap="sm">
      {titreSection(c, 'Tâches de la phase (fermées comprises)')}
      {x.taches.length === 0
        ? <Text size="footnote" color={j.texteDim}>Aucune tâche dans cette phase.</Text>
        : <Box flexDirection="column">{x.taches.map(t => ligneTache(c, t, copier))}</Box>}
    </Box>,
    <Box key="fichiers" flexDirection="column" gap="sm">
      {titreSection(c, 'Fichiers de la phase')}
      {x.fichiers.length === 0
        ? <Text size="footnote" color={j.texteDim}>Aucun fichier lié aux tâches de cette phase.</Text>
        : <Box flexDirection="column" gap="sm">{x.fichiers.map(f => ligneFichier(c, f, copier))}</Box>}
    </Box>,
  ], { cle: 'detail-phase', actif: true })
}

export function pagePhases(c: Ctx, d: DonneesPhases) {
  const { Box, Text } = c.ui
  const x = detailPhase(d.projet, d.taches, d.ouverte, d.moi, d.portes)
  if (!x) {
    return [carte(c, [
      <Text key="titre" weight="semibold" color={c.j.texte}>Aucune phase dans ce projet</Text>,
      <Text key="aide" size="caption" color={c.j.texteDim}>Les phases se définissent dans le fichier .pilotage/projet.json.</Text>,
    ], { cle: 'carte-phases-vide' })]
  }
  const intro = (
    <Box key="intro" flexDirection="column" gap="xs">
      <Text key="titre-page" weight="bold" size="title" color={c.j.texte}>Phases</Text>
      <Text color={c.j.texteSec}>Cliquez une phase pour revoir ses tâches et ses fichiers.</Text>
    </Box>
  )
  return [intro, frise(c, d, x.phase.id), portesFranchies(c, d), detail(c, x, d.copier)].filter(Boolean)
}
