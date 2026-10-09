# INTEGRATION.md — HackCure / Damm

Etat de l'integration entre backend (M1), mobile (M2) et dashboard (M3).
Derniere verification : 2026-10-09 (branche `origin/feature/home-screen`).

## 1. Etat par module

| Module | Branche | Etat |
|--------|---------|------|
| Backend (NestJS) | `main` | Reference de l'API |
| Mobile (M2) | `feature/home-screen` | Appelle l'API (voir section 2) |
| Mobile (M2) | `feature/mobile` | Aucun appel API detecte (grep vide) |
| Dashboard (M3) | - | **Vide** : `dashboard/` ne contient que `.gitkeep`, aucun code n'appelle l'API |

## 2. Endpoints appeles par le mobile (`feature/home-screen`)

| Endpoint | Methode | Fichier |
|----------|---------|---------|
| `/auth/login` | POST | `screens/AuthScreen.tsx` |
| `/auth/register` | POST | `screens/AuthScreen.tsx` |
| `/auth/otp/send` | POST | `screens/OtpVerificationScreen.tsx` |
| `/auth/otp/verify` | POST | `screens/OtpVerificationScreen.tsx` |
| `/donors/register` | POST | `OtpVerificationScreen.tsx`, `services/eventService.ts` |
| `/donors/me` | GET | `services/eventService.ts` |
| `/donors/:id/eligibility-form` | POST | `services/eligibilityService.ts` |
| `/events` | GET | `services/eventService.ts`  // AJOUT : slots au format EventSlotDto (HH:mm + capacity), requis par RegisterEventDto et events.service
    // 2 événements CRT simulés|
| `/events/...` | POST | `services/eventService.ts` (l.115, URL a confirmer) |

**A verifier** : corps de requete et reponses vs DTO backend / `docs/openapi.json`. Ecarts listes en section 6.

## 3. Points d'attention connus

- **`coverage`** : a documenter (note sur le dossier / rapport de couverture et son statut dans le repo).
- **`ws-live.md` perime** : le statut decrit dans ce fichier ne correspond plus a l'etat reel. A mettre a jour ou a supprimer.
- **Push simules** : les notifications push sont simulees en demo.
- **Tokens de demo** : tokens push factices utilises (`demo-reset.sh` les reinitialise et vide Redis).
- **`dashboard/` vide** : M3 n'a livre aucun code.

## 4. Dependances mal placees

`backend/package.json` (diff `feature/home-screen`) ajoute :

- `@react-native-firebase/app` ^26.4.0
- `@react-native-firebase/messaging` ^26.4.0

Ce sont des librairies React Native : **elles n'ont pas leur place cote NestJS**. Elles appartiennent a `mobile/package.json`.
Action : ne pas fusionner ce changement dans `backend/`, le signaler a EmnaHl.

## 5. Config reseau (mobile)

- `API_BASE_URL = 'http://10.0.2.2:3000'` en dur dans plusieurs fichiers (`AuthScreen`, `OtpVerificationScreen`, `eventService`, `eligibilityService`).
- `10.0.2.2` = emulateur Android uniquement. **Ne fonctionne pas sur un vrai telephone** en demo.
- Action : centraliser dans une config unique (variable d'env / fichier de config) et utiliser l'IP LAN de la machine pour un device physique.

## 6. Ecarts mobile <-> backend

Comparaison faite sur les DTO (`auth.dto.ts`, `donors.dto.ts`, `geo-point.dto.ts`, `events.dto.ts`) vs le code de `feature/home-screen`.

### 6.1 Conformes (aucun ecart)

| Endpoint | Verification |
|----------|--------------|
| `POST /auth/login` | `{phone, password}` = `LoginDto` ; reponse `accessToken` + `user` = `TokensDto` |
| `POST /auth/register` | `{phone, password, fullName, role}` = `RegisterDto` |
| `POST /auth/otp/verify` | `{phone, code}` = `OtpVerifyDto` ; reponse `accessToken` + `user` |
| `POST /donors/register` | `position {latitude, longitude}` = `GeoPointDto` ; `zone`, `available`, `consent` OK |
| `POST /events/:id/register` | `{slot}` = `RegisterEventDto` (format `HH:mm`) |
| `POST /donors/:id/eligibility-form` | les 14 champs = `EligibilityFormDto` ; `lastDonationDate: null` accepte (`@IsOptional`) |

### 6.2 Verifies et OK (apres lecture des enums, controller, types)

| Sujet | Resultat |
|-------|----------|
| `role` | Mobile envoie `'donneur'` = `UserRole.DONNEUR` : OK |
| `phone` au register | `payload.phone = cleanPhone` : OK (regex backend a tester avec un numero reel) |
| `bloodGroup` / `sex` | Defauts `'O+'` et `'homme'` = valeurs des enums `BloodGroup` / `Sex` : OK |
| `GET /events` | `lat`, `lng`, `maxDistanceKm` = `ListEventsQueryDto` : OK |
| `DonorProfile` (mobile) | `userId`, `eligibilityStatus`, `position`, `zone` = `DonorProfileDto` : OK |
| `BloodEvent` / `EventSlot` | Alignes sur `EventDto` / `EventSlotDto` ; le mobile gere aussi des slots en string |
| `POST /donors/:id/eligibility-form` | Route existe, role `donneur` ; semantique de `:id` a confirmer (voir 6.3) |

### 6.3 Risques reels (a corriger ou verifier)

| Sujet | Probleme | Cote |
|-------|----------|------|
| Refresh token | Access token 900 s (15 min) + `POST /auth/refresh`. Le mobile ne lit que `accessToken` et ne rafraichit jamais : apres 15 min, appels en 401 en demo | Mobile |
| `getDonorProfile` masque les erreurs | `catch` sur `/donors/me` ne fait que `console.log` puis retombe sur le profil local. Un 401 (token expire) ou un 404 (profil donneur non cree) passe inapercu | Mobile |
| Priorite du groupe sanguin (CONFIRME) | `bloodGroup: localProfile?.bloodGroup \|\| ... \|\| apiData.bloodGroup`. Le local prime sur l'API. Au login (`AuthScreen` l.101), `AuthUserDto` n'a pas de `bloodGroup`, donc le local prend `bloodGroupToSubmit`, calcule depuis l'etat du formulaire (l.71) que l'utilisateur n'a pas rempli en mode connexion : groupe affiche faux apres connexion. Fix : l'API prime, et ne rien ecrire de `bloodGroupToSubmit` au login | Mobile |
| Groupe inconnu envoye comme `'O+'` | `bloodGroupToSubmit = unknownBloodType ? 'O+' : ...` (l.71). Un donneur qui ne connait pas son groupe est enregistre `O+` cote backend (`bloodGroup` est requis, pas de valeur « inconnu »). Risque de matching d'alertes errone. A discuter : valeur par defaut assumee pour la demo, ou champ non envoye | Mobile + backend |
| Nom en dur | Filtre sur `'Amine Ben Salah'` (nom du seed) dans `getDonorProfile`. Hack de demo a retirer | Mobile |
| `/donors/register` echec silencieux | Appele apres l'OTP dans un `try/catch (profileErr)`. Si ca echoue, le compte existe sans profil donneur (404 sur `/donors/me`, masque par le fallback local) | Mobile |
| Format des slots (CORRIGE et VERIFIE le 2026-10-09 : seed relance, `POST /events/:id/register` avec `{"slot":"09:00"}` -> 201 + `qrToken`, ancien format `"09:00-11:00"` -> 400 ; `events.service` l.183) | `seed.ts` (l.142-150) stocke les slots en strings `["09:00-11:00","11:00-13:00","14:00-16:00"]`. Le contrat attend `EventSlotDto[]` (`{time: "HH:mm", capacity?}`) et `RegisterEventDto.slot` valide `^([01]\d\|2[0-3]):[0-5]\d$`. Le mobile envoie `"09:00-11:00"` : rejet 400 sur `POST /events/:id/register`. Fix cote seed : slots au format `[{"time":"09:00","capacity":20},...]`, puis re-seed. Verifier aussi `events.service` (validation « slot existe dans slots ») | Backend (seed) |
| `eligibility-form` `:id` (VERIFIE, OK) | `:id` = `userId` du donneur, doit etre celui du token (`requester.id !== donorId` -> 403). `ParseUUIDPipe` : l'id doit etre un UUID. 404 si profil non cree, 409 si statut `definitif` | OK |
| Eligibilite requise avant inscription (VERIFIE) | Un nouveau donneur est `en_attente` : `POST /events/:id/register` repond 422 « Vous n'etes pas eligible au don ». Il faut d'abord `POST /donors/:id/eligibility-form` (-> `eligible`, 201), puis l'inscription passe. Le mobile doit imposer ce parcours et afficher le message du 422. Pour la demo, utiliser un donneur seede deja `eligible` | Mobile |
| `nextDonationPossibleDate` | Requis dans le type mobile, optionnel dans `DonorProfileDto` : peut etre `undefined` | Mobile (mineur) |

### 6.3 Info

- Comptes `hopital` / `crt` : `otpSent=false`, pas d'OTP, pas utilisables avant validation admin. Le flux mobile (alerte "Code OTP envoye") ne concerne que `donneur`.
- Reponse register : `devOtp` renvoye seulement si `OTP_DEV_MODE=true`.

## 7. Scripts de demo

- `demo-reset.sh` : reinitialise la demo (tokens push factices, Redis vide).
- `demo-run.sh` : lance la demo (donneurs alertes, attente de la vague 2).
- Script de smoke test des endpoints (commit `768a47c`).