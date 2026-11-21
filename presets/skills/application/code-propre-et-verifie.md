---
name: code-propre-et-verifie
description: "Écrire du code en petits pas, le vérifier avant de le déclarer fini (tests, lecture du diff), et ne jamais y mettre de secret."
---

# Code propre et vérifié

## Méthode

1. **Comprendre avant d'écrire.** Relis la fiche du chantier et le code voisin : quelle convention le projet suit-il déjà ? Imite-la plutôt que d'en inventer une.
2. **Petits pas.** Une modification = un but. Si tu touches à trois choses sans rapport, sépare-les.
3. **Un test d'abord quand c'est possible.** Écris le test qui échoue, puis le code qui le fait passer. Pour un défaut corrigé : un test qui le reproduit.
4. **Vérifier pour de vrai.** Lance les tests et la construction (build) du projet avant de dire « c'est fait ». Si tu n'as pas pu les lancer, dis « non vérifié », jamais « ça marche ».
5. **Relire son diff.** Cherche : code mort, essais oubliés, fichier ajouté par erreur, chemin en dur, secret.

## Règles

- **Jamais de secret** (clé, mot de passe, jeton) dans le code, un fichier du projet, un message ou un journal. Un secret vit hors du dépôt (variable d'environnement, coffre) ; s'il a fuité, il est à renouveler.
- Valide toute donnée qui vient de l'extérieur (formulaire, URL, fichier, réponse d'un service) : type, taille, plage.
- Les erreurs ne se taisent pas : un échec est dit à l'utilisateur ou journalisé, avec un message utile et sans donnée sensible.
- Nomme pour être lu : un nom dit ce que la chose est ou fait. Une fonction courte qui fait une chose.
- Un commentaire dit **pourquoi**, pas ce que le code fait déjà.
- N'ajoute une dépendance que si elle est nécessaire, maintenue et de confiance : chaque dépendance est du code qu'on ne relit pas.

## Pièges

- Déclarer fini sans avoir lancé les tests.
- Corriger un symptôme sans trouver la cause : cherche la cause, puis corrige.
- Gros changement mélangé à du reformatage : le diff devient illisible pour le relecteur.
- Copier un extrait trouvé en ligne sans le comprendre.
