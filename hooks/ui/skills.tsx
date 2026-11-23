// Skills d'un agent (détail d'agent) : liste, « Ajouter un skill », « Retirer de cet agent », « Demander à Claude de le modifier »,
// « Copier le chemin », et la liste des skills sans agent avec « Supprimer le skill ». Les boutons qui changent `projet.json`
// (ajouter, retirer) passent par le chemin gardé ; le texte d'un skill et sa suppression passent par une demande à Claude :
// le panneau n'écrit aucun fichier de skill lui-même. Sans prénom connu (`gestion` absent) : lecture seule.
import { agentsUtilisant } from '../model/skills-gestion.ts'
import type { AgentDef } from '../model/projet.ts'
import { cheminSkill } from './agents-base'
import type { DonneesAgents } from './agents-base'
import { boutonCopier, carte, titreSection } from './kit'
import type { Ctx } from './kit'

export const MESSAGE_LECTURE_SEULE_SKILLS = 'Indiquez votre prénom pour modifier les skills'

/** Texte de ce qui se passe si le skill est encore utilisé : la suppression est alors refusée. */
const utilisePar = (d: DonneesAgents, skill: string, sauf?: string): string => {
  const autres = agentsUtilisant(d.projet, skill).filter(x => x.id !== sauf).map(x => x.titre)
  return autres.length === 0 ? '' : `Aussi utilisé par : ${autres.join(', ')}`
}

export function carteSkills(c: Ctx, d: DonneesAgents, a: AgentDef) {
  const { Box, Text, Button } = c.ui
  const { j } = c
  const g = d.gestion
  const bouton = (cle: string, label: string, onPress: () => unknown, variant: 'primary' | 'secondary' = 'secondary') => (
    <Button key={cle} label={label} variant={variant} onPress={(() => onPress()) as never} />
  )
  // Skills du projet que plus aucun agent n'utilise : les seuls qu'on peut supprimer.
  const libres = d.skillsDisponibles.filter(s => agentsUtilisant(d.projet, s).length === 0)
  return carte(c, [
    titreSection(c, 'Skills'),
    g ? null : <Text key="skills-lecture-seule" color={j.texteSec}>{MESSAGE_LECTURE_SEULE_SKILLS}</Text>,
    a.skills.length === 0 ? <Text key="aucun-skill" color={j.texteDim}>Aucun skill pour cet agent.</Text> : null,
    ...a.skills.map((s, k) => {
      const installe = d.fichesSkills[s] === true
      const aussi = utilisePar(d, s, a.id)
      return (
        <Box key={`skill-ligne-${a.id}-${k}`} flexDirection="column" gap="sm" padding="sm" backgroundColor={j.releve}>
          <Box flexDirection="column" flexShrink={1}>
            <Text weight="semibold" color={j.texte}>{s}</Text>
            <Text size="footnote" mono color={j.texteDim}>{cheminSkill(s)}</Text>
            {aussi !== '' ? <Text size="caption" color={j.texteDim}>{aussi}</Text> : <Text size="caption" color={j.texteDim}>Utilisé seulement par cet agent : le retirer ne supprime pas le skill.</Text>}
          </Box>
          <Box flexDirection="row" flexWrap="wrap" alignItems="center" gap="sm">
            {installe ? boutonCopier(c, `skill-${a.id}-${k}`, cheminSkill(s), d.copier) : <Text key={`absent-${a.id}-${k}`} size="caption" color={j.texteDim}>skill non installé</Text>}
            {g && installe ? bouton(`skill-modifier-${a.id}-${k}`, 'Demander à Claude de le modifier', () => g.demander(s)) : null}
            {g ? bouton(`skill-retirer-${a.id}-${k}`, 'Retirer de cet agent', () => g.retirer(a.id, s)) : null}
          </Box>
        </Box>
      )
    }),
    g ? <Box key="skill-ajout" alignSelf="flex-start">{bouton(`skill-ajouter-${a.id}`, 'Ajouter un skill', () => g.ajouter(a.id), 'primary')}</Box> : null,
    libres.length > 0 ? (
      <Box key="skills-libres" flexDirection="column" gap="sm">
        <Text weight="semibold" color={j.texte}>Skills du projet sans agent</Text>
        <Text size="caption" color={j.texteDim}>Aucun agent ne les utilise : on peut les supprimer.</Text>
        {libres.map(s => (
          <Box key={`skill-libre-${s}`} flexDirection="column" gap="sm" padding="sm" backgroundColor={j.releve}>
            <Text weight="semibold" color={j.texte}>{s}</Text>
            <Text size="footnote" mono color={j.texteDim}>{cheminSkill(s)}</Text>
            <Box flexDirection="row" flexWrap="wrap" alignItems="center" gap="sm">
              {boutonCopier(c, `skill-libre-${s}`, cheminSkill(s), d.copier)}
              {g ? bouton(`skill-modifier-libre-${s}`, 'Demander à Claude de le modifier', () => g.demander(s)) : null}
              {g ? bouton(`skill-supprimer-${s}`, 'Supprimer le skill', () => g.supprimer(s)) : null}
            </Box>
          </Box>
        ))}
      </Box>
    ) : null,
  ], { cle: `skills-agent-${a.id}` })
}
