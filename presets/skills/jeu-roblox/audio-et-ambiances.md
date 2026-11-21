---
name: audio-et-ambiances
description: "Audio de Roblox : objets audio, assets permis, lecture et effets, avec source et date. À charger avant d'ajouter des sons ou de la musique."
---

# Audio et ambiances

Faits lus dans la page d'aperçu officielle de l'audio. Les sous-pages (assets, objets, effets) ne sont pas encore lues.

**Règles d'usage.** Chaque entrée porte sa source et sa date de vérification. Un fait de plus de six mois est à revérifier. Ce qui n'est pas listé ici est « non vérifié » : fais-le vérifier par le chercheur-analyste du projet avant de t'y fier, n'invente rien.

## Entrées vérifiées

### Objets audio et lecture
- Fait :
  - L'audio positionnel ou non positionnel sert à immerger, à donner un retour sur les actions et à attirer l'attention vers des objectifs.
  - Objets : AudioPlayer (charge et joue un asset audio par son identifiant), AudioEmitter (haut-parleur virtuel dans le monde 3D), AudioListener (microphone virtuel), AudioDeviceOutput (sortie physique), AudioDeviceInput (microphone physique), AudioTextToSpeech, AudioSpeechToText, et Wire (relie les flux audio d'un objet à un autre).
  - La lecture peut démarrer automatiquement à l'exécution ou être déclenchée par script.
  - Les effets (AudioEqualizer, AudioCompressor, AudioReverb…) modifient un flux d'AudioPlayer sans le détruire (exemples de la page : atténuer la pluie, limiter le volume maximal, réverbération d'intérieur).
- Source : https://create.roblox.com/docs/en-us/audio
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Construire l'ambiance avec AudioPlayer, AudioEmitter et AudioListener reliés par des Wire ; prévoir un réglage de volume pour le joueur.

### Assets audio permis
- Fait :
  - On peut importer des assets audio dont on a le droit d'usage, par exemple ses propres créations.
  - Le Creator Store propose des sons gratuits : la page cite plus de 100 000 effets sonores et musiques produits par des partenaires audio et musique.
- Source : https://create.roblox.com/docs/en-us/audio
- Vérifié le : 2026-11-18
- Conséquence pour nos jeux : Ne jamais importer un son sans droit d'usage ; noter l'origine de chaque son dans la fiche du chantier.

## Non vérifié (à rechercher)

- Règles de confidentialité, permissions et modération des assets audio : sous-page /audio/assets non lue.
- Détail des objets et effets, audio 3D : sous-pages /audio/objects et /audio/effects non lues.
- Objets Sound (ancienne API) et différences avec l'API audio : non dits par la page lue.
- Limites et performances de l'audio : non données.
