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

/** Une étape de la frise : rang, titre, état, et la porte franchie pour une phase terminée. */
function etape(c: Ctx, d: DonneesPhases, et: EtapeFrise, i: number, choisie: boolean) {
  const { Box, Text, Button } = c.ui
  const id = et.phase.id
  const t = c.j.etats[ETATS_PHASE[et.etat].etat]
  return (
    <Box
      key={`etape-cadre-${id}`}
      flexShrink={0}
      padding="sm"
      borderStyle="round"
      borderColor={choisie ? c.j.accent : c.j.bord}
    >
      <Box flexDirection="column" gap="xs" alignItems="flex-start">
        <Box flexDirection="row" alignItems="center" gap="xs">
          {iconeEl(c, t.icone, 16, t.fg)}
          <Button key={`etape-${id}`} label={`Phase ${i + 1} : ${et.phase.titre}`} onPress={() => d.choisir(id)}>
            <Text weight="semibold" color={c.j.texte}>{` ${i + 1} · ${et.phase.titre} `}</Text>
          </Button>
        </Box>
        {chipEtatPhase(c, et.etat)}
        {et.etat === 'en-cours' ? <Text size="caption" color={c.j.texteDim}>{`${et.pourcent} %`}</Text> : null}
        {et.franchie ? chipPorte(c, et.franchie) : null}
      </Box>
    </Box>
  )
}

function frise(c: Ctx, d: DonneesPhases, choisie: string) {
  const { Box, Text } = c.ui
  const etapes = frisePhases(d.projet, d.taches, d.moi, d.portes)
  return (
    <Box key="frise-bloc" flexDirection="column" gap="sm">
      <Box
        key="frise"
        flexDirection="row"
        gap="md"
        {...(c.mobile ? { overflowX: 'scroll' as const } : { flexWrap: 'wrap' as const })}
      >
        {etapes.map((et, i) => etape(c, d, et, i, et.phase.id === choisie))}
      </Box>
      {c.mobile ? <Text key="aide-frise" size="caption" color={c.j.texteDim}>Faites glisser la frise pour voir toutes les phases.</Text> : null}
    </Box>
  )
}

function ligneFichier(c: Ctx, chemin: string, copier: DonneesPhases['copier']) {
  const { Box, Text } = c.ui
  return (
    <Box key={`fichier-${chemin}`} flexDirection="row" alignItems="center" justifyContent="space-between" gap="sm">
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
  const { Text } = c.ui
  const x = detailPhase(d.projet, d.taches, d.ouverte, d.moi, d.portes)
  if (!x) {
    return [carte(c, [
      <Text key="titre" weight="semibold" color={c.j.texte}>Aucune phase dans ce projet</Text>,
      <Text key="aide" size="caption" color={c.j.texteDim}>Les phases se définissent dans le fichier .pilotage/projet.json.</Text>,
    ], { cle: 'carte-phases-vide' })]
  }
  return [frise(c, d, x.phase.id), detail(c, x, d.copier)]
}
