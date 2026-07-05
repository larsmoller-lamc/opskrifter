# Opskrifter

En simpel opskriftsside. Data ligger i `recipes.json` — hjemmesiden læser den og viser opskrifterne.

## Struktur

```
recipes.json    ← databasen  (rediger denne for at tilføje/ændre opskrifter)
index.html      ← hovedsiden
styles.css      ← styling
app.js          ← logik (søgning, filtrering, detail-view)
```

## Sådan får du sitet live på GitHub Pages

Kan gøres helt fra mobilen. Første gang tager det 3-4 minutter.

### 1. Opret repo
1. Gå til github.com og log ind
2. Tryk `+` i toppen → `New repository`
3. Navngiv fx `opskrifter` (må gerne være public — det er nødvendigt for gratis GitHub Pages)
4. Sæt flueben ved `Add a README file`
5. Tryk `Create repository`

### 2. Upload filerne
1. På forsiden af dit nye repo: tryk `Add file` → `Upload files`
2. Vælg alle 4 filer (`recipes.json`, `index.html`, `styles.css`, `app.js`) — du kan uploade dem samtidig
3. Scroll ned → tryk `Commit changes`

### 3. Aktivér GitHub Pages
1. Tryk `Settings` (øverst i repo'et)
2. I venstre menu: `Pages`
3. Under `Source` — vælg `Deploy from a branch`
4. Under `Branch` — vælg `main`, mappe `/ (root)`, tryk `Save`
5. Vent 30-60 sekunder, opdater siden — der står nu en URL i toppen: `https://<dit-brugernavn>.github.io/opskrifter/`

Den URL er din side. Del den med andre. Læg den til hjem-skærmen på mobilen (Safari: dele-knap → "Føj til hjemmeskærm").

## Sådan tilføjer du en ny opskrift (fra mobil)

1. Bed Claude om at hente en opskrift fra en URL — du får en JSON-blok tilbage
2. Åbn `recipes.json` på github.com i browseren
3. Tryk blyant-ikonet (rediger)
4. Indsæt JSON-blokken efter den sidste `}` — husk komma foran
5. Scroll ned → `Commit changes`
6. Efter 30-60 sekunder er den nye opskrift live på sitet

## JSON-format for en opskrift

```json
{
  "id": "kort-unikt-id",
  "navn": "Navn på opskrift",
  "kilde": "Kildens navn",
  "kilde_url": "https://... eller null",
  "portioner": 4,
  "tags": ["aftensmad"],
  "favorit": false,
  "billede": null,
  "noter": null,
  "ingredienser": [
    { "mængde": 500, "enhed": "g", "navn": "hakket oksekød" },
    { "mængde": null, "enhed": null, "navn": "peber" }
  ],
  "fremgangsmåde": [
    "Trin 1...",
    "Trin 2..."
  ]
}
```

**Gyldige tags**: `morgenmad`, `frokost`, `aftensmad`, `dessert`, `brød`, `kage`. (En opskrift kan have flere.)

**Enheder**: fri tekst — `g`, `kg`, `dl`, `l`, `ml`, `spsk`, `tsk`, `stk`, `fed`, `dåse`, `bundt` osv.

**Ingredienser uden mængde** (fx "peber efter smag"): sæt `"mængde": null, "enhed": null`.

**Billede**: `null` eller en URL. Sitet fungerer fint uden.

**Noter**: `null` eller en tekst. Vises kun hvis der er noget.

## Ændre eller slette

Åbn `recipes.json` på github.com, tryk blyanten, rediger, commit. Ændringen er live efter 30-60 sekunder.
