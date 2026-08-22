import type { Metadata } from "next";
import LegalShell, { styles } from "../legal/legal-shell";
import { getPublicLegalConfig } from "../../lib/legal-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Regulamin sklepu | a_bags.handmade",
  description: "Regulamin sprzedaży internetowej i usług elektronicznych a_bags.handmade.",
};

const money = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
});

export default function TermsPage() {
  const config = getPublicLegalConfig();

  return (
    <LegalShell
      eyebrow="Dokumenty prawne"
      title="Regulamin sklepu internetowego"
      lead="Zasady składania zamówień, płatności, dostawy, odstąpienia od umowy, reklamacji oraz korzystania z funkcji elektronicznych a_bags.handmade."
    >
      <section className={styles.section}>
        <h2>1. Postanowienia ogólne</h2>
        <p>
          Sklep internetowy a_bags.handmade prowadzi sprzedaż produktów na odległość na terytorium Polski. Sprzedawcą i stroną umowy jest podmiot wskazany w sekcji „Dane sprzedawcy” powyżej.
        </p>
        <p>
          Regulamin jest udostępniany nieodpłatnie w formie pozwalającej na jego zapisanie i odtworzenie. Klient powinien zapoznać się z nim przed złożeniem zamówienia.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Produkty i ceny</h2>
        <p>
          Produkty są ręcznie wykonywanymi torebkami. Ze względu na charakter rękodzieła poszczególne egzemplarze mogą nieznacznie różnić się układem splotu, rozmieszczeniem detali lub odcieniem, o ile różnice te nie wpływają na zgodność produktu z umową i jego bezpieczeństwo.
        </p>
        <p>
          Ceny prezentowane konsumentowi są cenami końcowymi zgodnymi z aktualnie skonfigurowanym statusem VAT sklepu. Koszt standardowej dostawy jest podawany przed złożeniem zamówienia i obecnie wynosi <strong>{money.format(config.shippingAmount / 100)}</strong>.
        </p>
        <p>
          Jeżeli sklep komunikuje obniżkę ceny, informacja o najniższej cenie z 30 dni przed obniżką powinna zostać pokazana zgodnie z obowiązującymi przepisami.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Składanie zamówienia i zawarcie umowy</h2>
        <ol>
          <li>Klient wybiera produkt i dodaje go do koszyka.</li>
          <li>Przed płatnością sklep pokazuje produkty, ich ilość, cenę oraz koszt dostawy.</li>
          <li>Klient podaje adres e-mail, zapoznaje się z regulaminem i informacjami o odstąpieniu oraz przechodzi do operatora płatności Stripe.</li>
          <li>Adres dostawy i numer telefonu są podawane w zabezpieczonym formularzu Stripe Checkout.</li>
          <li>Umowa sprzedaży zostaje zawarta po skutecznym przyjęciu zamówienia i płatności przez system sklepu, z zastrzeżeniem dostępności produktu.</li>
        </ol>
        <p className={styles.notice}>
          Sklep nie powinien przyjmować zamówień, dopóki system nie potwierdzi kompletności danych sprzedawcy, producenta i konfiguracji podatkowej.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Płatności</h2>
        <p>
          Płatności są obsługiwane przez Stripe. W zależności od konfiguracji konta i urządzenia klienta dostępne mogą być BLIK, karta płatnicza oraz obsługiwane portfele mobilne. a_bags.handmade nie przechowuje numerów kart ani kodów BLIK.
        </p>
      </section>

      <section className={styles.section}>
        <h2>5. Dostawa</h2>
        <p>
          Dostawa jest realizowana na adres w Polsce wskazany w procesie płatności. Dostępne sposoby i przewidywany termin dostawy są prezentowane klientowi przed zatwierdzeniem płatności. Jeżeli w sklepie aktywowano odbiór osobisty, jego warunki i adres są wyświetlane podczas składania zamówienia.
        </p>
      </section>

      <section className={styles.section}>
        <h2>6. Prawo odstąpienia od umowy</h2>
        <p>
          Konsument, który zawarł umowę na odległość, może co do zasady odstąpić od niej bez podawania przyczyny w terminie 14 dni od otrzymania towaru. Szczegółowa instrukcja i wzór oświadczenia znajdują się na stronie <a href="/zwroty-i-reklamacje">Zwroty i reklamacje</a>.
        </p>
        <p>
          Prawo odstąpienia może nie przysługiwać między innymi w przypadku towaru nieprefabrykowanego, wykonanego według indywidualnej specyfikacji konsumenta lub służącego zaspokojeniu jego zindywidualizowanych potrzeb. Sam fakt ręcznego wykonania produktu albo wykonania standardowego modelu po złożeniu zamówienia nie oznacza automatycznie wyłączenia prawa odstąpienia.
        </p>
      </section>

      <section className={styles.section}>
        <h2>7. Reklamacje i zgodność towaru z umową</h2>
        <p>
          Sprzedawca odpowiada wobec konsumenta za brak zgodności towaru z umową na zasadach wynikających z ustawy o prawach konsumenta. Reklamację można złożyć na adres e-mail sprzedawcy albo na adres do reklamacji wskazany w danych sprzedawcy.
        </p>
        <p>
          Reklamacja powinna opisywać produkt, problem i oczekiwany sposób rozwiązania. Sprzedawca udziela odpowiedzi w terminie wymaganym prawem. Szczegółowa procedura znajduje się na stronie <a href="/zwroty-i-reklamacje">Zwroty i reklamacje</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>8. Opinie</h2>
        <p>
          Opinie przesyłane przez publiczny formularz są moderowane przed publikacją pod kątem spamu, treści bezprawnych i danych osób trzecich. Jeżeli opinia nie została powiązana z rzeczywistym zamówieniem, sklep nie przedstawia jej jako opinii ze zweryfikowanego zakupu.
        </p>
      </section>

      <section className={styles.section}>
        <h2>9. Usługi świadczone drogą elektroniczną</h2>
        <p>
          Sklep świadczy nieodpłatnie usługi elektroniczne umożliwiające między innymi przeglądanie katalogu, korzystanie z koszyka, formularza opinii i rozpoczęcie procesu płatności. Do korzystania ze sklepu potrzebne są aktualna przeglądarka internetowa, dostęp do internetu oraz — dla części funkcji — obsługa JavaScript i pamięci lokalnej przeglądarki.
        </p>
        <p>
          Zabronione jest dostarczanie treści bezprawnych, podejmowanie prób naruszenia bezpieczeństwa sklepu, automatyczne przeciążanie usług oraz używanie formularzy niezgodnie z ich przeznaczeniem.
        </p>
      </section>

      <section className={styles.section}>
        <h2>10. Dane osobowe i pliki cookies</h2>
        <p>
          Zasady przetwarzania danych osobowych opisuje <a href="/polityka-prywatnosci">Polityka prywatności</a>, a informacje o pamięci lokalnej, cookies i treściach zewnętrznych — <a href="/cookies">Polityka cookies</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>11. Postanowienia końcowe</h2>
        <p>
          Do umów z konsumentami stosuje się prawo polskie z zachowaniem bezwzględnie obowiązujących praw konsumenta. Konsument może korzystać z pozasądowych sposobów rozpatrywania sporów, jeżeli spełnione są warunki właściwej procedury; informacje o dostępnych formach pomocy publikuje UOKiK i właściwi rzecznicy konsumentów.
        </p>
        <p>
          Wersja dokumentu: 22 sierpnia 2026 r. Zmiany regulaminu nie naruszają praw nabytych w związku z zamówieniami złożonymi przed wejściem zmian w życie.
        </p>
      </section>
    </LegalShell>
  );
}
