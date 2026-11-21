/** Pages du panneau, dans l'ordre des onglets de la maquette. */
export type Page = 'apercu' | 'plan' | 'phases' | 'chantiers' | 'agents' | 'idees' | 'parametres'
/** Thème choisi : le mod ne peut pas lire le mode de l'application, « systeme » prend le sombre. */
export type ChoixTheme = 'systeme' | 'clair' | 'sombre'

declare module 'claude-code' {
  interface PluginState {
    pilotage: {
      /** Vrai quand un projet valide est ouvert dans la session. */
      actif: boolean
      /** Dossier racine du projet trouvé ('' sans projet). */
      projetTrouve: string
      /** Membre courant d'après la config ('' si inconnu). */
      membre: string
      /** Erreurs du marqueur invalide, rappelées par /pilotage. */
      erreursMarqueur: string[]
      /** Page affichée dans le panneau. */
      page: Page
      /** Compteur de rafraîchissement : un changement force une nouvelle lecture des fichiers. */
      tick: number
      /** Thème du panneau. */
      theme: ChoixTheme
    }
  }
}
