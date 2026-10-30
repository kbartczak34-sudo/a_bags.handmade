# Sterowanie podglądem 3D

Kreator używa tej samej kamery dla gestów, przycisków, suwaka i klawiatury.

- Przeciągnięcie obraca model. Dwa palce zmieniają skalę; po podniesieniu jednego palca można od razu kontynuować obrót drugim.
- Dodanie, odjęcie lub anulowanie kontaktu przelicza początek gestu względem aktualnego widoku. Zdarzenie `lostpointercapture` po `pointerup` nie zmienia tej podstawy ponownie.
- Utrata fokusu okna, ukrycie dokumentu lub wymiana sceny usuwa przerwany gest.
- Kółko nad płótnem zmienia skalę bez przewijania okna dialogowego. Jednostki pikselowe, wierszowe i stronicowe są normalizowane. Ctrl/Meta z kółkiem pozostają skrótami przeglądarki.
- Po ustawieniu fokusu na podglądzie strzałki obracają model, Shift ze strzałką daje mniejszy krok, +/− zmieniają skalę, a Home przywraca początkowy widok. Tab i Escape pozostają dostępne do nawigacji i zamknięcia dialogu.
- Swobodny obrót usuwa zaznaczenie gotowego widoku. Przyciski Przód, 3/4 i Bok wybierają konkretny kąt, zachowując skalę. Przycisk z procentami przywraca także skalę początkową; ma pełną etykietę dla czytnika ekranu.
- Zakres skali pozostaje 34–145%, a początkowa skala 92%. Przycisk dalszego powiększania/oddalania jest nieaktywny na odpowiedniej granicy.

`lib/abags-camera-controls.ts` realizuje przejścia gestów oraz wspólny zakres kamery. `cameraRef` jest aktualizowany przed kolejnym zdarzeniem, również gdy React nie zatwierdził jeszcze poprzedniej klatki. Obrót nadal trafia do istniejących metadanych i zdarzenia `abags:fidelity3d-transform`, więc dodatki korzystają z tego samego widoku.

`tests/bag-builder-camera-controls.test.mjs` sprawdza przejścia gestów, granice, normalizację kółka, skróty oraz rzeczywiste procedury obsługi komponentu. Sekwencja kilku zdarzeń przed ponownym renderem wykrywa użycie nieaktualnej kamery. Test powiązania kółka sprawdza `passive: false`, zapobieganie przewijaniu, zachowanie skrótów przeglądarki i usunięcie nasłuchiwania.

Etykiety sterowania są większe, a fokus klawiatury ma widoczne obramowanie. Mobilny panel skali zachowuje szerokość 184 px i wysokość do 48 px, zgodnie z dotychczasowymi limitami testów obsługi kreatora.
