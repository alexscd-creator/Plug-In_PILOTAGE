// Page « Agents » (maquette §6, écran 06) : grille de cartes neutres (teinte du pôle sur l'icône et la chip), état en direct, skills en boutons, filtre par pôle,
// légende des six états. LIT seulement. Les états viennent de `fusionnerEtats` (jamais inventés) ; les textes des fiches ne sont qu'affichés.
import { etatStatut } from '../model/chantiers.ts'
import type { AgentDef } from '../model/projet.ts'
import { detailAgent } from './agent-detail'
import { boutonVoir, cheminSkill, poleAgent } from './agents-base'
import type { DonneesAgents } from './agents-base'
import { GLYPHES } from './icones'
import { bulle, carte, chipPole, iconeEl, pastille, pointEl } from './kit'
import type { Ctx } from './kit'
import { couleurPole } from './theme'
import type { Teinte } from './theme'

export type { DonneesAgents }

/** Skill installé : la chip est le bouton (œil + nom, copie le chemin), comme la maquette. Absent : chip grise et mention. */
function chipSkill(c: Ctx, d: DonneesAgents, a: AgentDef, skill: string, k: number) {
  const { Box, Text } = c.ui
  if (d.fichesSkills[skill] === true) {
    return <Box key={`chip-skill-${a.id}-${k}`}>{boutonVoir(c, `skill-${a.id}-${k}`, `${GLYPHES.oeil} ${skill}`, cheminSkill(skill), d.copier)}</Box>
  }
  return (
    <Box key={`chip-skill-${a.id}-${k}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="xs" paddingX="sm" borderStyle="round" borderColor={c.j.bord} backgroundColor={c.j.releve}>
      <Text weight="semibold" size="footnote" color={c.j.texteDim}>{skill}</Text>
      <Text key={`absent-${a.id}-${k}`} size="caption" color={c.j.texteDim}>skill non installé</Text>
    </Box>
  )
}

/** Carte neutre (surface, bordure discrète) : la teinte du pôle n'est que sur la bulle, la chip et le point. */
function carteAgent(c: Ctx, d: DonneesAgents, a: AgentDef) {
  const { Box, Text, Button } = c.ui
  const { pole, teinte } = poleAgent(d.projet, a)
  const etat = d.etats.find(e => e.agent === a.id)
  const actif = a.actif !== false
  return carte(c, [
    <Box key="entete" flexDirection="row" alignItems="center" gap="lg">
      {bulle(c, 'agent', c.mobile ? 56 : 72, actif ? teinte : undefined)}
      <Box flexDirection="column" gap="xs" flexShrink={1}>
        <Text weight="bold" size="heading" color={actif ? c.j.texte : c.j.texteDim}>{a.titre}</Text>
        {actif ? null : <Text key="desactive" size="footnote" weight="semibold" color={c.j.texteDim}>Désactivé</Text>}
        <Box key="etat" flexDirection="row" flexWrap="wrap" alignItems="center" gap="sm">
          {pole && teinte ? chipPole(c, pole.titre, teinte) : null}
          {pastille(c, etatStatut(etat?.etat ?? 'arrete'))}
        </Box>
      </Box>
    </Box>,
    etat && etat.quoi !== '' ? <Text key="quoi" size="footnote" color={c.j.texteSec}>{etat.quoi}</Text> : null,
    a.pourquoi !== '' ? <Text key="pourquoi" size="footnote" color={c.j.texteSec}>{`Pourquoi spécialisé : ${a.pourquoi}`}</Text> : null,
    a.skills.length > 0 ? (
      <Box key="skills" flexDirection="row" flexWrap="wrap" gap="sm">
        {a.skills.map((s, k) => chipSkill(c, d, a, s, k))}
      </Box>
    ) : null,
    <Box key="espace" flexGrow={1} />,
    <Box key="actions" flexDirection="row" gap="sm">
      <Button key={`ouvrir-${a.id}`} label="Voir le détail" variant="secondary" onPress={() => d.ouvrir(a.id)} />
    </Box>,
  ], { cle: `agent-${a.id}`, grandir: true, ...(c.mobile ? {} : { hauteurMin: 380 }), ...(actif ? {} : { fond: c.j.releve }) })
}

function filtres(c: Ctx, d: DonneesAgents, filtre: string) {
  const { Box, Text, Button } = c.ui
  const bouton = (cle: string, id: string, label: string, teinte?: Teinte) => (
    <Box key={`${cle}-groupe`} flexDirection="row" alignItems="center" gap="xs">
      {teinte ? pointEl(c, c.j.poles[teinte].fg, label) : null}
      <Button key={cle} label={label} variant={filtre === id ? 'primary' : 'secondary'} onPress={() => d.filtrer(id)} />
    </Box>
  )
  return (
    <Box key="filtres" flexDirection="row" flexWrap="wrap" alignItems="center" gap="sm">
      <Text size="footnote" weight="semibold" color={c.j.texteSec}>Pôles :</Text>
      {bouton('filtre-tous', '', 'Tous')}
      {d.projet.poles.map((p, i) => bouton(`filtre-${p.id}`, p.id, p.titre, couleurPole(p.couleur, i)))}
    </Box>
  )
}

/** Skills cités par les agents dont le fichier manque dans le projet (sans doublon). */
export const skillsManquants = (d: DonneesAgents): string[] => [...new Set(d.projet.agents.flatMap(a => a.skills))].filter(s => d.fichesSkills[s] !== true)

/** Invite à installer les skills du preset : seulement quand il en manque et qu'on peut agir (prénom connu). */
function carteInstaller(c: Ctx, d: DonneesAgents) {
  const manquants = d.installer ? skillsManquants(d) : []
  if (!d.installer || manquants.length === 0) return null
  const { Box, Text, Button } = c.ui
  const installer = d.installer
  return carte(c, [
    <Box key="entete" flexDirection="row" alignItems="center" gap="md">
      {iconeEl(c, 'oeil', 18, c.j.accent)}
      <Text weight="semibold" color={c.j.texte}>{manquants.length === 1 ? '1 skill du projet n’est pas installé' : `${manquants.length} skills du projet ne sont pas installés`}</Text>
    </Box>,
    <Text key="aide" size="footnote" color={c.j.texteSec}>
      Les skills du type de projet sont copiés dans le projet sans rien écraser : ceux que vous avez déjà ou modifiés restent tels quels.
    </Text>,
    <Box key="actions" alignSelf="flex-start">
      <Button key="skills-installer" label="Installer les skills du preset" variant="primary" onPress={(() => installer()) as never} />
    </Box>,
  ], { cle: 'carte-installer-skills', actif: true })
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
    <Box key="intro" flexDirection="column" gap="xs">
      <Text key="titre-page" weight="bold" size="title" color={c.j.texte}>Agents</Text>
      <Text color={c.j.texteSec}>Les agents du projet, colorés par pôle. La pastille donne leur état en direct.</Text>
    </Box>,
    carteInstaller(c, d),
    filtres(c, d, filtre),
    <Box key="grille" flexDirection="row" flexWrap="wrap" gap="lg" width="100%">
      {visibles.map(a => <Box key={`cellule-${a.id}`} flexDirection="column" width={c.mobile ? '100%' : '48%'}>{carteAgent(c, d, a)}</Box>)}
    </Box>,
  ]
}
