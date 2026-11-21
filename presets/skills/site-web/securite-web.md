---
name: securite-web
description: "Règles de sécurité d'un site web : ne jamais faire confiance aux données reçues, protéger les formulaires, les identifiants et les secrets."
---

# Sécurité d'un site web

Tout ce qui vient du navigateur du visiteur peut être falsifié. Les règles ci-dessous protègent le site et ses visiteurs.

## Règles

- **Valider côté serveur.** La validation du navigateur sert au confort ; la vraie vérification se fait là où l'utilisateur ne peut pas la contourner.
- **Échapper ce qu'on affiche.** Tout texte venu d'un visiteur est affiché comme du texte, jamais interprété comme du code (injection de script, XSS). Même règle pour les requêtes à une base de données : paramètres liés, jamais de texte collé dans la requête.
- **Formulaires.** Protéger les actions qui modifient quelque chose contre les requêtes forgées depuis un autre site (jeton anti-CSRF ou équivalent) ; limiter le nombre d'essais (connexion, envoi de message).
- **HTTPS partout**, cookies de session marqués sécurisés et inaccessibles au script.
- **Mots de passe.** Jamais stockés en clair : utiliser le mécanisme éprouvé du framework ou du service d'identité. Ne jamais écrire sa propre cryptographie.
- **Secrets.** Clés d'API, mots de passe de base et jetons ne vont jamais dans le code envoyé au navigateur ni dans le dépôt : variables d'environnement côté serveur. Un secret exposé est à renouveler immédiatement.
- **Moindre droit.** Chaque compte, clé ou service n'a que les droits dont il a besoin.
- **Dépendances.** À jour, de confiance ; surveiller les alertes de sécurité.
- **Données personnelles.** N'en collecter que le nécessaire, dire à quoi elles servent, ne jamais les écrire dans les journaux.
- **Messages d'erreur.** Utiles pour le visiteur, sans détail technique ni chemin de serveur.

## Pièges

- Se fier à un champ caché ou à un bouton désactivé pour protéger une action.
- Mettre une clé « temporairement » dans le code.
- Publier ou déployer sans l'accord de l'utilisateur : toute mise en ligne se confirme.
