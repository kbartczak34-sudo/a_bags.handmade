import type { Metadata } from "next";
import LegalShell, { styles } from "../legal/legal-shell";
import { getPublicLegalConfig } from "../../lib/legal-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zwroty i reklamacje | a_bags.handmade",
  description: "Prawo odstąpienia od umowy, zwroty i reklamacje a_bags.handmade.",
};

function valueOrPending(value: string) {
  return value || "adres zostanie uzupełniony przed uruchomieniem sprzedaży";
}

export default function ReturnsPage() {
  const config = getPublicLegalConfig();

  return (
    <LegalShell
      eyebrow="Prawa konsumenta"
      title="Zwroty i reklamacje"
      lead="Procedura odstąpienia od umowy zawartej przez internet oraz zgłaszania niezgodności produktu z umową."
    >
      <section className={styles.section}>
        <h2>Zgłoszenie online</h2>
        <p>
          Zwrot, odstąpienie od umowy lub reklamację możesz zgłosić przez formularz
          online. Po wysłaniu otrzymasz numer sprawy do zachowania.
        </p>
        <p className={styles.notice}>
          <a href="/zwroty-i-reklamacje/zgloszenie">
            <strong>Otwórz formularz zwrotu lub reklamacji →</strong>
          </a>
        </p>
        <p>
          Skorzystanie z formularza nie jest obowiązkowe i nie ogranicza innych
          prawnie dopuszczalnych sposobów złożenia oświadczenia lub reklamacji.
        </p>
      </section>

      <section className={styles.section}>
        <h2>1. 14 dni na odstąpienie</h2>
        <p>
          Konsument może co do zasady odstąpić od umowy sprzedaży zawartej przez internet bez podawania przyczyny w terminie 14 dni od dnia otrzymania towaru przez konsumenta lub wskazaną przez niego osobę inną niż przewoźnik.
        </p>
        <p>
          Aby zachować termin, wystarczy wysłać oświadczenie o odstąpieniu przed jego upływem. Oświadczenie można wysłać na adres e-mail <strong>{config.seller.email}</strong> albo pisemnie na adres sprzedawcy.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Zwrot produktu</h2>
        <p>
          Po złożeniu oświadczenia konsument powinien odesłać produkt bez zbędnej zwłoki, nie później niż w ciągu 14 dni od dnia odstąpienia, na adres:
        </p>
        <p className={styles.notice}><strong>{valueOrPending(config.seller.returnsAddress)}</strong></p>
        <p>
          Jeżeli sprzedawca nie zadeklaruje inaczej, konsument ponosi bezpośredni koszt odesłania towaru. Produkt powinien być zabezpieczony na czas transportu. Konsument odpowiada za zmniejszenie wartości rzeczy wynikające z korzystania z niej w sposób wykraczający poza konieczny do stwierdzenia charakteru, cech i funkcjonowania produktu.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Zwrot płatności</h2>
        <p>
          Po skutecznym odstąpieniu sprzedawca zwraca otrzymane od konsumenta płatności, w tym koszt najtańszego zwykłego sposobu dostawy oferowanego przez sklep, zgodnie z terminami wynikającymi z prawa. Sprzedawca może w przypadkach przewidzianych prawem wstrzymać zwrot do chwili otrzymania produktu z powrotem albo dostarczenia dowodu jego odesłania.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Kiedy prawo odstąpienia może nie przysługiwać</h2>
        <p>
          Wyłączenie może dotyczyć między innymi towaru nieprefabrykowanego, wyprodukowanego według indywidualnej specyfikacji konsumenta lub służącego zaspokojeniu jego zindywidualizowanych potrzeb.
        </p>
        <p className={styles.notice}>
          Standardowa torebka z katalogu nie traci prawa do zwrotu tylko dlatego, że jest handmade lub została wykonana po złożeniu zamówienia. Wyjątek powinien być stosowany wyłącznie do rzeczywiście zindywidualizowanej realizacji.
        </p>
      </section>

      <section className={styles.section}>
        <h2>5. Wzór oświadczenia o odstąpieniu</h2>
        <div className={styles.notice}>
          <p><strong>Adresat:</strong> {valueOrPending(config.seller.legalName)}, {valueOrPending(config.seller.returnsAddress)}</p>
          <p>
            Niniejszym informuję o odstąpieniu od umowy sprzedaży następującego produktu: …
          </p>
          <p>Numer zamówienia: …</p>
          <p>Data zamówienia / otrzymania produktu: …</p>
          <p>Imię i nazwisko konsumenta: …</p>
          <p>Adres konsumenta: …</p>
          <p>Data: …</p>
        </div>
        <p>
          Skorzystanie z powyższego wzoru nie jest obowiązkowe. Wystarczy jednoznaczne oświadczenie o odstąpieniu od umowy.
        </p>
      </section>

      <section className={styles.section}>
        <h2>6. Reklamacja — brak zgodności towaru z umową</h2>
        <p>
          Jeżeli produkt jest niezgodny z umową, konsument może skorzystać z uprawnień przewidzianych w ustawie o prawach konsumenta. W zależności od sytuacji mogą one obejmować żądanie naprawy lub wymiany, a w przypadkach określonych prawem — obniżenie ceny albo odstąpienie od umowy.
        </p>
        <p>
          Odpowiedzialność sprzedawcy za brak zgodności towaru z umową dotyczy braku zgodności istniejącego w chwili dostarczenia i ujawnionego w okresie przewidzianym ustawą. Reklamację najlepiej złożyć na adres <strong>{config.seller.email}</strong> i podać numer zamówienia, nazwę produktu, opis problemu oraz oczekiwane rozwiązanie.
        </p>
      </section>

      <section className={styles.section}>
        <h2>7. Termin odpowiedzi</h2>
        <p>
          Sprzedawca odpowiada na reklamację konsumenta w terminie 14 dni od jej otrzymania, jeżeli przepisy nie przewidują dla danego żądania szczególnego rozwiązania. Brak odpowiedzi w terminie może wywołać skutki przewidziane prawem konsumenckim.
        </p>
      </section>

      <section className={styles.section}>
        <h2>8. Rękodzieło a wada</h2>
        <p>
          Drobne cechy typowe dla ręcznego wykonania mogą stanowić naturalną właściwość produktu, jeżeli klient został o nich jasno poinformowany i nie obniżają bezpieczeństwa ani zgodności z uzgodnionymi cechami. Takie zastrzeżenie nie wyłącza odpowiedzialności za rzeczywistą wadę, uszkodzenie, brak trwałości deklarowanej w ofercie lub inny brak zgodności z umową.
        </p>
      </section>

      <section className={styles.section}>
        <h2>9. Kontakt</h2>
        <p>
          E-mail: <a href={`mailto:${config.seller.email}`}>{config.seller.email}</a><br />
          Telefon: {valueOrPending(config.seller.phone)}<br />
          Adres zwrotów/reklamacji: {valueOrPending(config.seller.returnsAddress)}
        </p>
      </section>
    </LegalShell>
  );
}
