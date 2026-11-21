---
name: interface-et-lisibilite
description: "Interface de Roblox : redimensionnement et contraintes d'objets d'interface (UIScale, AutomaticSize, contraintes), avec source et date. À charger avant de créer ou d'adapter une interface."
---

# Interface et lisibilite

Faits lus dans la documentation officielle (une seule page lue). Les écrans tactiles, zones sûres et différences d'appareils ne sont pas dans cette page.

**Règles d'usage.** Chaque entrée porte sa source et sa date de vérification. Un fait de plus de six mois est à revérifier. Ce qui n'est pas listé ici est « non vérifié » : fais-le vérifier par le chercheur-analyste du projet avant de t'y fier, n'invente rien.

## Entrées vérifiées

### Modificateurs et contraintes de taille
- Fait :
  - UIScale multiplie la taille absolue de l'objet parent (échelle 2 = deux fois plus grand) et touche aussi ses enfants, UIStroke et UICorner compris.
  - AutomaticSize redimensionne un objet pour contenir ses descendants (valeurs X, Y, XY ; défaut None). Avec AutomaticSize, Size devient la taille minimale par axe. Un ScrollingFrame utilise AutomaticCanvasSize à la place.
  - Avec TextWrapped et AutomaticSize sur Y ou XY, un texte à retour à la ligne grandit en hauteur pour tout afficher.
  - Les contraintes sont des enfants de l'objet qu'elles contraignent : UISizeConstraint (MinSize, MaxSize), UITextSizeConstraint (MinTextSize, MaxTextSize, valable avec TextScaled ; la page déconseille un minimum inférieur à 9), UIAspectRatioConstraint (rapport largeur sur hauteur, tenu même si la taille est en pourcentage).
  - Si une disposition (UIListLayout…) et une contrainte de taille ou de rapport s'appliquent au même objet, la contrainte l'emporte sur la disposition.
- Source : https://create.roblox.com/docs/en-us/ui/size-modifiers
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Construire les interfaces en tailles relatives et AutomaticSize, avec des contraintes de taille de texte (minimum 9 ou plus) ; vérifier sur petit et grand écran avant de finir.

## Non vérifié (à rechercher)

- Types d'objets d'interface, mises en page (listes, grilles) : pages d'index et de dispositions introuvables (404).
- Tailles tactiles, zones sûres, différences mobile, console et ordinateur : non données par la page lue.
- Règles de lisibilité du texte (contraste, tailles) : non lues.
