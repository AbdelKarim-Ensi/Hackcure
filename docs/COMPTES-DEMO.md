# Comptes de démo : Hôpital / CRT / Banque de sang

Comptes pour tester le dashboard (`localhost:5173`). **Démo uniquement, ne jamais réutiliser en production.**

Format du téléphone accepté au login (après le fix `akd-fix-login`) : `+21600010001`, `00010001`, `+216 0001 0001`. Tout est ramené à `+216XXXXXXXX`.

## 1. Mode réel (backend + seed)

Mot de passe de tous les comptes : `Damm2026!` (ou la valeur de `SEED_PASSWORD` dans `.env`).
Réinitialiser les données : relancer le script de seed (il vide les tables puis recrée les comptes).

### Hôpital

| Téléphone | Nom | Établissement | Statut | Écran attendu |
|---|---|---|---|---|
| `+21600010001` | Personnel Hôpital Charles Nicolle | Hôpital Charles Nicolle | validé | dashboard (Accueil, Demandes, Stocks) |
| `+21600010002` | Personnel Hôpital La Rabta | Hôpital La Rabta | validé | dashboard |
| `+21600010003` | Personnel Hôpital Mongi Slim | Hôpital Mongi Slim | validé | dashboard |
| `+21671000401` | Compte démo établissement en attente | Clinique Démo En Attente | en attente | écran « en attente de validation » |
| `+21671000501` | Compte démo établissement rejeté | Clinique Démo Rejetée | rejeté | écran « rejeté » |

### CRT (Croissant-Rouge / centre de transfusion)

| Téléphone | Nom | Rôle | Établissement | Statut |
|---|---|---|---|---|
| `+21600010300` | Organisateur CRT | `crt` | Croissant-Rouge Tunisien, Comité de Tunis | validé |

Ce compte peut créer des collectes (`POST /events`) car son établissement est validé.
Note : dans `dashboard/src/profiles.ts`, `profileFor` renvoie le profil « Centre de transfusion » pour tout rôle `crt`, avant de tester le type `croissant_rouge`. Le compte affiche donc Accueil, Collectes, Stocks.

### Banque de sang

**Aucun compte banque de sang dans le seed du backend.** Le profil existe dans le dashboard (rôle `hopital` + établissement de type `banque_sang`), mais le seed ne crée que des établissements de type `hopital` et `croissant_rouge`. Pour le tester : utiliser le mode démo (section 2) ou ajouter un établissement `banque_sang` et un utilisateur rattaché dans `backend/src/database/seed.ts`.

### Autres rôles

| Téléphone | Rôle | Écran attendu |
|---|---|---|
| `+21600010100` | admin | page Admin (valider / rejeter les établissements) |
| `+21600010200` | direction | pas de page dédiée dans le dashboard |
| `+21600000001` à `+21600000200` | donneur (200 comptes) | écran « réservé au web établissement » |

## 2. Mode démo (sans backend)

Actif quand `VITE_API_URL` n'est pas défini dans `dashboard/.env`. Mot de passe : `Demo1234!`.

| Téléphone | Rôle | Établissement | Profil affiché |
|---|---|---|---|
| `+21671000001` | hopital | CHU Charles Nicolle (validé) | Hôpital |
| `+21671000002` | hopital | Banque de sang de La Rabta (validé) | **Banque de sang** |
| `+21671000003` | crt | CNTS Tunis (validé) | Centre de transfusion |
| `+21671000004` | hopital | Clinique Test (en attente) | écran « en attente » |
| `+21671000005` | hopital | aucun | écran « Déclarer un établissement » |
| `+21671000009` | admin | aucun | page Admin |
