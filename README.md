# Opskrifter — Firestore-opsætning

## Trin 1: Opret Firebase-projekt

1. Gå til https://console.firebase.google.com/
2. Tryk **Add project** → giv det et navn (fx `opskrifter`)
3. Google Analytics kan slås fra (ikke nødvendig)
4. Vent på at projektet oprettes

## Trin 2: Aktivér Firestore

1. I sidepanelet: **Build → Firestore Database**
2. Tryk **Create database**
3. Vælg **Start in test mode** (åben adgang — det er dét vi vil)
4. Vælg en lokation, fx `eur3 (europe-west)`
5. Tryk **Enable**

⚠️ **Test mode** giver åben skrive/læse-adgang i 30 dage. Efter 30 dage lukker den ned. Se "Trin 6" nedenfor for at holde den åben permanent.

## Trin 3: Tilføj Web-app til projektet

1. I projekt-oversigten: tryk **</>** (Web-ikonet)
2. Giv app'en et navn (fx `opskrifter-web`)
3. Firebase Hosting: **hop over** (vi bruger stadig Netlify)
4. Kopiér hele `firebaseConfig`-objektet der vises

## Trin 4: Indsæt config i projektet

Åbn `firebase-config.js` og udskift værdierne med dem fra Firebase Console:

```js
window.firebaseConfig = {
  apiKey: "AIza…",
  authDomain: "opskrifter-xxxx.firebaseapp.com",
  projectId: "opskrifter-xxxx",
  storageBucket: "opskrifter-xxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
```

## Trin 5: Migrér eksisterende opskrifter

1. Deploy alle filerne til Netlify (eller kør lokalt — se nedenfor)
2. Åbn `https://dit-site.netlify.app/migrate.html`
3. Vælg din nuværende `recipes.json`
4. Tryk **Migrér til Firestore**
5. Alle 11 opskrifter importeres

**Efter migration:** slet `migrate.html` fra repoet, eller lad den ligge (kan bruges igen ved behov).

Den gamle `recipes.json` behøves ikke længere — kan slettes fra repoet.

## Trin 6: Firestore-sikkerhedsregler (permanent åben adgang)

Gå til **Firestore Database → Rules** i Firebase Console og indsæt:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /recipes/{document=**} {
      allow read, write: if true;
    }
  }
}
```

Tryk **Publish**. Nu er databasen permanent åben for læsning og skrivning.

⚠️ Bemærk: Dette betyder at *alle* der finder URL'en til dit site kan læse, tilføje, redigere og slette opskrifter. Da sitet er personligt og ikke linkes offentligt er det fint til dit brug, men vær opmærksom.

## Filer

- `index.html` — hovedsiden
- `app.js` — applikationslogik
- `styles.css` — styling
- `firebase-config.js` — dine Firebase-nøgler (**udskift skabelonværdierne**)
- `migrate.html` — engangs-migration af recipes.json → Firestore
- `README.md` — denne fil

## Features

- **Læsning:** Firestore synkroniserer i realtid på tværs af enheder
- **Tilføj (+):** Paste JSON-blok i modalen → gemmer direkte i Firestore
- **Redigér:** Fra en opskrift → "Rediger" → JSON åbnes prefilled → opdatér
- **Slet:** Fra en opskrift → "Slet" (bekræftelses-dialog)
- **Lykkehjul (🎲):** Vælg tag → spin → få tilfældig opskrift → "Spin igen" eller "Åbn opskrift"
