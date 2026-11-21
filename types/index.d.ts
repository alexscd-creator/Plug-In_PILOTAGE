/** Pages du panneau, dans l'ordre des onglets de la maquette. */
export type Page = 'apercu' | 'plan' | 'phases' | 'chantiers' | 'agents' | 'idees' | 'parametres'
/** Thème choisi : le mod ne peut pas lire le mode de l'application, « systeme » prend le sombre. */
export type ChoixTheme = 'systeme' | 'clair' | 'sombre'

declare module 'claude-code' {
  interface PluginState {
    pilotage: {
      /** Vrai quand un projet valide est ouvert dans la session. */
      actif: Shaped<boolean>
      /** Dossier racine du projet trouvé ('' sans projet). */
      projetTrouve: Shaped<string>
      /** Membre courant d'après la config ('' si inconnu). */
      membre: Shaped<string>
      /** Erreurs du marqueur invalide, rappelées par /pilotage. */
      erreursMarqueur: Shaped<string[]>
      /** Page affichée dans le panneau. */
      page: Shaped<Page>
      /** Compteur de rafraîchissement : un changement force une nouvelle lecture des fichiers. */
      tick: Shaped<number>
      /** Thème du panneau. */
      theme: Shaped<ChoixTheme>
      /** Ce qui s'est passé quand un bouton a voulu envoyer une commande (vide : tout est parti). */
      retourCommande: Shaped<string>
    }
  }
}
