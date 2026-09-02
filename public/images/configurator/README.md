# A-Bags Visual Customizer assets

Każdy wariant wizualny jest przezroczystą warstwą PNG nakładaną na rzeczywiste zdjęcie produktu bazowego. Nie generujemy produktu od nowa i nie zmieniamy jego geometrii.

Struktura:

`public/images/configurator/<produkt>/<kategoria>/<wariant>.png`

Obsługiwane kategorie:

- `color`
- `stitch`
- `handles`
- `hardware`
- `strap`
- `accent`

Przykład:

`public/images/configurator/model-luna/color/gleboki-granat.png`

Wymagania dla warstw:

- identyczny rozmiar płótna i kadr jak zdjęcie bazowe,
- przezroczyste tło,
- zmieniony wyłącznie element reprezentowany przez daną kategorię,
- bez zmiany proporcji, splotu, kształtu ani pozostałych detali produktu,
- eksport PNG w przestrzeni sRGB,
- rekomendowany rozmiar 1600 × 1600 px.

Jeżeli warstwa dla wybranego wariantu nie istnieje, konfigurator zachowuje niezmienione zdjęcie bazowe zamiast tworzyć sztuczny zamiennik.