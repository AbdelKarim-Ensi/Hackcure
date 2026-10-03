# Contrat WebSocket `/live` (v1)

Suivi en direct d'une demande urgente. Les schémas des charges utiles sont dans `docs/openapi.json`
(`WsGaugeEventDto`, `WsDonorEnRouteEventDto`, `WsWaveStartedEventDto`). L'état initial se charge par
`GET /requests/{id}/live`, ensuite les mises à jour arrivent par Socket.IO.

> Statut : contrat figé en v1, serveur réel en T5.3 (le contrôleur REST est mocké pour l'instant).

## Connexion

- Bibliothèque : Socket.IO, namespace `/live`.
- Authentification : le JWT d'accès est envoyé au handshake, dans `auth.token`.
- Rôles autorisés : `hopital` (sa propre demande), `direction`, `admin`.

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/live', {
  auth: { token: accessToken },
});

socket.emit('subscribe', { requestId });     // rejoint la room de la demande
socket.emit('unsubscribe', { requestId });   // quitte la room
```

Réponse à `subscribe` (accusé) : `{ ok: true }`, ou `{ ok: false, error: 'forbidden' | 'not_found' }`.

## Événements serveur vers client

Une room par demande : seuls les clients abonnés à `requestId` reçoivent ces événements.

| Événement | Quand | Charge utile |
|---|---|---|
| `gauge` | À chaque réponse « Je viens » validée | `WsGaugeEventDto` : `{ event, requestId, gauge: { accepted, needed, percent } }` |
| `donor_en_route` | À chaque nouveau donneur en route | `WsDonorEnRouteEventDto` : `{ event, requestId, donor: { anonymousId, bloodGroup, distanceKm, respondedAt } }` |
| `wave_started` | Au lancement de chaque vague (1, 2, ...) | `WsWaveStartedEventDto` : `{ event, requestId, wave: { number, radiusKm, sentTo, coverage, createdAt } }` |

Règles de confidentialité : aucune identité de donneur ni de patient dans ces événements, uniquement
un identifiant anonyme (`anonymousId`), le groupe sanguin et la distance.

## Objectifs de performance

- Mise à jour temps réel (réponse du donneur jusqu'à `gauge` reçu) : moins de 2 s.
- Vague 1 envoyée en moins de 10 s après `POST /requests`.
