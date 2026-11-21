---
name: securite-applicative
description: Règles de sécurité d'une application : valider les entrées, protéger les données de l'utilisateur et les secrets, limiter les droits.
---

# Sécurité d'une application

Une application tourne sur des appareils que l'on ne contrôle pas : tout ce qui est stocké ou envoyé depuis l'appareil peut être lu ou modifié.

## Règles

- **Le serveur décide.** Toute règle importante (droits, prix, quotas) se vérifie côté serveur ; l'application ne fait qu'afficher et demander.
- **Valider les entrées** de toute origine : saisie, fichier, lien profond, réponse d'un service. Type, taille, plage, format.
- **Secrets.** Aucune clé, aucun mot de passe ni jeton dans le code de l'application ni dans le dépôt : ce qui est dans une application distribuée se retrouve. Les clés sensibles restent côté serveur ; un secret exposé est à renouveler.
- **Stockage local.** Rien de sensible en clair sur l'appareil ; utiliser le coffre sécurisé de la plateforme pour les jetons.
- **Réseau.** Connexions chiffrées uniquement ; jamais de désactivation de la vérification des certificats pour « faire marcher ».
- **Authentification.** Utiliser un service ou une bibliothèque éprouvés ; sessions qui expirent ; ne jamais écrire sa propre cryptographie.
- **Permissions.** Demander seulement celles dont on a besoin, au moment où on en a besoin, en expliquant pourquoi.
- **Données personnelles.** Collecter le minimum, dire à quoi elles servent, ne jamais les écrire dans les journaux, prévoir la suppression à la demande.
- **Dépendances.** À jour, de confiance, peu nombreuses.
- **Erreurs.** Messages clairs pour l'utilisateur, détails techniques seulement dans les journaux protégés.

## Pièges

- Cacher une clé dans l'application en pensant qu'on ne la trouvera pas.
- Se fier à un contrôle qui n'existe que dans l'interface.
- Publier une version ou envoyer des données à un tiers sans l'accord de l'utilisateur : toute action sortante se confirme.
