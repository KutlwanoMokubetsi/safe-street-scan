# CrimeSpot mobile app (Flutter): build and launch plan

**Goal:** a native Android and iPhone app on the same backend (Spring Boot API, Keycloak, Neon), published as fast as the stores allow, with what the web app can't do: background location, reliable push, and faster SOS.

**Target:** Android in production in about 5 weeks, iPhone about 1 week later. The Google Play testing rule below sets the pace more than coding does.

---

## 1. Why native, and what changes for users

| Need | Web app today | Flutter app |
|---|---|---|
| Location while sharing / during SOS | Only while the app is on screen | Continues in the background (Android foreground service, iOS background location) |
| SOS notifications | Web Push; iPhone only after "Add to Home Screen" | FCM (Android) and APNs (iOS), critical-style alerts |
| Speed to SOS | Open browser, find tab | App icon long-press shortcut, home-screen widget, notification action |
| Offline SOS | SMS link if the request fails | Same, plus queued alert that sends when signal returns |
| **Silent SOS** | Not possible on the web | Discreet trigger with no sound or screen change: Android power-button presses (accessibility/foreground service), iOS via Shortcuts / Action Button; plus a duress-style hidden trigger |
| Store presence | None | Play Store and App Store listings |

The web app stays live for desktop users and as the fallback. Both use the same API, so features stay in sync.

## 2. App architecture

**Language and framework:** Flutter 3.x (Dart 3), one codebase for Android and iOS.

| Concern | Package | Notes |
|---|---|---|
| Sign-in (Keycloak, PKCE, Google) | `flutter_appauth` | System browser, never an embedded webview (Google blocks those) |
| Token storage | `flutter_secure_storage` | Keychain / Android Keystore |
| HTTP | `dio` | Interceptor adds the access token and refreshes it, same as the web app |
| Real-time | `web_socket_channel` | Same `/ws` protocol: `auth` → `ready`, then events |
| State | `flutter_riverpod` | |
| Navigation | `go_router` | Deep links like `/alerts/{id}` from notifications |
| Maps | `flutter_map` + OpenStreetMap tiles | Same greyscale style and clustering as the web map; no Google Maps API key or billing |
| Location | `geolocator` | Foreground; `flutter_foreground_task` on Android for background sharing |
| Push | `firebase_messaging` + `flutter_local_notifications` | One FCM project covers Android and iOS (APNs key uploaded to Firebase) |
| Calls / SMS | `url_launcher` | `tel:` and `sms:` links; no SMS permission needed |
| Crash reporting | `sentry_flutter` | Free tier is enough at launch |

**Folder layout:** `lib/core` (api, auth, realtime, location, push), `lib/features/<feature>` (overview, map, report, friends, live, sos, alert, profile), `lib/ui` (theme, widgets). The theme reuses the brand tokens: ink `#17202B`, vest `#F5C518`, risk `#C0392B`, Barlow.

## 3. Backend changes needed

1. **Mobile Keycloak client:** add a public client `crimespot-mobile` (PKCE S256) with redirect `za.co.crimespot.app:/oauth2redirect` and the same `crimespot-api` audience mapper. Done in the Keycloak admin console.
2. **Native push (FCM):**
   - Add a `device_tokens` table: user, platform, token (encrypted), updated.
   - Add `POST /api/devices` and `DELETE /api/devices`.
   - Extend `NotificationService` to send through the Firebase Admin SDK as well as Web Push. SOS uses high priority, plus the iOS `interruption-level: time-sensitive`.
3. **App version endpoint:** `GET /api/app/config` with the minimum supported version, so old builds can be told to update.
4. **Nothing else.** Reports, friends, live location, SOS, check-in, area alerts, rate limits and encryption all work as they are.

## 4. Background location: the part stores review hardest

- **Android:**
  - Location only runs in a **foreground service**, with a visible notification ("Sharing your location with 2 friends · Stop"), and only during sharing or SOS.
  - Declare `FOREGROUND_SERVICE_LOCATION`.
  - Prefer foreground-service location over `ACCESS_BACKGROUND_LOCATION`. Play rarely approves background location for this use; if we do need it, the declaration form and a demo video are required.
- **iOS:**
  - Use the `location` background mode with "When In Use" permission and `showsBackgroundLocationIndicator = true`, so the blue pill shows while sharing.
  - Avoid "Always" permission at launch: it slows review and scares users.
- **Battery:** send every 15 s or after 25 m of movement while sharing, the same as the web app, and stop the moment sharing ends.

## 5. Store requirements and timeline drivers

**Google Play**
- **Account:** developer account, $25 once. A **personal** account created recently must run a **closed test with at least 12 testers for 14 days in a row** before it can publish to production. Line up 12+ testers now: family, neighbourhood watch members, friends. An **organisation** account (needs a D-U-N-S number, free but takes days to weeks) skips that rule.
- **Listing details:**
  - Data safety form: location, contacts (friends), personal info, all encrypted in transit; no selling, no ads.
  - Privacy policy URL: already live at `/privacy.html`.
  - Content rating questionnaire; target audience 18+.
- **Foreground service declaration:** for location, with a short video showing sharing and SOS.

**Apple App Store**
- **Account:** Apple Developer Program, $99 a year (individual, or organisation with D-U-N-S).
- **Required text and links:**
  - Usage strings explaining location: "CrimeSpot shares your location only with friends you choose, and during an SOS alert."
  - Privacy "nutrition label" and the privacy policy URL.
- **Review notes:**
  - Include a test account and explain that SOS alerts friends, not emergency services. The in-app disclaimer and 10111 / 112 / 10177 buttons satisfy guideline 5.1.1 concerns.
  - Guideline 4.8: an app that offers Google sign-in must also offer a privacy-focused login option. Sign in with Apple is the dependable way to meet it, so add Apple as a Keycloak identity provider before submitting.

## 6. Timeline

| Week | Work | Store side |
|---|---|---|
| 0 (now) | Create Play and Apple accounts, Firebase project, mobile Keycloak client | Recruit 12+ Android testers |
| 1 | App shell, theme, sign-in, API client, overview, map (read-only) | |
| 2 | Report incident, friends, profile, real-time socket | **Upload first closed-test build** (starts the 14-day clock early) |
| 3 | Live sharing and check-in with background location, SOS, alert screen, FCM backend | Push updates to testers |
| 4 | Offline SOS queue, widget and shortcut, Sign in with Apple, accessibility pass | Store listings, screenshots (reuse the promo art) |
| 5 | Bug fixes from testers | **Android: apply for production** after 14 days of testing. **iOS: submit for review** (usually 1–3 days) |
| 6 | Launch both, monitor Sentry and the API logs | |

Starting the closed test in week 2, even with an unfinished build, is what makes week 5 possible.

## 7. Quality bar before launch

- SOS end-to-end on a real Android and a real iPhone: app closed, screen locked, poor signal, airplane mode (SMS fallback).
- Background sharing for 1 hour: battery use, position keeps updating, the notification is always visible.
- Token expiry: leave the app for a day and reopen it. Still signed in, socket reconnects.
- Accessibility: large text, screen reader labels on SOS and map controls.
- Load: about 500 simultaneous sockets on the current API plan. Upgrade the plan before marketing pushes.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Play rejects background location | Use the foreground-service model only; clear in-app explanation and video |
| 14-day test delays launch | Start the closed test in week 2; or register an organisation account |
| Apple review flags login options (4.8) | Sign in with Apple planned in week 4 |
| False or abusive SOS | Already deduplicated; friends-only; add a "report misuse" option on alerts later |
| One server instance | Fine at launch; move to 2 API instances behind Render, with a shared socket bus (Redis), when needed |

## 9. Do this week

1. Create the Google Play developer account (and start a D-U-N-S request if registering as an organisation).
2. Create the Apple Developer account.
3. Create a Firebase project "CrimeSpot" and add Android `za.co.crimespot.app` and iOS bundle `za.co.crimespot.app`.
4. Make a list of 12+ Android testers with their Gmail addresses.
