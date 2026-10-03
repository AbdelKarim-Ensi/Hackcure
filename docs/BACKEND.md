# Damm : backend (NestJS)

> **Document vivant.** Les sections 1 à 6 décrivent l'état courant et sont corrigées au fil du temps.
> La section 7 est le **journal** : on ajoute un bloc « Jour N » chaque jour, avec le détail de T1 à T8.
> Dernière mise à jour : **Jour 1, samedi 3 octobre 2026**.

---

## 1. Le projet en une minute

Damm est une plateforme de don de sang (hackathon HackCure, 48 h).

1. Un **hôpital validé** déclare un besoin (groupe, quantité, urgence).
2. Le système alerte les **donneurs** compatibles, éligibles, hors délai de repos et proches.
3. L'hôpital suit en direct la jauge des donneurs « en route ».
4. Le **CRT** publie des collectes planifiées auxquelles les donneurs s'inscrivent.

Principe directeur : les règles de santé sont **déterministes**, jamais confiées à un LLM. L'éligibilité finale est toujours confirmée par le personnel médical.

## 2. Architecture et stack

Monolithe modulaire : un seul service NestJS, découpé en modules.

| Couche | Technologie | Rôle |
|---|---|---|
| Framework | NestJS (TypeScript) | Modules, guards, injection de dépendances |
| Base de données | PostgreSQL 16 + PostGIS | Données et requêtes de distance |
| ORM | TypeORM | Entités et migrations |
| Cache et OTP | Redis (ioredis) | Codes OTP à durée de vie limitée |
| Authentification | `@nestjs/jwt` + argon2 | JWT access et refresh, hash des mots de passe |
| Validation | class-validator | DTO validés à l'entrée |
| Contrat d'API | `@nestjs/swagger` | `docs/openapi.json`, Swagger UI sur `/docs` |
| Tests | Jest (ESM) | `npm test` |

## 3. Organisation de `backend/src`

| Dossier | Rôle |
|---|---|
| `database/` | Entités, enums, migrations, seed |
| `auth/` | Inscription, OTP, connexion, refresh |
| `redis/` | Module Redis global |
| `common/` | Guards, décorateurs, DTO partagés |
| `institutions/` | Établissements et validation par l'admin |
| `donors/`, `requests/`, `events/`, `donations/`, `stocks/`, `notifications/`, `users/` | Contrôleurs du contrat d'API (mockés tant que leur tâche n'est pas faite) |
| `api-contract.module.ts` | Regroupe tous les modules du contrat v1 |

## 4. Entités (tables)

| Entité | Contenu principal |
|---|---|
| `User` | téléphone (unique), mot de passe haché, rôle, `phoneVerified`, statut, jeton FCM, `institutionId` |
| `Donor` | groupe sanguin, position, zone, disponibilité, statut d'éligibilité, dates de dons, rayon max, préférences d'alertes, consentement. Lié à `User` en 1 pour 1 |
| `Institution` | nom, type, adresse, position, statut de validation |
| `EligibilityForm` | réponses au questionnaire de santé (chiffrées en T7.1) |
| `Donation` | un don confirmé |
| `BloodRequest` | demande de sang d'un hôpital |
| `RequestWave` | une vague d'alerte (rayon, nombre de donneurs alertés) |
| `RequestResponse` | réponse « Je viens » ou « Ne peut pas » d'un donneur |
| `CrtEvent`, `EventRegistration` | collectes du CRT et inscriptions |
| `Stock` | stock par établissement et groupe sanguin |
| `AppNotification` | historique des notifications |
| `AuditLog` | journal des actions sensibles |

**Rôles :** `donneur`, `hopital`, `crt`, `direction`, `admin`.

**Statuts :**
- Éligibilité du donneur : `en_attente`, `eligible`, `temporaire`, `definitif`. Seuls les `eligible` reçoivent des alertes.
- Établissement : `en_attente`, `valide`, `rejete`.
- Demande : `en_revue`, `active`, `couverte`, `cloturee`, `expiree`.

## 5. Endpoints

Légende : **Réel** = branché sur la base. **Mock** = renvoie des données fictives au bon format. **Semi-réel** = une partie de la logique est réelle.

### Authentification (public)

| Endpoint | Rôle | Ce qu'il fait | État |
|---|---|---|---|
| `POST /auth/register` | public | Crée le compte (non vérifié) et génère un OTP | Réel |
| `POST /auth/otp/send` | public | Renvoie un OTP. Même réponse que le numéro existe ou non | Réel |
| `POST /auth/otp/verify` | public | Vérifie le code, marque le téléphone vérifié, renvoie les tokens | Réel |
| `POST /auth/login` | public | Téléphone et mot de passe, renvoie les tokens | Réel |
| `POST /auth/refresh` | public | Échange un refresh token contre de nouveaux tokens | Réel |

### Établissements

| Endpoint | Rôle | Ce qu'il fait | État |
|---|---|---|---|
| `POST /institutions` | hopital, crt, admin | Déclare un établissement `en_attente` et y rattache le compte | Réel |
| `GET /institutions` | tous | Liste, filtre `validationStatus` | Réel |
| `PATCH /institutions/:id/validate` | admin | Valide ou rejette. 404 si absent | Réel |

### Demandes

| Endpoint | Rôle | État |
|---|---|---|
| `POST /requests` | hopital | Semi-réel : règle F5 réelle, demande renvoyée mockée (T4.4) |
| `GET /requests`, `GET /requests/:id` | selon le rôle | Mock (T4) |
| `GET /requests/:id/live` | hopital, direction, admin | Mock (T5.5) |
| `POST /requests/:id/respond` | donneur | Mock (T4.5) |

### Autres modules (tous mockés pour l'instant)

| Endpoint | Rôle | Tâche |
|---|---|---|
| `POST /donors/register`, `GET` et `PATCH /donors/me` | donneur | T4.1 |
| `POST /donors/:id/eligibility-form` | donneur | T4.2 |
| `GET /donors/:id/next-donation-date` | donneur, hopital, crt | T4.3 |
| `POST /donations/confirm` | hopital, crt | T4.3 |
| `GET /notifications/me` | donneur, hopital, crt | T4.6 |
| `PUT /users/me/device-token` | tous | T4 (protégé, n'enregistre pas encore) |
| `/events/*` (liste, création, inscription, pointage, tableau de bord) | donneur, crt, direction, admin | T6 |
| `GET /stocks` | hopital, direction, admin | T6.6 |

## 6. Logique et règles en place

### Authentification
- Mot de passe haché en **argon2id**. Un hash factice est calculé quand le téléphone n'existe pas, pour que le temps de réponse ne révèle rien.
- Deux JWT : **access** (15 min) et **refresh** (7 jours). Un refresh token présenté comme access token est rejeté.
- Le login est refusé (401) si le téléphone n'est pas vérifié ou si le compte est suspendu.

### OTP (Redis)
- Code à 6 chiffres, stocké **haché** (HMAC), durée de vie 5 minutes, usage unique.
- 5 essais maximum, puis le code est supprimé. Délai de 30 s entre deux envois.
- `OTP_DEV_MODE=true` : le code est renvoyé dans `devOtp`. **Aucun SMS réel n'est envoyé.** En production, un fournisseur SMS reste à brancher dans `OtpService.issue`.

### Sécurité des routes
- `JwtAuthGuard` est **global** : toute route exige un access token, sauf celles marquées `@Public()` (`/auth/*` et `GET /`). Réponse 401 `Token absent, invalide ou expiré`.
- `RolesGuard` est **global** : le rôle du token doit figurer dans `@ApiRoles(...)`. Réponse 403 `Rôle insuffisant. Rôles autorisés : ...`.
- `@ApiRoles()` documente Swagger **et** pose les rôles lus par le guard. `@CurrentUser()` donne l'utilisateur connecté.

### Règle F5 : un hôpital non validé ne crée pas de demande
`POST /requests` appelle `assertHospitalValidated`, qui **relit la base** à chaque appel. Un token émis avant la validation fonctionne donc dès que l'admin valide.

### Règles métier du PRD à respecter dans la suite
- R1 : un donneur n'est alerté que s'il est compatible, éligible, hors délai de repos et dans le rayon.
- R2 : le délai entre dons est contrôlé côté serveur, à trois niveaux (classement, envoi, réponse).
- R4 : aucune identité de patient dans une alerte.
- R5 : un événement n'accepte que les donneurs éligibles à sa date.

---

## 7. Journal quotidien

Chaque jour : ajouter un bloc en haut de cette section, mettre à jour le tableau d'avancement, puis corriger les sections 4 et 5 si elles ont changé.

### Tableau d'avancement

| Tâche | Contenu | Statut |
|---|---|---|
| T1 | Schéma BDD, entités, migration, seed | Fait |
| T2 | Authentification JWT, OTP Redis, guards, validation d'établissement | Fait (PR `akd-t2-auth`) |
| T3 | Contrat OpenAPI v1, contrôleurs mockés | Fait |
| T4 | Endpoints donneurs, éligibilité, demandes, réponses, notifications | Reporté au Jour 2 |
| T5 | Vagues d'alerte et WebSocket | À faire |
| T6 | Événements CRT et stocks | À faire |
| T7 | Chiffrement, audit, limitation de débit, vie privée | À faire |
| T8 | Intégration, scénario de démo, corrections | À faire |

### Jour 2 : dimanche 4 octobre 2026 (à remplir)

#### T1 / T2 / T3 : rien à signaler (ou corrections)

#### T4 : endpoints métier (prévu aujourd'hui)
- [ ] T4.1 donneurs : inscription, profil, préférences, position consentie
- [ ] T4.2 formulaire d'éligibilité (dépend des fonctions pures de M2)
- [ ] T4.3 prochain don et `DonationsService.confirm()`
- [ ] T4.4 création de demande réelle (hôpital validé uniquement)
- [ ] T4.5 réponse du donneur (délai entre dons contrôlé à trois niveaux)
- [ ] T4.6 service de notifications (file BullMQ, jamais d'identité patient)
- [ ] T4.7 tests e2e

#### Endpoints passés de Mock à Réel aujourd'hui
- (à compléter)

#### Points à annoncer à l'équipe
- (à compléter)

#### Dette et points de vigilance
- (à compléter)

---

### Jour 1 : samedi 3 octobre 2026

#### T1 : schéma de base de données (fait)
- 13 entités TypeORM réparties en fichiers par thème : `identity` (User, Donor, Institution), `health` (EligibilityForm, Donation), `requests` (BloodRequest, RequestWave, RequestResponse), `events` (CrtEvent, EventRegistration), `ops` (Stock, AppNotification, AuditLog).
- Positions stockées en `geography(Point, 4326)` avec index spatial.
- Enums regroupés dans `database/enums.ts`.
- Seed de démo : établissements et données de test.
- Environnement : `docker-compose.yml` avec PostGIS 16 (port 5433) et Redis 7.

#### T2 : authentification, OTP, guards, établissements (fait)
- **T2.1 module `auth`** : register, login, refresh avec `@nestjs/jwt` (sans passport), argon2id, DTO validés. Les anciens DTO de T3 (`auth/dto`) ont été supprimés.
- **T2.2 OTP Redis** : `RedisModule` global, `OtpService` (code haché, TTL 300 s, 5 essais, délai de renvoi, comparaison à temps constant, `devOtp` en mode démo).
- **T2.3 guards** : `JwtAuthGuard` et `RolesGuard` globaux, `@Roles()`, `@Public()`, `@CurrentUser()`. `@ApiRoles()` pose les métadonnées, donc tous les contrôleurs T3 sont protégés sans modification. **10 tests unitaires.**
- **T2.4 établissements et F5** : `InstitutionsService` réel (create, list, validate), rattachement du compte hopital/crt à son établissement, règle F5 sur `POST /requests`. **6 tests unitaires.**
- **Décision de conception :** le login d'un compte hopital/crt est autorisé dès que le téléphone est vérifié. Sinon il ne pourrait jamais déclarer son établissement. Le contrôle de validation passe sur l'action (`POST /requests`), pas sur le login.
- **Tests réels validés :** OTP (mauvais code, rejeu, 6 essais), guards (200, 401, 403, 204), F5 (rejeté 403, validé 201, id inconnu 404).

#### T3 : contrat d'API v1 (fait)
- `docs/openapi.json` versionné : tous les endpoints du PRD §9, plus `PUT /users/me/device-token` et `GET /notifications/me`.
- Contrôleurs squelettes avec données mockées pour que M3 (mobile) et M4 (dashboard) avancent en parallèle.
- `ErrorResponseDto` partagé, réponses 401 et 403 documentées sur chaque route protégée.
- Toute modification du contrat passe par une PR sur `openapi.json` et est annoncée à l'équipe.

#### T4 : reporté au Jour 2
Rien n'a été commencé sur T4 aujourd'hui. Le plan est décrit dans le bloc « Jour 2 » ci-dessus.

#### Points à annoncer à l'équipe
- M3 et M4 : tous les endpoints exigent maintenant un token (401 sans token, 403 avec un mauvais rôle). Le contrat `openapi.json` ne change pas. Les appels passent par `/auth/login`.
- M3 : `POST /institutions` rattache désormais le compte hopital/crt à son établissement.

#### Dette et points de vigilance
1. Deux fichiers d'enums (`common/enums.ts` et `database/enums.ts`). Les valeurs texte sont identiques, mais il faudra n'en garder qu'un.
2. Pas d'endpoint admin pour rattacher un compte à un établissement existant. Pour la démo : `UPDATE` SQL, ou compte pré-rattaché dans le seed.
3. Les comptes de test `+216990000xx` (dont l'admin) ne doivent pas rester dans le seed final.
4. Aucun fournisseur SMS : l'OTP n'est visible qu'en mode démo.
5. Refresh token sans rotation ni révocation (suffisant pour 48 h).

---

### Modèle pour le prochain jour (à copier en haut du journal)

```markdown
### Jour N : <date>

#### T1 / T2 / T3 : rien à signaler (ou corrections)

#### T4 : endpoints métier
- T4.x ...: ce qui est fait, endpoints passés de Mock à Réel, tests ajoutés

#### Endpoints passés de Mock à Réel aujourd'hui
- ...

#### Points à annoncer à l'équipe
- ...

#### Dette et points de vigilance
- ...
```

---

## 8. Commandes utiles

```bash
# Démarrer l'infrastructure
docker compose up -d

# Lancer l'API en développement
cd backend && npm run start:dev

# Contrôle de types et tests
npx tsc --noEmit -p tsconfig.json
npm test

# Swagger UI : http://localhost:3000/docs
```

Variables d'environnement utiles (voir `.env.example`) : `DB_*`, `REDIS_HOST`, `REDIS_PORT`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OTP_DEV_MODE`.
