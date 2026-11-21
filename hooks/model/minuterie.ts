// Minuterie de rafraîchissement : au plus un minuteur vivant à la fois. Logique pure : l'horloge arrive en paramètre
// (`$.clock`) ; `every` rend un Timer `{ cancel }` qu'il faut annuler pour que le minuteur ne tire plus jamais.
export type Timer = { cancel: () => void }
export type Horloge = { every: (ms: number, fn: () => void) => Timer }

export type Minuterie = {
  /** Lance le minuteur s'il ne tourne pas déjà (sinon ne fait rien). Ne lève jamais. */
  demarrer: (horloge: Horloge, action: () => void) => void
  /** Annule le minuteur en cours. Ne lève jamais. */
  arreter: () => void
  tourne: () => boolean
}

export function creerMinuterie(ms: number): Minuterie {
  let courant: Timer | null = null
  const arreter = (): void => {
    try {
      courant?.cancel()
    } catch {
      // Rien de plus à faire : le minuteur est oublié.
    }
    courant = null
  }
  return {
    demarrer(horloge, action) {
      if (courant) return
      try {
        courant = horloge.every(ms, action)
      } catch {
        // Sans horloge, le bouton Rafraîchir reste là.
        courant = null
      }
    },
    arreter,
    tourne: () => courant !== null,
  }
}
