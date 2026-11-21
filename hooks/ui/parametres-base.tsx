// Types et champs partagés par les cartes de l'écran Paramètres. Un champ modifiable est un Input, un Select ou un Button ; sans droit
// d'écriture (prénom inconnu) il devient un simple texte, sans la clé du champ : rien ne s'y presse ni ne s'y tape.
import type { ChoixTheme } from '../../types'
import type { Patch } from '../model/ecriture-projet.ts'
import type { Projet } from '../model/projet.ts'
import type { Ctx } from './kit'

export type DonneesParametres = {
  projet: Projet
  /** Membre courant ('' : inconnu, donc réglages en lecture seule). */
  moi: string
  theme: ChoixTheme
  /** Erreurs de la dernière modification refusée (vide : rien à dire). */
  erreurs: string[]
  choisirTheme: (t: ChoixTheme) => void | Promise<void>
  /** Applique un patch au projet : validation, écriture gardée, rafraîchissement, toast. */
  modifier: (patch: Patch) => void | Promise<void>
  /** Dit une erreur de saisie sans rien écrire. */
  signaler: (erreurs: string[]) => void | Promise<void>
  enregistrerWorkflow: () => void | Promise<void>
}

export const modifiable = (d: DonneesParametres): boolean => d.moi !== ''

/** Champ texte : Input qui s'applique à Entrée ; en lecture seule, « libellé : valeur ». */
export function champTexte(c: Ctx, d: DonneesParametres, cle: string, label: string, valeur: string, appliquer: (v: string) => void | Promise<void>) {
  const { Box, Input, Text } = c.ui
  if (!modifiable(d)) {
    return (
      <Box key={`lecture-${cle}`} flexDirection="row" flexWrap="wrap" gap="sm">
        <Text size="footnote" color={c.j.texteDim}>{label}</Text>
        <Text color={c.j.texte}>{valeur === '' ? '—' : valeur}</Text>
      </Box>
    )
  }
  return <Input key={cle} label={label} value={valeur} onSubmit={((v: string) => appliquer(v)) as never} />
}

/** Choix parmi des options : Select ; en lecture seule, « libellé : valeur ». */
export function champChoix(c: Ctx, d: DonneesParametres, cle: string, label: string, valeur: string | undefined, options: string[], appliquer: (v: string) => void | Promise<void>) {
  const { Box, Select, Text } = c.ui
  if (!modifiable(d)) {
    return (
      <Box key={`lecture-${cle}`} flexDirection="row" flexWrap="wrap" gap="sm">
        <Text size="footnote" color={c.j.texteDim}>{label}</Text>
        <Text color={c.j.texte}>{valeur ?? '—'}</Text>
      </Box>
    )
  }
  return <Select key={cle} label={label} options={options.map(o => ({ value: o }))} {...(valeur !== undefined ? { value: valeur } : {})} onSelect={((v: string) => appliquer(v)) as never} />
}

/** Interrupteur : un bouton qui dit l'état et le bascule ; en lecture seule, l'état en texte. */
export function interrupteur(c: Ctx, d: DonneesParametres, cle: string, label: string, actif: boolean, vrai: string, faux: string, basculer: () => void | Promise<void>) {
  const { Box, Button, Text } = c.ui
  const etat = actif ? vrai : faux
  return (
    <Box key={`ligne-${cle}`} flexDirection="row" flexWrap="wrap" alignItems="center" gap="md">
      <Text color={c.j.texte}>{label}</Text>
      {modifiable(d)
        ? <Button key={cle} label={etat} variant={actif ? 'primary' : 'secondary'} onPress={(() => basculer()) as never} />
        : <Text weight="semibold" color={actif ? c.j.accent : c.j.texteDim}>{etat}</Text>}
    </Box>
  )
}

/** Bouton d'action, absent en lecture seule. */
export function action(c: Ctx, d: DonneesParametres, cle: string, label: string, appuyer: () => void | Promise<void>, variant: 'primary' | 'secondary' = 'secondary') {
  if (!modifiable(d)) return null
  const { Button } = c.ui
  return <Button key={cle} label={label} variant={variant} onPress={(() => appuyer()) as never} />
}
