# 🏔️ Corturi · Tabăra Făgăraș

Site prin care participanții la tabără **își fac singuri corturile** și aleg cu cine stau.
Oricine poate **crea un cort** (alege câte locuri are) sau **intra în cortul prietenilor**,
cu validare automată (fără dublă-ocupare, respectă capacitatea și genul). Are și un
**panou de organizator**.

Design **dark, modern**, cu pagină de start și **video din Munții Făgăraș** în hero.

> Starea actuală: **conectat la Supabase** (live, comun pentru toți). Dacă biblioteca
> Supabase nu se încarcă (offline/preview), site-ul cade automat pe un mod **demo** local
> (`localStorage`) cu date de test — deci merge și fără rețea.

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

## Backend (Supabase) — deja conectat

Site-ul folosește un proiect Supabase dedicat (`corturi-fagaras`). Datele sunt comune și live
pentru toți participanții. Detalii:

- Conexiunea e în `assets/config.js` (URL + cheie *publishable* — publică, safe de comis).
- Toate scrierile trec prin funcții Postgres `SECURITY DEFINER` care validează atomic
  (create/join cu `for update` pe cort + `unique` pe participant → o persoană într-un singur
  cort, respectă capacitatea și genul). Nimeni nu scrie direct în tabele din browser.
- PIN-ul de admin stă **doar** în baza de date (hash bcrypt), niciodată în cod.
- Schema completă: `supabase/schema.sql`.

## Identitate + invitații (anti-troll)

- **Verificare prin telefon:** la intrare, fiecare își alege numele apoi confirmă cu
  **numărul lui de telefon** (cel din formular). Fără el nu poate acționa ca acea persoană.
  Fiecare acțiune de scriere poartă un token per-utilizator (verificat în DB), deci nimeni nu
  poate crea corturi sau muta pe altcineva în locul lui.
- **Invitații cu accept:** nu poți băga pe cineva în cort direct. Îl **inviți**, iar el vede
  invitația în contul lui și **acceptă** singur. O persoană rămâne într-un singur cort.
- Cei **78 de participanți sunt deja importați** din formular (nume + telefon pentru
  verificare + gen dedus). Genurile ghicite trebuie confirmate (vezi mai jos).

## Lansare — ce ai de făcut

1. **Publică site-ul** (static, gratuit):
   - Repo privat → GitHub Pages cere plată. Fie faci repo-ul **public** (nu e niciun secret
     în cod), fie folosești **Netlify/Vercel** (gratis, repo rămâne privat).
2. **Intră în admin** (`/admin.html`) cu PIN-ul tău:
   - **Participanți → verifică genurile** (unele sunt ghicite din nume). Apeși M/F ca să
     corectezi; poți filtra pe Băieți/Fete. Tot aici poți edita telefonul cuiva (📱).
   - **Setări:** dacă nu ai schimbat deja PIN-ul, schimbă-l (6+ caractere).
   - Lasă „Înscrieri" pe *deschise* când vrei să înceapă.
3. (Opțional) **Înlocuiește video-ul** din `assets/media/hero.mp4` + `hero-poster.jpg`.
4. **Trimite link-ul** participanților. Fiecare se verifică cu telefonul și își face/își alege
   cortul.

> Notă: 1 participant (Lucas Bumb) nu avea telefon în formular — adaugă-i-l din admin (📱) ca
> să se poată verifica. Restul (77/78) au telefon.
