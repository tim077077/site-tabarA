# ⛺ Corturi de Tabără — repartizare pe corturi

Un mic site prin care participanții la tabără **își aleg singuri cortul și colegii de cort**,
cu validare automată (fără dublă-ocupare, respectă capacitatea și genul). Are și un **panou
de organizator** pentru gestionarea participanților, corturilor și cererilor.

> Starea actuală: **frontend complet, funcțional**, cu date demo salvate local în browser
> (`localStorage`). Backend-ul real (Supabase) se conectează într-un pas separat — vezi mai jos.

## Ce poți face acum

- **Participant** (`index.html`):
  1. Îți cauți numele în listă.
  2. Vezi corturile pentru genul tău, cu locurile libere live.
  3. Alegi un cort și bifezi colegii (rezervare parțială permisă — ceilalți se alătură mai târziu).
  4. Confirmi. Dacă nu mai e loc nicăieri, poți trimite o **cerere** organizatorului.
- **Organizator** (`admin.html`, PIN implicit `1234`):
  - **Repartizare** — vedere live pe corturi + scoate persoane.
  - **Corturi** — adaugă/editează/șterge (nume, gen, capacitate).
  - **Participanți** — adăugare în masă („Nume, gen" pe fiecare linie), ștergere.
  - **Cereri** — aprobă/respinge cererile.
  - **Setări** — nume tabără, deschide/închide înscrierile, schimbă PIN, golește repartizările.

## Structură

```
index.html          Fluxul participantului
admin.html          Panoul organizatorului
assets/styles.css   Design system (temă de tabără, mobile-first, light/dark)
assets/store.js     Stratul de date (acum localStorage + date demo; interfața rămâne la fel când trecem pe Supabase)
assets/ui.js        Helperi UI comuni (avatare, toast, sheet-uri)
assets/app.js       Logica participantului
assets/admin.js     Logica organizatorului
```

Toată logica UI folosește obiectul `Store` (din `assets/store.js`) prin metode `async`.
Când conectăm Supabase, rescriem doar `store.js` — restul site-ului rămâne neschimbat.

## Rulare locală

Orice server static simplu:

```bash
python3 -m http.server 8099
# apoi deschide http://localhost:8099/index.html
```

Datele demo se resetează din **Setări → „Resetează datele demo"** (sau ștergând
localStorage-ul browserului).

## Publicare (gratuit)

- **GitHub Pages**: Settings → Pages → Branch → `/` (root). Site instant.
- Sau **Netlify / Vercel**: drag & drop folderul. Nu e nimic de compilat.

## Pasul următor: backend real (Supabase)

Pentru ca toți participanții să vadă **aceleași** corturi în timp real (nu doar local în
browser), datele trebuie într-o bază de date comună. Planul:

1. Tabele `camp_tents`, `camp_participants`, `camp_assignments`, `camp_requests`, `camp_settings`.
2. Toate rezervările prin funcții Postgres (`SECURITY DEFINER`) care validează atomic
   (blochează cortul cu `FOR UPDATE`, constrângere `UNIQUE` pe participant → un singur cort).
3. Un `store.js` nou care apelează aceste funcții (RPC) prin `@supabase/supabase-js`.
   Interfața publică rămâne identică, deci UI-ul nu se schimbă.
4. Cheia *publishable* e publică (safe de comis); PIN-ul de admin stă doar în baza de date.

Proiectul Supabase există deja și e pregătit pentru acest pas.
