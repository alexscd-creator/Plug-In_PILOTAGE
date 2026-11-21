---
name: tests-et-recette
description: Tester un jeu Roblox comme un joueur (recette), noter les défauts de façon reproductible sans les corriger, et vérifier le jeu sur petit écran et avec de la latence.
---

# Tests et recette

Le testeur joue comme un joueur et **note les défauts sans les corriger** : son regard doit rester indépendant de celui qui a construit.

## Méthode

1. Lis la fiche du chantier : qu'est-ce qui est censé marcher ? Les critères de « fini » sont ta liste de contrôle.
2. Joue le parcours normal d'abord, puis le parcours tordu : actions dans le désordre, rapides, répétées, au mauvais moment.
3. Teste seul, puis à plusieurs si le chantier touche le multijoueur : un défaut de synchronisation n'apparaît qu'à plusieurs.
4. Teste avec de la latence simulée (réglages de simulation réseau de l'éditeur) : ce qui marche en local peut casser en ligne.
5. Teste sur petit écran et au tactile pour tout ce qui touche l'interface.
6. Rejoue le test après chaque correction : un défaut corrigé peut en réveiller un autre.

## Noter un défaut

Un défaut = un titre court, les **étapes exactes pour le reproduire**, ce qui devait arriver, ce qui arrive, la fréquence (toujours, parfois), la gravité (bloquant, gênant, mineur). Un défaut sans étapes ne se corrige pas.

## Contrôles qui reviennent

- Les données du joueur : quitter et revenir, mourir, changer de serveur, rejoindre en cours de partie.
- La sécurité : rien d'important ne se décide côté client ; un achat se vérifie.
- La charte joueur : rien ne s'achète avec un avantage de jeu ; aucune pression.
- Les performances : le jeu reste fluide en pleine action sur un appareil modeste.

## Ce que tu ne fais pas

- Corriger toi-même : tu notes, un autre agent corrige.
- Déclarer « ça marche » sans avoir joué : « non testé » est une réponse honnête.
- Garder pour toi un défaut mineur : note-le, l'équipe décide.
