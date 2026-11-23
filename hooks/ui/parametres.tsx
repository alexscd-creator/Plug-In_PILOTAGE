// Page « Paramètres » (maquette §7, écran 07). Les réglages suivent le type de projet : leurs libellés viennent du vocabulaire et de
// `reglagesDef`. Chaque changement passe par `d.modifier` (validation complète puis écriture gardée de .pilotage/projet.json) ; le thème est
// un simple atome du panneau. Sans prénom connu, tout ce qui s'écrit est en lecture seule.
import type { ChoixTheme } from '../../types'
import { libelle } from '../model/presets.ts'
import { banniere, carte, titreSection } from './kit'
import type { Ctx } from './kit'
import { carteAgents, carteEquipe, cartePoles, carteWorkflow } from './parametres-edition'
import { champChoix, champTexte, interrupteur, ligneReglage, modifiable } from './parametres-base'
import type { DonneesParametres } from './parametres-base'

export type { DonneesParametres }

const THEMES: { id: ChoixTheme; label: string }[] = [
  { id: 'systeme', label: 'Système' }, { id: 'clair', label: 'Clair' }, { id: 'sombre', label: 'Sombre' },
]

function carteApparence(c: Ctx, d: DonneesParametres) {
  const { Box, Text, Button } = c.ui
  return carte(c, [
    <Box key="entete">{titreSection(c, 'Apparence')}</Box>,
    ligneReglage(c, 'themes', 'Thème', 'Ne change que ce panneau.', (
      <Box flexDirection="row" flexWrap="wrap" gap="xs">
        {THEMES.map(t => <Button key={`theme-${t.id}`} label={t.label} variant={d.theme === t.id ? 'primary' : 'secondary'} onPress={(() => d.choisirTheme(t.id)) as never} />)}
      </Box>
    )),
  ], { cle: 'parametres-apparence' })
}

/** Carte « Projet » : type (pastille), nom et objectif avec le vocabulaire du type. */
function carteProjet(c: Ctx, d: DonneesParametres) {
  const { Box, Text } = c.ui
  const p = d.projet
  const type = libelle(p, 'type')
  const champ = (cle: string, label: string, valeur: string) => (
    <Box key={cle} flexDirection="column" gap="xs">
      <Text size="caption" weight="semibold" color={c.j.texteDim}>{label}</Text>
      <Box paddingX="md" paddingY="sm" borderStyle="round" borderColor={c.j.bord} backgroundColor={c.j.releve}>
        <Text color={c.j.texte}>{valeur}</Text>
      </Box>
    </Box>
  )
  return carte(c, [
    <Box key="entete" flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap="md">
      {titreSection(c, 'Projet')}
      <Box key="type-projet" paddingX="sm" borderStyle="round" borderColor={c.j.accentSoft} backgroundColor={c.j.accentSoft}>
        <Text weight="semibold" size="footnote" color={c.j.accent}>{type}</Text>
      </Box>
    </Box>,
    champ('projet-nom', libelle(p, 'nomDuProjet'), p.nom),
    champ('projet-objectif', libelle(p, 'objectif'), p.but),
  ], { cle: 'parametres-projet' })
}

function carteType(c: Ctx, d: DonneesParametres) {
  const { Box, Text } = c.ui
  const p = d.projet
  const type = libelle(p, 'type')
  return carte(c, [
    <Box key="entete">{titreSection(c, `Réglages · ${type}`, `Réglages du type « ${type} ».`)}</Box>,
    p.reglagesDef.length === 0 ? <Text key="aucun" color={c.j.texteDim}>Ce type de projet n’a pas de réglage propre.</Text> : null,
    ...p.reglagesDef.map(def => {
      const v = p.reglages[def.id] ?? def.defaut
      const cle = `reglage-${def.id}`
      const champ = def.genre === 'oui-non'
        ? interrupteur(c, d, cle, def.libelle, v === true, 'Activé', 'Désactivé', () => d.modifier({ type: 'reglage', id: def.id, valeur: v !== true }))
        : def.genre === 'choix'
          ? champChoix(c, d, cle, def.libelle, typeof v === 'string' ? v : undefined, def.options ?? [], x => d.modifier({ type: 'reglage', id: def.id, valeur: x }))
          : champTexte(c, d, cle, def.libelle, typeof v === 'string' ? v : '', x => d.modifier({ type: 'reglage', id: def.id, valeur: x }))
      return (
        <Box key={`bloc-${def.id}`} flexDirection="column" gap="xs">
          {champ}
          {def.aide ? <Text size="caption" color={c.j.texteDim}>{def.aide}</Text> : null}
        </Box>
      )
    }),
  ], { cle: 'parametres-type', actif: true })
}

function carteGithub(c: Ctx) {
  const { Box, Text } = c.ui
  return carte(c, [
    <Box key="entete" flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
      {titreSection(c, 'Collaboration GitHub')}
      <Box key="etiquette-bientot" alignSelf="flex-start" paddingX="sm" borderStyle="round" borderColor={c.j.accentSoft} backgroundColor={c.j.accentSoft}>
        <Text weight="semibold" size="footnote" color={c.j.accent}>Bientôt</Text>
      </Box>
    </Box>,
    <Text key="phrase" color={c.j.texteSec}>Partager le projet avec l’équipe par GitHub.</Text>,
  ], { cle: 'parametres-github', fond: c.j.releve })
}

export function pageParametres(c: Ctx, d: DonneesParametres) {
  const { Box, Text } = c.ui
  return [
    <Box key="intro" flexDirection="column" gap="xs">
      <Text key="titre-page" weight="bold" size="title" color={c.j.texte}>Paramètres</Text>
      <Text color={c.j.texteSec}>Les réglages suivent le type de projet.</Text>
    </Box>,
    ...(!modifiable(d) ? [<Text key="lecture-seule" color={c.j.texteSec}>Indiquez votre prénom pour modifier les réglages</Text>] : []),
    ...(d.erreurs.length > 0 ? [<Box key="parametres-erreurs" flexDirection="column">{banniere(c, 'erreur', 'Modification refusée', d.erreurs.join(' '))}</Box>] : []),
    carteProjet(c, d),
    carteType(c, d),
    carteApparence(c, d),
    cartePoles(c, d),
    carteWorkflow(c, d),
    carteAgents(c, d),
    carteEquipe(c, d),
    carteGithub(c),
  ]
}
