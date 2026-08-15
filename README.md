# BONUS 6 – Höstövning

Mobil webbapp för sjöräddningsövningen "Höstövning". Besättningen anger gruppnummer och går igenom tre tidsbegränsade prioriteringsscenarier, skriver en motivering och skickar ett rapportmeddelande via SMS mellan varje steg.

Byggd som en fristående statisk sida (`index.html`, `style.css`, `script.js`) utan externa beroenden, så den fungerar tillförlitligt på mobil ute i fält.

## Köra lokalt

Öppna `index.html` i en webbläsare, eller starta en enkel server:

```sh
python3 -m http.server 8000
```

och besök `http://localhost:8000`.

## Publicera på GitHub Pages

Ett workflow (`.github/workflows/deploy-pages.yml`) publicerar automatiskt till GitHub Pages vid varje push till `main`.

Första gången måste Pages aktiveras i repot:

1. Gå till **Settings → Pages**.
2. Under **Build and deployment → Source**, välj **GitHub Actions**.
3. Pusha till `main` (eller kör workflowet manuellt via **Actions → Deploy to GitHub Pages → Run workflow**).

Sidan publiceras därefter på `https://<användare>.github.io/<repo>/`.
