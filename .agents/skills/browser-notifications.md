---
description: Notifications de fin de scan et alertes système
---

# Skill : Browser Notifications

Ce skill régit l'utilisation de l'API Browser Notification pour alerter l'utilisateur de l'activité du scraper en arrière-plan.

## 1. Gestion des Permissions
- Vérifier si les notifications sont supportées : `"Notification" in window`.
- Demander la permission : `Notification.requestPermission()`.

## 2. Déclenchement de Notification
- Notification lancée à la fin d'un scan complet (lorsqu'un scraper atteint `percentage: 100`).
- Affichage du nombre total de prospects extraits dans le corps de la notification.

## 3. Fallback & UX
- Si les permissions sont refusées, utiliser le système `toast` (`sonner` ou `radix-toast`) comme fallback.
- Éviter d'envoyer trop de notifications pour ne pas polluer l'expérience utilisateur.

## 4. Personnalisation
- Utilisation de l'icône Prospecta pour renforcer l'identité visuelle de la marque.
- Interaction : Un clic sur la notification doit ramener l'utilisateur sur l'onglet `ProspectFinder`.
