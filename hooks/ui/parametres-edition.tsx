// Cartes Workflow, Agents et Pôles de l'écran Paramètres. Les outils d'un agent n'y sont pas modifiables : ils sont réglés par le moteur.
import { texteMonWorkflow } from '../model/ecriture-projet.ts'
import { memeMembre, TEINTES_POLE } from '../model/projet.ts'
import { action, champChoix, champTexte, interrupteur } from './parametres-base'
import type { DonneesParametres } from './parametres-base'
import { avatar, carte, chipPole, titreSection } from './kit'
import type { Ctx } from './kit'
import { couleurPole } from './theme'

/** « Rôle : Outil » : coupé au premier deux-points ; null si l'un des deux manque. */
export function separerOutil(saisie: string): { role: string; outil: string } | null {
  const i = saisie.indexOf(':')
  if (i < 0) return null
  const role = saisie.slice(0, i).trim()
  const outil = saisie.slice(i + 1).trim()
  return role === '' || outil === '' ? null : { role, outil }
}

export function carteWorkflow(c: Ctx, d: DonneesParametres) {
  const { Box, Text } = c.ui
  const outils = d.projet.workflow.outils
  return carte(c, [
    <Box key="entete">{titreSection(c, 'Workflow', 'Les outils du projet, par rôle. Modifiable à tout moment : Entrée valide un champ.')}</Box>,
    <Box key="flux" flexDirection="column" gap="sm">
      {outils.map((o, i) => (
        <Box key={`flux-ligne-${i}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
          {champTexte(c, d, `flux-role-${i}`, 'Rôle', o.role, v => d.modifier({ type: 'workflowModifier', index: i, role: v, outil: o.outil }))}
          {champTexte(c, d, `flux-outil-${i}`, 'Outil', o.outil, v => d.modifier({ type: 'workflowModifier', index: i, role: o.role, outil: v }))}
          {action(c, d, `flux-retirer-${i}`, 'Retirer', () => d.modifier({ type: 'workflowRetirer', index: i }))}
        </Box>
      ))}
    </Box>,
    champTexte(c, d, 'flux-ajout', 'Ajouter un outil (Rôle : Outil)', '', v => {
      const s = separerOutil(v)
      return s ? d.modifier({ type: 'workflowAjouter', ...s }) : d.signaler(['Écrivez le rôle, deux-points, puis l’outil : par exemple « Son : Audacity ».'])
    }),
    <Box key="mon-workflow" flexDirection="column" gap="sm">
      <Text size="caption" weight="semibold" color={c.j.texteDim}>Mon workflow</Text>
      <Text size="caption" color={c.j.texteSec}>« Enregistrer comme mon workflow » écrit ce texte dans ~/.claude/pilotage/mon-workflow.json (il sert aux prochains projets) :</Text>
      {texteMonWorkflow(d.projet.workflow).trimEnd().split('\n').map((l, i) => <Text key={`mw-${i}`} mono size="caption" color={c.j.texteSec}>{l}</Text>)}
      {action(c, d, 'workflow-enregistrer', 'Enregistrer comme mon workflow', d.enregistrerWorkflow)}
      {d.monWorkflow ? action(c, d, 'workflow-charger', 'Charger mon workflow', d.chargerWorkflow) : null}
      {d.monWorkflow ? <Text key="charger-aide" size="caption" color={c.j.texteDim}>{`Charger mon workflow remplace la liste ci-dessus par celle de votre fichier (${d.monWorkflow.outils.length} outils) ; une confirmation est demandée.`}</Text> : null}
    </Box>,
  ], { cle: 'parametres-workflow' })
}

export function carteAgents(c: Ctx, d: DonneesParametres) {
  const { Box, Text } = c.ui
  const p = d.projet
  return carte(c, [
    <Box key="entete">{titreSection(c, 'Gestion des agents', 'Désactivé : pris en compte au prochain démarrage de la session ; l’agent reste appelable d’ici là.')}</Box>,
    p.agents.length === 0 ? <Text key="aucun" color={c.j.texteDim}>Aucun agent défini pour ce projet.</Text> : null,
    ...p.agents.map(a => {
      const i = p.poles.findIndex(x => x.id === a.pole)
      const teinte = i < 0 ? undefined : couleurPole(p.poles[i]!.couleur, i)
      const actif = a.actif !== false
      return (
        <Box key={`reglage-agent-${a.id}`} flexDirection="column" gap="sm" padding="md" borderStyle="round" borderColor={c.j.bord} backgroundColor={actif ? c.j.surface : c.j.releve}>
          <Box key="tete" flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
            {avatar(c, a.titre, teinte)}
            <Text weight="semibold" color={actif ? c.j.texte : c.j.texteDim}>{a.titre}</Text>
            {interrupteur(c, d, `agent-actif-${a.id}`, 'État', actif, 'Actif', 'Désactivé', () => d.modifier({ type: 'agentActiver', id: a.id, actif: !actif }))}
          </Box>
          {champTexte(c, d, `agent-titre-${a.id}`, 'Rôle', a.titre, v => d.modifier({ type: 'agentRole', id: a.id, titre: v, pourquoi: a.pourquoi }))}
          {champTexte(c, d, `agent-pourquoi-${a.id}`, 'Pourquoi spécialisé', a.pourquoi, v => d.modifier({ type: 'agentRole', id: a.id, titre: a.titre, pourquoi: v }))}
          {champTexte(c, d, `agent-skills-${a.id}`, 'Skills (séparés par des virgules)', a.skills.join(', '),
            v => d.modifier({ type: 'agentSkills', id: a.id, skills: v.split(',').map(s => s.trim()).filter(s => s !== '') }))}
        </Box>
      )
    }),
  ], { cle: 'parametres-agents' })
}

/** Identifiant de pôle tiré de son nom : minuscules sans accent, chiffres et tirets ; vide si rien ne reste. */
export const idDePole = (titre: string): string =>
  titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

export function cartePoles(c: Ctx, d: DonneesParametres) {
  const { Box, Text } = c.ui
  const p = d.projet
  return carte(c, [
    <Box key="entete">{titreSection(c, 'Pôles', 'Renommez-les, changez leur couleur (deux pôles n’ont jamais la même) ou ajoutez-en. Un pôle utilisé par un agent ne se retire pas.')}</Box>,
    ...p.poles.map((x, i) => (
      <Box key={`pole-ligne-${x.id}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
        {chipPole(c, x.titre, couleurPole(x.couleur, i))}
        {champTexte(c, d, `pole-titre-${x.id}`, 'Nom', x.titre, v => d.modifier({ type: 'poleRenommer', id: x.id, titre: v }))}
        {champChoix(c, d, `pole-couleur-${x.id}`, 'Couleur', x.couleur, [...TEINTES_POLE], v => d.modifier({ type: 'poleCouleur', id: x.id, couleur: v }))}
        {action(c, d, `pole-retirer-${x.id}`, 'Retirer', () => d.modifier({ type: 'poleRetirer', id: x.id }))}
      </Box>
    )),
    champTexte(c, d, 'pole-ajout', 'Ajouter un pôle (son nom)', '', v => {
      const id = idDePole(v)
      return id === '' ? d.signaler(['Donnez un nom au pôle : lettres ou chiffres.']) : d.modifier({ type: 'poleAjouter', id, titre: v.trim() })
    }),
  ], { cle: 'parametres-poles' })
}

export function carteEquipe(c: Ctx, d: DonneesParametres) {
  const { Box, Text } = c.ui
  return carte(c, [
    <Box key="entete">{titreSection(c, 'Équipe', 'Les membres du projet (lecture seule).')}</Box>,
    ...d.projet.equipe.map(m => (
      <Box key={`membre-${m}`} flexDirection="row" alignItems="center" gap="md">
        {avatar(c, m)}
        <Text color={c.j.texte}>{m}</Text>
        {d.moi !== '' && memeMembre(m, d.moi) ? <Text size="footnote" color={c.j.accent}>Vous</Text> : null}
      </Box>
    )),
  ], { cle: 'parametres-equipe' })
}
