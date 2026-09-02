# A-Bags Visual Customizer 2.0 — warstwy produktu

Konfigurator zawsze wykorzystuje prawdziwe zdjęcie produktu jako warstwę bazową. Zmiany wizualne są nakładane jako osobne, przezroczyste pliki PNG/WEBP, dzięki czemu sylwetka i proporcje torebki pozostają nienaruszone 1:1.

## Zalecany sposób dodawania warstw

W panelu właścicielki otwórz zakładkę **Personalizacja**. Wybierz produkt, kategorię i nazwę wariantu, a następnie wgraj przezroczysty plik PNG lub WEBP. Plik zostanie zapisany w magazynie R2, a metadane wariantu w D1. Nie jest potrzebny ręczny commit ani ponowne wdrożenie aplikacji.

Obsługiwane kategorie:

- `color` — kolor,
- `stitch` — splot / ścieg,
- `handles` — uchwyty,
- `hardware` — okucia,
- `strap` — pasek,
- `accent` — detal / ozdoba.

Frontend odwołuje się do ścieżki:

`/images/configurator/<product-id>/<category>/<variant>.png`

Ta ścieżka jest dynamicznie rozwiązywana do warstwy zapisanej w D1/R2. Jeśli dany wariant nie istnieje, konfigurator pozostawia niezmienione zdjęcie bazowe zamiast generować lub deformować produkt.

## Przygotowanie pliku

Warstwa powinna mieć taki sam kadr i proporcje jak zdjęcie bazowe, przezroczyste tło oraz zawierać tylko element, który ma zostać zmieniony. Zalecane jest zachowanie dokładnego położenia i skali produktu. Maksymalny rozmiar pliku przesyłanego przez panel to 4 MB.
