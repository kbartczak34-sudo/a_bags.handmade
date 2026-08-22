import type { Metadata } from "next";
import LegalShell, { styles } from "../legal/legal-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Polityka prywatności | a_bags.handmade",
  description: "Informacje o przetwarzaniu danych osobowych w a_bags.handmade.",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="RODO"
      title="Polityka prywatności"
      lead="Informacja o tym, jakie dane są przetwarzane podczas korzystania ze sklepu, składania zamówienia, płatności i publikowania opinii oraz jakie prawa przysługują osobom, których dane dotyczą."
    >
      <section className={styles.section}>
        <h2>1. Administrator danych</h2>
        <p>
          Administratorem danych osobowych jest sprzedawca wskazany w sekcji „Dane sprzedawcy” powyżej. Kontakt w sprawach dotyczących prywatności jest możliwy przez wskazany tam adres e-mail i pozostałe dane kontaktowe.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Jakie dane mogą być przetwarzane</h2>
        <ul>
          <li>adres e-mail podawany przy zamówieniu,</li>
          <li>imię i nazwisko, numer telefonu oraz adres dostawy przekazywane w procesie Stripe Checkout,</li>
          <li>informacje o zamówionych produktach, kwocie, płatności i dostawie,</li>
          <li>dane niezbędne do obsługi zwrotu, reklamacji lub faktury,</li>
          <li>imię lub inicjały i treść dobrowolnie przesłanej opinii,</li>
          <li>podstawowe dane techniczne i bezpieczeństwa związane z korzystaniem ze strony, takie jak adres IP, informacje o żądaniu HTTP i logi bezpieczeństwa — w zakresie generowanym przez infrastrukturę hostingową.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>3. Cele i podstawy prawne</h2>
        <ul>
          <li><strong>Realizacja zamówienia i płatności</strong> — przetwarzanie niezbędne do zawarcia i wykonania umowy.</li>
          <li><strong>Rozliczenia i obowiązki prawne</strong> — przetwarzanie wymagane przez przepisy podatkowe, rachunkowe i inne obowiązki ciążące na sprzedawcy.</li>
          <li><strong>Reklamacje, zwroty i dochodzenie lub obrona roszczeń</strong> — wykonanie obowiązków umownych i prawnie uzasadniony interes administratora.</li>
          <li><strong>Bezpieczeństwo sklepu</strong> — prawnie uzasadniony interes polegający na ochronie systemu, przeciwdziałaniu nadużyciom i diagnozowaniu błędów.</li>
          <li><strong>Publikacja opinii</strong> — na podstawie dobrowolnego działania osoby przesyłającej opinię oraz — w zakresie publikacji oznaczenia autora — jej wyraźnej zgody wyrażonej w formularzu.</li>
          <li><strong>Marketing elektroniczny</strong> — wyłącznie po spełnieniu wymogów dotyczących zgody, jeżeli taka funkcja zostanie w przyszłości uruchomiona.</li>
        </ul>
        <p className={styles.notice}>
          Sklep nie wymaga „zgody RODO” na przetwarzanie danych, które są niezbędne do realizacji zwykłego zamówienia. Takie przetwarzanie opiera się przede wszystkim na umowie i obowiązkach prawnych.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Odbiorcy danych</h2>
        <p>Dane mogą być udostępniane podmiotom, które są niezbędne do działania sklepu, w szczególności:</p>
        <ul>
          <li><strong>Stripe</strong> — obsługa płatności i bezpiecznego formularza checkout,</li>
          <li><strong>Cloudflare</strong> — hosting, dostarczanie treści, bezpieczeństwo i infrastruktura aplikacji,</li>
          <li>operatorom dostawy — w zakresie potrzebnym do doręczenia przesyłki,</li>
          <li>dostawcom poczty elektronicznej i narzędzi do wysyłania wiadomości transakcyjnych,</li>
          <li>podmiotom księgowym, podatkowym lub prawnym — jeżeli jest to niezbędne do realizacji obowiązków sprzedawcy.</li>
        </ul>
        <p>
          Operator płatności oraz niektórzy dostawcy infrastruktury mogą przetwarzać dane również według własnych zasad prywatności, a w określonych przypadkach przekazywać dane poza Europejski Obszar Gospodarczy przy zastosowaniu mechanizmów dopuszczonych przez RODO.
        </p>
      </section>

      <section className={styles.section}>
        <h2>5. Jak długo przechowujemy dane</h2>
        <p>
          Dane związane z zamówieniem są przechowywane przez okres niezbędny do wykonania umowy, realizacji obowiązków podatkowych i rachunkowych oraz do upływu właściwych terminów przedawnienia roszczeń. Dane dotyczące opinii są przechowywane do czasu jej usunięcia, cofnięcia zgody w zakresie, w którym zgoda jest podstawą, albo ustania celu publikacji. Logi bezpieczeństwa są przechowywane przez okres uzasadniony bezpieczeństwem i diagnostyką systemu.
        </p>
      </section>

      <section className={styles.section}>
        <h2>6. Prawa osoby, której dane dotyczą</h2>
        <p>W granicach wynikających z RODO możesz żądać:</p>
        <ul>
          <li>dostępu do swoich danych i otrzymania ich kopii,</li>
          <li>sprostowania danych,</li>
          <li>usunięcia danych,</li>
          <li>ograniczenia przetwarzania,</li>
          <li>przeniesienia danych,</li>
          <li>wniesienia sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie,</li>
          <li>cofnięcia zgody w dowolnym momencie, jeżeli dane są przetwarzane na podstawie zgody.</li>
        </ul>
        <p>
          Cofnięcie zgody nie wpływa na zgodność z prawem przetwarzania dokonanego przed jej cofnięciem. Osoba, która uważa, że jej dane są przetwarzane niezgodnie z prawem, może złożyć skargę do Prezesa Urzędu Ochrony Danych Osobowych.
        </p>
      </section>

      <section className={styles.section}>
        <h2>7. Czy podanie danych jest obowiązkowe</h2>
        <p>
          Dane oznaczone jako wymagane w procesie zamówienia są potrzebne do zawarcia i wykonania umowy. Bez ich podania realizacja zamówienia może być niemożliwa. Przesłanie opinii jest dobrowolne.
        </p>
      </section>

      <section className={styles.section}>
        <h2>8. Zautomatyzowane decyzje</h2>
        <p>
          a_bags.handmade nie podejmuje wobec klientów decyzji wywołujących skutki prawne wyłącznie w sposób zautomatyzowany. Operator płatności może stosować własne automatyczne mechanizmy przeciwdziałania oszustwom i oceny bezpieczeństwa płatności na zasadach określonych przez tego operatora.
        </p>
      </section>

      <section className={styles.section}>
        <h2>9. Cookies i treści zewnętrzne</h2>
        <p>
          Informacje o pamięci lokalnej koszyka, cookies funkcjonalnych i zewnętrznych treściach, takich jak Instagram, znajdują się w <a href="/cookies">Polityce cookies</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>10. Aktualizacja dokumentu</h2>
        <p>
          Wersja dokumentu: 22 sierpnia 2026 r. Polityka powinna być aktualizowana po zmianie dostawców, zakresu danych, funkcji marketingowych lub sposobów przetwarzania danych.
        </p>
      </section>
    </LegalShell>
  );
}
