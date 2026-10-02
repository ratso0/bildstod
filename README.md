# 🗣️ Bildstöd

**Bildstöd** är en gratis webb-app för barn och tonåringar som använder AKK (Alternativ och Kompletterande Kommunikation). Appen hjälper barn att kommunicera med hjälp av bilder och ljud.

---

## ✨ Funktioner

- 📁 **Kategorier i flera nivåer** — organisera kort i kategorier (t.ex. Mat → Frukost → Fil)
- 📷 **Egna bilder** — ta foto direkt med kameran eller välj från galleriet, och beskär bilden
- 😊 **Symboler** — använd en symbol i stället för foto
- 🎙️ **Eget ljud** — spela in röstmeddelanden till varje bild
- 🧩 **Meningsremsa** — tryck på flera kort och låt appen läsa upp hela meningen
- 👍👎 **Ja och Nej** — stora tydliga knappar, med talsyntes eller din egen inspelade röst
- 🗣️ **Talsyntes** — välj röst, hastighet och tonhöjd
- 🔢 **1–4 kort per rad** — större kort för de som behöver det
- ↕️ **Sortera** — håll in ett kort och dra det dit du vill (i vuxenläget)
- 🙈 **Dölj kort** tillfälligt utan att ta bort dem
- 👧 **Profiler** — flera barn kan dela samma enhet med egna kort
- 📌 **Skolläge** — lås appen till en kategori
- 📦 **Startpaket** — färdiga kategorier som Mat & dryck, Känslor, Behov och Aktiviteter
- 🔒 **Vuxenläge** — PIN-skyddad redigering så barn inte råkar ändra något
- 🌓 **Mörkt läge** — följer telefonens inställning eller väljs manuellt
- 📤 **Säkerhetskopiering** — spara och återställ korten som en fil
- 💾 **Sparas lokalt** — all data sparas på enhetens minne, inget skickas till server
- 🌐 **Fungerar offline** — ingen internetanslutning behövs efter första laddningen

---

## 🎯 För vem?

Appen är skapad för barn och tonåringar i anpassad grundskola och andra som har nytta av bildbaserad kommunikation. Den är gratis och kräver ingen inloggning eller prenumeration.

---

## 📱 Kom igång

Öppna appen direkt i webbläsaren:

👉 **[ratso0.github.io/bildstod](https://ratso0.github.io/bildstod/)**

### Lägg till på hemskärmen (Android)
1. Öppna länken i Chrome
2. Tryck ⋮ → "Lägg till på hemskärmen"
3. Appen finns nu som en ikon på hemskärmen!

### Lägg till på hemskärmen (iPhone)
1. Öppna länken i Safari
2. Tryck dela-ikonen → "Lägg till på hemskärmen"

---

## 🔒 Vuxenläge

Första gången du trycker på 🔒 får du välja en egen PIN-kod med fyra siffror.

Har du glömt koden trycker du på **"Glömt PIN-koden?"** och svarar på en enkel vuxenfråga. Sedan väljer du en ny kod. Inga kort försvinner.

I vuxenläget kan du:
- Lägga till, redigera, dölja, sortera och ta bort kort och kategorier
- Ändra visning, talsyntes och egen Ja/Nej-röst
- Hantera profiler, skolläge och startpaket
- Säkerhetskopiera och återställa
- Byta PIN-kod

---

## 🛠️ Teknik

- Enkel HTML/CSS/JavaScript — ingen server eller byggsteg behövs
  - `index.html` — sidans struktur
  - `app.css` — utseende
  - `app.js` — all logik
  - `sw.js` — service worker för offline-stöd
  - `fonts/` — typsnittet Nunito (lokalt, så det fungerar offline)
  - `vendor/Sortable.min.js` — [SortableJS](https://github.com/SortableJS/Sortable) för dra och släpp
- Korten lagras i webbläsarens IndexedDB (en databas per profil), inställningar i localStorage
- Fungerar som PWA (Progressive Web App)

---

## 📄 Licens

Gratis att använda och dela. Skapad med ❤️ för barn som behöver bildstöd.
