# 🏔️ Corturi · Tabăra Făgăraș

Site prin care participanții la tabără **își fac singuri corturile** și aleg cu cine stau.
Oricine poate **crea un cort** (alege câte locuri are) sau **intra în cortul prietenilor**,
cu validare automată (fără dublă-ocupare, respectă capacitatea și genul). Are și un
**panou de organizator**.

Design **dark, modern**, cu pagină de start și **video din Munții Făgăraș** în hero.

> Starea actuală: **frontend complet, funcțional**, cu date demo salvate local în browser
> (`localStorage`). Backend-ul real (Supabase) se conectează într-un pas separat (vezi jos).

## Fluxul

**Participant** (`index.html`):
1. **Start page** cu video Făgăraș → „Începe".
2. Îți cauți numele în listă.
3. Vezi corturile pentru genul tău (live). Poți:
   - **Crea un cort** — alegi câte locuri (2–8), un nume opțional, și poți invita colegi pe loc.
   - **Intra într-un cort** existent (dacă are locuri) — singur sau aducând colegi.
4. Confirmare cu colegii de cort. Rezervarea parțială e permisă (alții se pot alătura până se umple).
   Dacă un cort e plin, poți trimite o **cerere** organizatorului.

**Organizator** (`admin.html`, PIN implicit `1234`):
- **Repartizare** — vedere live pe corturi + scoate persoane.
- **Corturi** — vezi/șterge corturile create de participanți.
- **Participanți** — adăugare în masă („Nume, gen" pe fiecare linie), ștergere.
- **Cereri** — aprobă/respinge.
- **Setări** — nume tabără, deschide/închide înscrierile, schimbă PIN, șterge corturile.

## Structură

```
index.html          Landing (video) + fluxul participantului
admin.html          Panoul organizatorului
assets/styles.css   Design system dark (glassmorphism, aurora, Space Grotesk/Inter)
assets/store.js     Stratul de date (localStorage + demo; interfața rămâne la fel la trecerea pe Supabase)
assets/ui.js        Helperi UI comuni
assets/app.js       Logica participantului (creează/intră în cort)
assets/admin.js     Logica organizatorului
assets/media/       hero.mp4 + hero-poster.jpg (fundal video)
```

Toată logica UI folosește obiectul `Store` prin metode `async`. La conectarea Supabase se
rescrie **doar `store.js`** — restul rămâne neschimbat.

## Video-ul din hero

`assets/media/hero.mp4` (720p, ~2 MB, redat mut & în buclă) + `hero-poster.jpg` ca fallback.
Sursă: stock video gratuit de pe [Pexels](https://www.pexels.com) (Pexels License — gratuit,
fără atribuire obligatorie). Îl poți înlocui cu orice alt clip (ex: un video real din Făgăraș) —
doar suprascrie cele două fișiere.

## Rulare locală

```bash
python3 -m http.server 8099
# http://localhost:8099/index.html
```

Reset date demo: **Setări → „Resetează datele demo"** (sau golește localStorage).

## Publicare (gratuit)

- **GitHub Pages**: Settings → Pages → Branch → `/` (root).
- Sau **Netlify / Vercel**: drag & drop folderul. Nimic de compilat.

## Pasul următor: backend real (Supabase)

Ca toți să vadă **aceleași** corturi live (nu doar local în browser), datele merg într-o bază
comună. Plan: tabele `camp_tents` (cu `created_by`), `camp_participants`, `camp_requests`,
`camp_settings`; funcții Postgres `SECURITY DEFINER` care validează atomic (create/join cu
`FOR UPDATE` + `UNIQUE` pe participant); un `store.js` nou care le apelează prin
`@supabase/supabase-js`. Proiectul Supabase există deja și e pregătit.
