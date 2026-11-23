// Cartes Pôles, Workflow, Agents et Équipe de l'écran Paramètres (maquette écran 07) : des lignes compactes ; le bouton ✎ d'une
// ligne ouvre ses champs de modification, un second appui les referme. Les outils d'un agent n'y sont pas modifiables : ils sont réglés
// par le moteur.
import { resumeMonWorkflow } from '../model/ecriture-projet.ts'
import { memeMembre, TEINTES_POLE } from '../model/projet.ts'
import { GLYPHES } from './icones'
import { action, champChoix, champTexte, interrupteur, modifiable } from './parametres-base'
import type { DonneesParametres } from './parametres-base'
import { avatar, bulle, carte, pointEl, titreSection } from './kit'
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

/** Bouton ✎ qui ouvre ou referme la modification d'une ligne ; absent en lecture seule. */
function boutonEditer(c: Ctx, d: DonneesParametres, cle: string, ligne: string) {
  if (!modifiable(d)) return null
  const { Button } = c.ui
  return <Button key={cle} label={d.edition === ligne ? 'Fermer' : `${GLYPHES.crayon} Modifier`} variant="secondary" onPress={(() => d.editer(ligne)) as never} />
}

/** En-tête de carte : titre et aide à gauche, action à droite. */
function entete(c: Ctx, titre: string, aide: string | undefined, droite: unknown = null) {
  const { Box } = c.ui
  return (
    <Box key="entete" flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap="md">
      <Box flexShrink={1}>{titreSection(c, titre, aide)}</Box>
      {droite as never}
    </Box>
  )
}

/** Pastille d'outil (maquette : chips grises dans la ligne d'un rôle). */
function chipOutil(c: Ctx, cle: string, outil: string) {
  const { Box, Text } = c.ui
  return (
    <Box key={cle} paddingX="sm" borderStyle="round" borderColor={c.j.bord} backgroundColor={c.j.releve}>
      <Text size="footnote" weight="semibold" color={c.j.texteSec}>{outil}</Text>
    </Box>
  )
}

export function carteWorkflow(c: Ctx, d: DonneesParametres) {
  const { Box, Text } = c.ui
  const outils = d.projet.workflow.outils
  const ouvert = d.edition === 'workflow'
  // Une ligne par rôle, ses outils en pastilles, dans l'ordre de première apparition.
  const roles = [...new Set(outils.map(o => o.role))]
  return carte(c, [
    entete(c, 'Workflow', 'Les outils du projet, par rôle.', boutonEditer(c, d, 'flux-editer', 'workflow')),
    ouvert ? (
      <Box key="flux" flexDirection="column" gap="sm">
        {outils.map((o, i) => (
          <Box key={`flux-ligne-${i}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
            {champTexte(c, d, `flux-role-${i}`, 'Rôle', o.role, v => d.modifier({ type: 'workflowModifier', index: i, role: v, outil: o.outil }))}
            {champTexte(c, d, `flux-outil-${i}`, 'Outil', o.outil, v => d.modifier({ type: 'workflowModifier', index: i, role: o.role, outil: v }))}
            {action(c, d, `flux-retirer-${i}`, 'Retirer', () => d.modifier({ type: 'workflowRetirer', index: i }))}
          </Box>
        ))}
        {champTexte(c, d, 'flux-ajout', 'Ajouter un outil (Rôle : Outil)', '', v => {
          const s = separerOutil(v)
          return s ? d.modifier({ type: 'workflowAjouter', ...s }) : d.signaler(['Écrivez le rôle, deux-points, puis l’outil : par exemple « Son : Audacity ».'])
        })}
      </Box>
    ) : (
      <Box key="flux-roles" flexDirection="column" gap="sm">
        {roles.map((r, k) => (
          <Box key={`flux-role-ligne-${k}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="md" paddingY="xs">
            <Box flexShrink={0}><Text weight="semibold" color={c.j.texte}>{r}</Text></Box>
            <Box flexDirection="row" flexWrap="wrap" gap="xs" flexShrink={1}>
              {outils.filter(o => o.role === r).map((o, i) => chipOutil(c, `outil-${k}-${i}`, o.outil))}
            </Box>
          </Box>
        ))}
      </Box>
    ),
    <Box key="resume-workflow" flexDirection="column" gap="sm" paddingTop="sm">
      <Text size="caption" weight="semibold" color={c.j.texteDim}>Mon workflow</Text>
      <Text size="caption" color={c.j.texteSec}>{`Le workflow de ce projet (${resumeMonWorkflow(d.projet.workflow).total}) peut être enregistré pour vos prochains projets.`}</Text>
      {ouvert ? resumeMonWorkflow(d.projet.workflow).lignes.map((l, i) => <Text key={`mw-${i}`} size="caption" color={c.j.texteSec}>{l}</Text>) : null}
      <Box key="mw-actions" flexDirection="row" flexWrap="wrap" gap="sm">
        {action(c, d, 'workflow-enregistrer', 'Enregistrer comme mon workflow', d.enregistrerWorkflow)}
        {d.monWorkflow ? action(c, d, 'workflow-charger', 'Charger mon workflow', d.chargerWorkflow) : null}
      </Box>
      {d.monWorkflow && modifiable(d) ? <Text key="charger-aide" size="caption" color={c.j.texteDim}>{`Charger remplace la liste par votre workflow (${d.monWorkflow.outils.length} outils), après confirmation.`}</Text> : null}
    </Box>,
  ], { cle: 'parametres-workflow' })
}

export function carteAgents(c: Ctx, d: DonneesParametres) {
  const { Box, Text } = c.ui
  const p = d.projet
  return carte(c, [
    entete(c, 'Gestion des agents', 'Désactivé : pris en compte au prochain démarrage de la session.'),
    p.agents.length === 0 ? <Text key="aucun" color={c.j.texteDim}>Aucun agent défini pour ce projet.</Text> : null,
    ...p.agents.map(a => {
      const i = p.poles.findIndex(x => x.id === a.pole)
      const teinte = i < 0 ? undefined : couleurPole(p.poles[i]!.couleur, i)
      const actif = a.actif !== false
      const ouvert = d.edition === `agent-${a.id}`
      return (
        <Box key={`reglage-agent-${a.id}`} flexDirection="column" gap="sm" paddingX="md" paddingY="sm" borderStyle="round" borderColor={c.j.releve} backgroundColor={c.j.releve}>
          <Box key="tete" flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap="md">
            <Box flexDirection="row" alignItems="center" gap="md" flexShrink={1}>
              {bulle(c, 'agent', 36, actif ? teinte : undefined)}
              <Box flexDirection="column" flexShrink={1}>
                <Text weight="semibold" color={actif ? c.j.texte : c.j.texteDim}>{a.titre}</Text>
                {a.pourquoi !== '' ? <Text size="caption" color={c.j.texteDim} wrap="truncate-end">{actif ? a.pourquoi : `Désactivé · ${a.pourquoi}`}</Text> : null}
              </Box>
            </Box>
            <Box flexDirection="row" alignItems="center" gap="sm" flexShrink={0}>
              {boutonEditer(c, d, `agent-editer-${a.id}`, `agent-${a.id}`)}
              {interrupteur(c, d, `agent-actif-${a.id}`, 'État', actif, 'Actif', 'Désactivé', () => d.modifier({ type: 'agentActiver', id: a.id, actif: !actif }))}
            </Box>
          </Box>
          {ouvert ? champTexte(c, d, `agent-titre-${a.id}`, 'Rôle', a.titre, v => d.modifier({ type: 'agentRole', id: a.id, titre: v, pourquoi: a.pourquoi })) : null}
          {ouvert ? champTexte(c, d, `agent-pourquoi-${a.id}`, 'Pourquoi spécialisé', a.pourquoi, v => d.modifier({ type: 'agentRole', id: a.id, titre: a.titre, pourquoi: v })) : null}
          {ouvert ? champTexte(c, d, `agent-skills-${a.id}`, 'Skills (séparés par des virgules)', a.skills.join(', '),
            v => d.modifier({ type: 'agentSkills', id: a.id, skills: v.split(',').map(s => s.trim()).filter(s => s !== '') })) : null}
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
    entete(c, 'Pôles', 'Nom et couleur de chaque pôle.'),
    ...p.poles.map((x, i) => {
      const teinte = couleurPole(x.couleur, i)
      const ouvert = d.edition === `pole-${x.id}`
      return (
        <Box key={`pole-ligne-${x.id}`} flexDirection="column" gap="sm" paddingX="md" paddingY="sm" borderStyle="round" borderColor={c.j.releve} backgroundColor={c.j.releve}>
          <Box flexDirection="row" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap="md">
            <Box flexDirection="row" alignItems="center" gap="md" flexShrink={1}>
              {pointEl(c, c.j.poles[teinte].fg, x.titre)}
              <Box flexDirection="column">
                <Text weight="semibold" color={c.j.texte}>{x.titre}</Text>
                <Text size="caption" color={c.j.texteDim}>{`Couleur : ${x.couleur}`}</Text>
              </Box>
            </Box>
            <Box flexDirection="row" gap="sm" flexShrink={0}>
              {boutonEditer(c, d, `pole-editer-${x.id}`, `pole-${x.id}`)}
              {action(c, d, `pole-retirer-${x.id}`, `${GLYPHES.corbeille} Retirer`, () => d.modifier({ type: 'poleRetirer', id: x.id }))}
            </Box>
          </Box>
          {ouvert ? (
            <Box key="champs" flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
              {champTexte(c, d, `pole-titre-${x.id}`, 'Nom', x.titre, v => d.modifier({ type: 'poleRenommer', id: x.id, titre: v }))}
              {champChoix(c, d, `pole-couleur-${x.id}`, 'Couleur', x.couleur, [...TEINTES_POLE], v => d.modifier({ type: 'poleCouleur', id: x.id, couleur: v }))}
            </Box>
          ) : null}
        </Box>
      )
    }),
    champTexte(c, d, 'pole-ajout', 'Ajouter un pôle (son nom)', '', v => {
      const id = idDePole(v)
      return id === '' ? d.signaler(['Donnez un nom au pôle : lettres ou chiffres.']) : d.modifier({ type: 'poleAjouter', id, titre: v.trim() })
    }),
  ], { cle: 'parametres-poles' })
}

export function carteEquipe(c: Ctx, d: DonneesParametres) {
  const { Box, Text } = c.ui
  return carte(c, [
    entete(c, 'Équipe', d.moi !== '' && d.projet.equipe.length < 3 ? 'Trois membres au plus.' : undefined),
    ...d.projet.equipe.map(m => (
      <Box key={`membre-${m}`} flexDirection="row" alignItems="center" gap="md">
        {avatar(c, m)}
        <Text weight="semibold" color={c.j.texte}>{m}</Text>
        {d.moi !== '' && memeMembre(m, d.moi) ? <Text size="footnote" color={c.j.accent}>Vous</Text> : null}
      </Box>
    )),
    d.projet.equipe.length < 3 ? champTexte(c, d, 'membre-ajout', 'Ajouter un membre (son prénom)', '', v => d.modifier({ type: 'membreAjouter', prenom: v })) : null,
  ], { cle: 'parametres-equipe' })
}
