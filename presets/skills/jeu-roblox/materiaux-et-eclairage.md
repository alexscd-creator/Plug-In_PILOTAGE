---
name: materiaux-et-eclairage
description: "Matériaux et éclairage global de Roblox (propriétés, limites mobiles, réglages de Lighting), avec source et date. À charger avant de régler l'aspect d'un monde."
---

# Materiaux et eclairage

Faits lus dans la documentation officielle. Les pages ont été mises à jour par Roblox le 2026-11-17.

**Règles d'usage.** Chaque entrée porte sa source et sa date de vérification. Un fait de plus de six mois est à revérifier. Ce qui n'est pas listé ici est « non vérifié » : fais-le vérifier par le chercheur-analyste du projet avant de t'y fier, n'invente rien.

## Entrées vérifiées

### Matériaux : aspect et propriétés physiques
- Fait :
  - Un matériau fixe l'aspect et les propriétés physiques d'une pièce (le béton est plus lourd que le plastique, par exemple). Matériau par défaut d'une nouvelle pièce : Plastic.
  - Environ 40 matériaux de base (Asphalt, Brick, Concrete, Glass, Grass, Ice, Metal, Neon, Plastic, Rock, Sand, Snow, Wood…). Chacun a des valeurs par défaut de densité, élasticité et friction (exemples : Plastic 0,7 / 0,5 / 0,3 ; Ice friction 0,02 ; Rubber élasticité 0,95).
  - ForceField, Neon, Plastic et SmoothPlastic n'ont pas d'identifiant de texture ordinaire : leurs textures sont intégrées à Studio.
  - La réfraction de la lumière du verre (Glass) n'est pas prise en charge sur mobile, à cause des limites de calcul.
- Source : https://create.roblox.com/docs/en-us/parts/materials.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Pour un jeu jouable sur mobile, ne pas compter sur la réfraction du verre ; vérifier le rendu sur petit écran.

### Matériaux personnalisés (MaterialVariant)
- Fait :
  - Un matériau personnalisé est un MaterialVariant rangé sous MaterialService, créé avec le Material Manager ; il hérite des propriétés physiques d'un matériau de base (Plastic par défaut).
  - Les cartes de texture (couleur, normales…) se donnent par identifiant d'asset ou import ; les textures carrées conviennent le mieux. MaterialVariant peut porter des propriétés physiques, pas SurfaceAppearance.
  - Application : par pièce, globalement, ou comme remplacement (override) qui touche toutes les pièces et le terrain utilisant ce matériau de base.
  - Priorité des propriétés physiques d'une pièce : ses CustomPhysicalProperties, puis son matériau personnalisé, puis le remplacement, puis les valeurs du matériau de base.
  - Une pièce référence le MaterialVariant par son nom : renommer le matériau après application casse le lien tant qu'on ne le réapplique pas. La page recommande une convention de noms (GrassWet, GrassDry, GrassBurned).
- Source : https://create.roblox.com/docs/en-us/parts/materials.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Fixer une convention de noms de matériaux dès le début d'un chantier et la noter dans la fiche.

### Éclairage global (service Lighting)
- Fait :
  - Les propriétés de Lighting se rangent en cinq catégories : Color, Intensity, Shadows, Appearance, Environment.
  - LightingStyle : « Realistic » donne l'éclairage et les ombres les plus avancés ; « Soft » donne un rendu plat, façon ancien Roblox, avec lumières et ombres plus douces. ShadowSoftness (0 dur, 1 doux) n'est valable qu'en Realistic.
  - PrioritizeLightingQuality : vrai privilégie les ombres avancées et les shaders de qualité de près quand la qualité baisse ; faux privilégie la distance de vue. La page conseille vrai si l'éclairage est central à l'identité artistique du jeu.
  - Couleurs : Ambient, OutdoorAmbient, ColorShift_Top, ColorShift_Bottom. Intensité : Brightness, ExposureCompensation.
  - Environnement : ClockTime et TimeOfDay sont liés (même valeur, formats différents) et ne suivent pas l'heure réelle : ils ne changent que par script. GeographicLatitude déplace le soleil et la lune sans changer l'heure.
- Source : https://create.roblox.com/docs/en-us/environment/lighting.md
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Choisir Realistic ou Soft une fois pour tout le jeu, selon l'ambiance, et le noter dans la fiche ; faire varier l'heure par script si on veut un cycle jour-nuit.

## Non vérifié (à rechercher)

- Les technologies d'éclairage nommées (modes de rendu) et comment choisir : la page lue ne les décrit pas.
- Considérations mobiles de l'éclairage et coûts de performance chiffrés : non donnés par la page lue.
- Ciel, atmosphère, post-traitement (effets) : pages non lues.
- Pages liées non lues : matériaux de terrain personnalisés, Material Generator.
