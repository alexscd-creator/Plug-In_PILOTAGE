// Détail d'un agent (maquette « Détail d'agent ») : définition, skills avec « Copier le chemin », fiche .md, outils, appels récents
// de CETTE session. Les skills se gèrent dans hooks/ui/skills.tsx. Les textes viennent des fichiers du projet : ils ne sont qu'affichés.
import { enLectureSeule, outilsAgent } from '../model/agents-registre.ts'
import { etatStatut } from '../model/chantiers.ts'
import type { AgentDef } from '../model/projet.ts'
import { boutonVoir, cheminAgent, poleAgent } from './agents-base'
import type { DonneesAgents } from './agents-base'
import { avatar, carte, chipPole, pastille, titreSection } from './kit'
import type { Ctx } from './kit'
import { carteSkills } from './skills'

const MIN = 60_000

/** « depuis 3 min » : durée écoulée, jamais une date inventée. */
export function depuisTexte(depuis: number, maintenant: number): string {
  const ms = Math.max(0, maintenant - depuis)
  if (!Number.isFinite(ms)) return 'depuis un moment'
  if (ms < MIN) return 'depuis moins d’une minute'
  const m = Math.floor(ms / MIN)
  return m < 60 ? `depuis ${m} min` : `depuis ${Math.floor(m / 60)} h`
}

export function detailAgent(c: Ctx, d: DonneesAgents, a: AgentDef) {
  const { Box, Text, Button } = c.ui
  const { j } = c
  const { pole, teinte } = poleAgent(d.projet, a)
  const t = teinte ? j.poles[teinte] : null
  const etat = d.etats.find(e => e.agent === a.id)
  const ligne = (cle: string, nom: string, valeur: string) => (
    <Box key={cle} flexDirection="row" flexWrap="wrap" gap="sm">
      <Text weight="semibold" color={j.texte}>{`${nom} :`}</Text>
      <Text color={j.texteSec}>{valeur}</Text>
    </Box>
  )
  const appels = [
    ...d.live.appels.filter(x => x.agent === a.id).map(x => ({ quoi: x.quoi, depuis: x.depuis, genre: 'Appel en cours' })),
    ...d.live.derniers.filter(x => x.agent === a.id).map(x => ({ quoi: x.quoi, depuis: x.depuis, genre: x.etat === 'bloque' ? 'Dernier appel : bloqué' : 'Dernier appel : fini' })),
  ].sort((x, y) => y.depuis - x.depuis)
  const outils = outilsAgent(a)
  const defaut = enLectureSeule(a)

  return (
    <Box key={`detail-agent-${a.id}`} flexDirection="column" gap="xl">
      <Box key="retour" alignSelf="flex-start">
        <Button key="retour-agents" label="Tous les agents" variant="secondary" onPress={() => d.ouvrir('')} />
      </Box>
      {carte(c, [
        <Box key="identite" flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
          {avatar(c, a.titre, teinte)}
          <Text weight="bold" size="title" color={t?.fg ?? j.texte}>{a.titre}</Text>
          {pole && teinte ? chipPole(c, pole.titre, teinte) : null}
          {pastille(c, etatStatut(etat?.etat ?? 'arrete'))}
          {etat && etat.quoi !== '' ? <Text size="footnote" color={j.texteSec}>{etat.quoi}</Text> : null}
        </Box>,
      ], { cle: `identite-agent-${a.id}`, ...(t ? { bord: t.fg, fond: t.soft } : {}) })}
      {carte(c, [
        titreSection(c, 'Définition'),
        ligne('def-role', 'Rôle', a.titre),
        ligne('def-pole', 'Pôle', pole?.titre ?? 'sans pôle'),
        a.pourquoi !== '' ? ligne('def-pourquoi', 'Pourquoi spécialisé', a.pourquoi) : null,
        <Box key="def-fiche" flexDirection="row" flexWrap="wrap" alignItems="center" gap="sm">
          <Text weight="semibold" color={j.texte}>Fiche :</Text>
          <Text mono color={j.texteSec}>{cheminAgent(a.id)}</Text>
          {d.fichesAgents[a.id] === true
            ? boutonVoir(c, `fiche-agent-${a.id}`, 'Voir la fiche .md', cheminAgent(a.id), d.copier)
            : <Text key={`fiche-absente-${a.id}`} size="caption" color={j.texteDim}>Fiche .md non installée</Text>}
        </Box>,
      ], { cle: `definition-agent-${a.id}` })}
      {carteSkills(c, d, a)}
      {carte(c, [
        titreSection(c, 'Outils autorisés'),
        <Box key="outils" flexDirection="row" flexWrap="wrap" gap="sm">
          {outils.map(o => (
            <Box key={`outil-${o}`} paddingX="sm" borderStyle="round" borderColor={j.bord} backgroundColor={j.releve}>
              <Text size="caption" mono color={j.texteSec}>{o}</Text>
            </Box>
          ))}
        </Box>,
        defaut ? <Text key="outils-defaut" size="footnote" color={j.texteDim}>Par défaut, en lecture seule : l’agent lit les fichiers, il ne modifie rien.</Text> : null,
      ], { cle: `outils-agent-${a.id}` })}
      {carte(c, [
        titreSection(c, 'Appels récents', 'Dans cette session seulement.'),
        appels.length === 0 ? <Text key="aucun-appel" color={j.texteDim}>Aucun appel dans cette session.</Text> : null,
        ...appels.map((x, k) => (
          <Box key={`appel-${a.id}-${k}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="sm" padding="sm" backgroundColor={j.releve}>
            <Text weight="semibold" color={j.texte}>{a.titre}</Text>
            <Text color={j.texteSec}>{x.quoi === '' ? x.genre : `${x.quoi} · ${x.genre}`}</Text>
            <Text size="caption" color={j.texteDim}>{depuisTexte(x.depuis, d.maintenant)}</Text>
          </Box>
        )),
      ], { cle: `appels-agent-${a.id}` })}
    </Box>
  )
}
