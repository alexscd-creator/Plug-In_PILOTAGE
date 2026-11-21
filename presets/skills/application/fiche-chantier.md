---
name: fiche-chantier
description: Découper un travail en chantier, tenir sa fiche à jour de façon honnête (tâches, statuts, estimation, avancement réel) et le clore proprement.
---

# Fiche de chantier

Un chantier est une unité de travail délimitée (« page d'accueil », « formulaire de contact », « écran de connexion »). Sa fiche est lue par tout le projet : elle doit dire la vérité sur l'avancement.

## Créer

- La fiche se crée avec la commande `/pilotage:chantier` (le plugin vérifie le format et refuse d'écraser une fiche existante) : ne jamais l'écrire à la main.
- Un titre court et concret. Un pôle, une phase, les agents concernés.
- **Contrôle d'impact avant de créer** : quels pôles et agents sont touchés ? quels fichiers ? un autre chantier touche-t-il les mêmes ? S'il y a chevauchement, le dire avant de commencer.
- Une tâche par domaine concerné (un par pôle concerné du projet : par exemple technique, création, qualité), chacune assez petite pour tenir en une séance. Retire les domaines que le chantier ne touche pas.

## Estimer

- Estime chaque tâche en heures, avant de commencer ; note le temps réel à la fin. L'écart sert aux bilans de phase, pas à blâmer.
- Une tâche de plus d'une journée se redécoupe.

## Suivre

- Les statuts : à faire, en cours, en revue, terminé, bloqué. Mets-les à jour au fil du travail.
- L'avancement du chantier est la part des tâches terminées : rien d'autre.
- Une tâche bloquée dit **ce qui bloque** et qui peut débloquer.

## Clore

- Toutes les tâches terminées, le verdict du gardien noté, le temps réel renseigné quand on le connaît, la passation écrite (skill `passation`), puis l'archivage.
- **Clôture sans travail réel.** On ne marque jamais une tâche terminée, ni un temps réel, pour un travail qui n'a pas eu lieu (essai, abandon). Laisse les tâches « à faire » ou « bloqué », écris la passation en disant « clos sans travail réalisé ». Le suivi ne doit jamais montrer un avancement qui n'existe pas.

## Chantier suivi par plusieurs membres

Une fiche appartient à celui qui l'a créée : on ne modifie pas la fiche d'un autre. Chacun ne note que **ses** tâches et **son** temps, jamais ceux des autres.

## Pièges

- Écraser une fiche existante parce que deux titres se ressemblent.
- Une fiche qui dit « terminé » alors que le travail est resté à moitié.
- Un chantier géant : si personne ne peut dire en une phrase ce qui est fini, il se découpe.
