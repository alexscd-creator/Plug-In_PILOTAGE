// Page « Chantier ouvert » (maquette §6, écran 05) : remplace la liste des chantiers quand un chantier est ouvert, ou d'office
// dans la session du chantier. Titre, progression, agents sollicités, tâches et fichiers. LIT seulement. Le texte des fiches
// est une donnée : il n'est jamais interprété, seulement affiché.
import { progressionChantier } from '../model/chantier.ts'
import type { Chantier } from '../model/chantier.ts'
import { etatAgentAffiche, etatStatut, nomAgent } from '../model/chantiers.ts'
import { pluriel } from './apercu'
import { avatar, barreProgression, carte, pastille, titreSection } from './kit'
import type { Ctx } from './kit'
import { ligneFichier, poleDe } from './ligne-chantier'
import type { DonneesLigne } from './ligne-chantier'
import { statut } from './plan'

const MIN = 60_000

/** « il y a 12 min » : temps écoulé depuis la dernière mise à jour de la fiche ; jamais une durée inventée. */
export function ilYa(iso: string, maintenant: number): string {
  const ms = maintenant - Date.parse(iso)
  if (!Number.isFinite(ms)) return 'date inconnue'
  if (ms < MIN) return 'à l’instant'
  const m = Math.floor(ms / MIN)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  return h < 24 ? `il y a ${h} h` : `il y a ${pluriel(Math.floor(h / 24), 'jour', 'jours')}`
}

export function pageChantierOuvert(c: Ctx, d: DonneesLigne & { fermer: () => void | Promise<void> }, ch: Chantier, cle: string) {
  const { Box, Text, Button } = c.ui
  const { j } = c
  const pole = poleDe(d.projet, ch)
  const p = progressionChantier(ch)
  return [
    <Box key="retour-chantiers" alignSelf="flex-start">
      <Button key="tous-les-chantiers" label="Tous les chantiers" variant="secondary" onPress={() => d.fermer()} />
    </Box>,
    <Box key={`chantier-ouvert-${cle}`} flexDirection="column" gap="xs">
      <Text weight="bold" size="title" color={j.texte}>{ch.titre}</Text>
      <Text color={j.texteSec}>{`Pôle ${pole.titre} · session ${ch.session === '' ? 'non liée' : ch.session} · ouvert le ${ch.cree.slice(0, 10)}`}</Text>
    </Box>,
    carte(c, [
      <Box key="progression-entete" flexDirection="row" alignItems="center" justifyContent="space-between" gap="md">
        <Text weight="semibold" size="footnote" color={j.texte}>Progression du chantier</Text>
        <Text weight="semibold" size="footnote" color={j.texte}>{`${p.pourcent} %`}</Text>
      </Box>,
      <Box key="progression-barre">{barreProgression(c, `Avancement du chantier ${ch.titre}`, p.pourcent / 100, pole.teinte)}</Box>,
      <Text key="progression-aide" size="caption" color={j.texteDim}>
        {`${pluriel(p.faites, 'tâche terminée', 'tâches terminées')} sur ${p.total} · mis à jour ${ilYa(ch.maj, d.maintenant)}`}
      </Text>,
    ], { cle: `progression-chantier-${cle}` }),
    <Box key="agents-sollicites" flexDirection="column" gap="md">
      {titreSection(c, 'Agents sollicités', 'Les agents appelés dans ce chantier et ce que fait chacun.')}
      {ch.agents.length === 0 ? <Text key="aucun-agent" color={j.texteDim}>Aucun agent n’a encore été appelé.</Text> : null}
      {ch.agents.map(a => carte(c, [
        <Box key="ligne" flexDirection="row" alignItems="center" justifyContent="space-between" gap="md">
          <Box flexDirection="row" alignItems="center" gap="md" flexShrink={1}>
            {avatar(c, nomAgent(d.projet, a.id), pole.teinte)}
            <Box flexDirection="column" flexShrink={1}>
              <Text weight="semibold" color={j.texte}>{nomAgent(d.projet, a.id)}</Text>
              {a.quoi !== '' ? <Text size="footnote" color={j.texteSec}>{a.quoi}</Text> : null}
            </Box>
          </Box>
          <Box key={`pastille-agent-${a.id}`}>{pastille(c, etatStatut(etatAgentAffiche(ch, a.etat, d.maintenant)))}</Box>
        </Box>,
      ], { cle: `agent-${cle}-${a.id}` }))}
    </Box>,
    carte(c, [
      titreSection(c, 'Tâches du chantier'),
      ch.taches.length === 0 ? <Text key="aucune-tache" color={j.texteDim}>Aucune tâche pour l’instant.</Text> : null,
      ...ch.taches.map((t, k) => (
        <Box key={`tache-${cle}-${k}`} flexDirection="row" alignItems="center" gap="lg" padding="sm" borderStyle="round" borderColor={j.bord}>
          {statut(c, t.statut, `statut-${cle}-${k}`)}
          <Text color={t.statut === 'abandonne' ? j.texteDim : j.texte}>{t.titre}</Text>
        </Box>
      )),
    ], { cle: `taches-chantier-${cle}` }),
    carte(c, [
      titreSection(c, 'Fichiers du chantier'),
      ch.fichiers.length === 0 ? <Text key="aucun-fichier" color={j.texteDim}>Aucun fichier pour l’instant.</Text> : null,
      ...ch.fichiers.map((f, k) => ligneFichier(c, d, `${cle}-${k}`, f)),
    ], { cle: `fichiers-chantier-${cle}` }),
  ]
}
