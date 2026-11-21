// Page « Agents » (maquette §6, écran 06) : grille de cartes colorées par pôle, état en direct, skills en boutons, filtre par pôle,
// légende des six états. LIT seulement. Les états viennent de `fusionnerEtats` (jamais inventés) ; les textes des fiches ne sont qu'affichés.
import { etatStatut } from '../model/chantiers.ts'
import type { AgentDef } from '../model/projet.ts'
import { detailAgent } from './agent-detail'
import { boutonVoir, cheminSkill, poleAgent } from './agents-base'
import type { DonneesAgents } from './agents-base'
import { avatar, carte, chipPole, pastille } from './kit'
import type { Ctx } from './kit'
import { ETATS } from './theme'

export type { DonneesAgents }

function chipSkill(c: Ctx, d: DonneesAgents, a: AgentDef, skill: string, k: number) {
  const { Box, Text } = c.ui
  const installe = d.fichesSkills[skill] === true
  return (
    <Box key={`chip-skill-${a.id}-${k}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="xs" paddingX="sm" borderStyle="round" borderColor={c.j.bord} backgroundColor={c.j.releve}>
      <Text size="caption" mono color={c.j.texteSec}>{skill}</Text>
      {installe
        ? boutonVoir(c, `skill-${a.id}-${k}`, 'Voir le skill', cheminSkill(skill), d.copier)
        : <Text key={`absent-${a.id}-${k}`} size="caption" color={c.j.texteDim}>skill non installé</Text>}
    </Box>
  )
}

function carteAgent(c: Ctx, d: DonneesAgents, a: AgentDef) {
  const { Box, Text, Button } = c.ui
  const { pole, teinte } = poleAgent(d.projet, a)
  const t = teinte ? c.j.poles[teinte] : null
  const etat = d.etats.find(e => e.agent === a.id)
  const actif = a.actif !== false
  return carte(c, [
    <Box key="entete" flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
      {avatar(c, a.titre, actif ? teinte : undefined)}
      <Text weight="semibold" color={actif ? (t?.fg ?? c.j.texte) : c.j.texteDim}>{a.titre}</Text>
      {pole && teinte ? chipPole(c, pole.titre, teinte) : null}
      {actif ? null : <Text key="desactive" size="footnote" weight="semibold" color={c.j.texteDim}>Désactivé</Text>}
    </Box>,
    <Box key="etat" flexDirection="row" flexWrap="wrap" alignItems="center" gap="sm">
      {pastille(c, etatStatut(etat?.etat ?? 'arrete'))}
      {etat && etat.quoi !== '' ? <Text size="footnote" color={c.j.texteSec}>{etat.quoi}</Text> : null}
    </Box>,
    a.pourquoi !== '' ? <Text key="pourquoi" color={c.j.texteSec}>{`Pourquoi spécialisé : ${a.pourquoi}`}</Text> : null,
    a.skills.length > 0 ? (
      <Box key="skills" flexDirection="row" flexWrap="wrap" gap="sm">
        {a.skills.map((s, k) => chipSkill(c, d, a, s, k))}
      </Box>
    ) : null,
    <Box key="actions" flexDirection="row" gap="sm">
      <Button key={`ouvrir-${a.id}`} label="Voir le détail" variant="secondary" onPress={() => d.ouvrir(a.id)} />
    </Box>,
  ], { cle: `agent-${a.id}`, ...(t && actif ? { bord: t.fg, fond: t.soft } : actif ? {} : { fond: c.j.releve }) })
}

/** Légende : les six états, chacun avec son icône et son libellé. */
function legende(c: Ctx) {
  const { Box, Text } = c.ui
  return (
    <Box key="legende-etats" flexDirection="column" gap="sm">
      <Text size="caption" weight="semibold" color={c.j.texteDim}>États</Text>
      <Box flexDirection="row" flexWrap="wrap" gap="sm">{ETATS.map(e => pastille(c, e))}</Box>
    </Box>
  )
}

function filtres(c: Ctx, d: DonneesAgents, filtre: string) {
  const { Box, Text, Button } = c.ui
  const bouton = (cle: string, id: string, label: string) => (
    <Button key={cle} label={label} variant={filtre === id ? 'primary' : 'secondary'} onPress={() => d.filtrer(id)} />
  )
  return (
    <Box key="filtres" flexDirection="column" gap="sm">
      <Text size="caption" weight="semibold" color={c.j.texteDim}>Pôles</Text>
      <Box flexDirection="row" flexWrap="wrap" gap="sm">
        {bouton('filtre-tous', '', 'Tous')}
        {d.projet.poles.map(p => bouton(`filtre-${p.id}`, p.id, p.titre))}
      </Box>
    </Box>
  )
}

export function pageAgents(c: Ctx, d: DonneesAgents) {
  const { Text } = c.ui
  const agents = d.projet.agents
  const ouvert = agents.find(a => a.id === d.ouvert)
  if (ouvert) return [detailAgent(c, d, ouvert)]
  if (agents.length === 0) return [<Text key="aucun-agent" color={c.j.texteDim}>Aucun agent défini pour ce projet.</Text>]
  const filtre = d.projet.poles.some(p => p.id === d.filtre) ? d.filtre : ''
  const visibles = agents.filter(a => filtre === '' || a.pole === filtre)
  const { Box } = c.ui
  return [
    <Text key="intro" color={c.j.texteSec}>Les agents du projet. L’état vient des appels en cours dans cette session et des fiches de chantier : sans signe, un agent est « Arrêté ».</Text>,
    filtres(c, d, filtre),
    legende(c),
    <Box key="grille" flexDirection="row" flexWrap="wrap" gap="lg" width="100%">
      {visibles.map(a => <Box key={`cellule-${a.id}`} flexDirection="column" width={c.mobile ? '100%' : '48%'}>{carteAgent(c, d, a)}</Box>)}
    </Box>,
  ]
}
