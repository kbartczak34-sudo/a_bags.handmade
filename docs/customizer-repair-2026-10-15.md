# Naprawa kreatora 3D — 15 października 2026

Zakres: zgłoszenie #165, poprawka dostarczana przez PR #202. Produkcja to
`https://abagshandmade.pl`, wdrażana z `main` do Cloudflare Workers.

## Odtworzone przyczyny

- Mobilny WebGL miał 780×492 piksele, a tylna warstwa dodatków 585×369.
  Wszystkie cztery płótna dodatków przejmują teraz siatkę WebGL i jej zaokrąglenia.
- Wykończenie dodatków używało innej kamery i kolejności obrotów. Obie aktywne
  warstwy korzystają teraz ze wspólnej projekcji zgodnej z modelem 3D.
- Osobna nakładka łańcucha zasłaniała właściwą warstwę i rysowała drugi łuk.
  Została wycofana z aktywnego stosu. Rzeczywisty łańcuch WebGL i wykończenie
  używają tego samego kompaktowego łuku oraz punktów mocowania paska.
- Etykiety tekstowe zajmowały kolumny siatki zoomu i wypychały przyciski poza
  przycięty kontener na desktopie. Na tablecie kontener był dodatkowo węższy od
  sumy kolumn. Kontrolki mieszczą się teraz w jednym wierszu.
- Obsługa utraty/przywrócenia WebGL była zdefiniowana, ale niepodpięta do płótna.
  Produkcyjna próba `WEBGL_lose_context` pozostawała w `fallback: no-active-program`.
  Renderer odbudowuje teraz zasoby GPU po przywróceniu kontekstu.
- Opóźniona pierwsza klatka mogła pozostać zablokowana przez wcześniejszy timeout;
  przejściowe braki metadanych dopuszczają teraz ponowną weryfikację klatki.
  Zmiana rozmiaru elementu korzysta z aktualnej kamery.

## Sprawdzenie

Standardowe polecenia: `npm run check` oraz
`ABAGS_SKIP_REMOTE_RESOURCE_DISCOVERY=1 npm run build`.

Testy zachowania uruchamiają prawdziwy Chromium/Chrome przez CDP:

```sh
node scripts/customizer-qa-server.mjs
# w drugim terminalu
ABAGS_PRODUCTION_URL=http://127.0.0.1:5173 node scripts/smoke-customizer-lifecycle.mjs
ABAGS_PRODUCTION_URL=http://127.0.0.1:5173 node scripts/smoke-customizer-anchor-integrity.mjs
```

Test cyklu obejmuje desktop 1440×900, tablet 800×900 oraz telefon 390×844 z DPR2:
widoczne piksele aktualnej konfiguracji, obrót myszą/dotykiem, zoom, reset,
pinch na telefonie, resize, utratę i powrót WebGL, zamknięcie/ponowne otwarcie.
Desktop sprawdza również pierwszą klatkę po ukryciu sceny dłuższym niż timeout.
Test dodatków sprawdza widoki przód/3⁄4/bok, zgodność wszystkich czterech siatek,
kontakt dodatków z modelem i brak starej nakładki łańcucha. Zapisuje JSON i zrzuty.

Próg powierzchni uchwytu w widoku 3⁄4 odnosi się do jego rzeczywistego rzutu
z przodu i cosinusa obrotu, z tolerancją brzegów rastra. Próg liczby próbek
krótszego łuku w widoku bocznym uwzględnia jego skrót perspektywiczny;
wymogi kontaktu i rozdzielenia dwóch uchwytów pozostają weryfikowane.

Nowy etap `Verify production build` uruchamia oba testy przed scaleniem PR
i publikuje dowody jako artefakt Actions. Serwer QA używa daty zgodności
z zainstalowanym lokalnie `workerd`, przez tymczasową kopię konfiguracji Vite.
Konfiguracja produkcyjna pozostaje podstawą buildu. Testy mobilne emulują
rozmiar i dotyk w Chromium; nie zastępują testu na fizycznym urządzeniu Android.
