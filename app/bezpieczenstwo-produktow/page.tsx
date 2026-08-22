import type { Metadata } from "next";
import LegalShell, { styles } from "../legal/legal-shell";
import { getPublicLegalConfig } from "../../lib/legal-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bezpieczeństwo produktów GPSR | a_bags.handmade",
  description: "Informacje o producencie, identyfikacji i bezpiecznym użytkowaniu produktów a_bags.handmade.",
};

function valueOrPending(value: string) {
  return value || "Do uzupełnienia przed uruchomieniem sprzedaży";
}

export default function ProductSafetyPage() {
  const config = getPublicLegalConfig();

  return (
    <LegalShell
      eyebrow="GPSR · bezpieczeństwo produktów"
      title="Bezpieczeństwo i identyfikacja produktów"
      lead="Informacje wymagane przy internetowej sprzedaży produktów konsumenckich oraz podstawowe zasady bezpiecznego korzystania z ręcznie wykonywanych torebek."
    >
      <section className={styles.section}>
        <h2>1. Producent</h2>
        <p>
          <strong>{valueOrPending(config.manufacturer.name)}</strong><br />
          {valueOrPending(config.manufacturer.address)}<br />
          E-mail: {valueOrPending(config.manufacturer.email)}
        </p>
        <p>
          Jeżeli produkty są wytwarzane i wprowadzane do obrotu pod marką a_bags.handmade przez podmiot mający siedzibę w Polsce, ten podmiot powinien być wskazany jako producent w rozumieniu właściwych obowiązków bezpieczeństwa produktów.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Identyfikacja produktu</h2>
        <p>
          Każdy model sprzedawany przez sklep posiada identyfikator katalogowy i nazwę modelu. Przed uruchomieniem seryjnej sprzedaży do procesu fulfillment należy włączyć identyfikację egzemplarza lub partii — np. kod w formacie <span className={styles.code}>AB-MODEL-YYYY-NNN</span> — tak aby można było powiązać produkt z dokumentacją produkcji i ewentualnym zgłoszeniem bezpieczeństwa.
        </p>
        <p>
          Identyfikator, dane producenta oraz wymagane informacje bezpieczeństwa powinny znajdować się na produkcie, opakowaniu albo w dokumencie dołączonym do produktu, zależnie od charakteru i rozmiaru produktu oraz wymogów prawa.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Przeznaczenie</h2>
        <p>
          Torebki a_bags.handmade są przeznaczone do przenoszenia typowych lekkich przedmiotów osobistych. Nie są sprzętem ochronnym, zabawką, wyposażeniem do przenoszenia dzieci ani produktem przeznaczonym do podnoszenia lub zabezpieczania ciężkich przedmiotów.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Zasady bezpiecznego użytkowania</h2>
        <ul>
          <li>Przed użyciem sprawdź stan uchwytów, pasków, zapięć i miejsc ich mocowania.</li>
          <li>Nie używaj produktu, jeżeli element konstrukcyjny jest rozerwany, pęknięty, odczepiony lub w inny sposób uszkodzony.</li>
          <li>Nie przeciążaj torebki. Ciężar i sposób użytkowania powinny być dostosowane do konstrukcji konkretnego modelu.</li>
          <li>Chroń produkt przed otwartym ogniem, źródłami bardzo wysokiej temperatury i zastosowaniami niezgodnymi z jego przeznaczeniem.</li>
          <li>Jeżeli dany model posiada odpinane lub drobne elementy dekoracyjne, przechowuj go poza zasięgiem małych dzieci, gdy istnieje ryzyko odłączenia takiego elementu.</li>
          <li>Pielęgnację prowadź zgodnie z informacją dołączoną do konkretnego modelu i właściwościami użytego materiału.</li>
        </ul>
        <p className={styles.notice}>
          Ta lista jest bazą ogólną. Przed sprzedażą każdego modelu producent musi uzupełnić ocenę o rzeczywiste materiały, konstrukcję, elementy metalowe/dekoracyjne i wyniki własnej analizy ryzyka.
        </p>
      </section>

      <section className={styles.section}>
        <h2>5. Dokumentacja techniczna i ocena ryzyka</h2>
        <p>
          Dla każdego modelu należy utrzymywać dokumentację pozwalającą wykazać bezpieczeństwo produktu. Powinna ona obejmować co najmniej identyfikację produktu, opis konstrukcji i materiałów, analizę możliwych zagrożeń, zastosowane środki ograniczające ryzyko, instrukcje lub ostrzeżenia, dane dostawców materiałów oraz sposób identyfikacji partii/egzemplarza.
        </p>
        <p>
          Dokumentacja powinna być przechowywana przez okres wymagany przepisami GPSR i udostępniana właściwym organom na żądanie.
        </p>
      </section>

      <section className={styles.section}>
        <h2>6. Zgłaszanie problemu z bezpieczeństwem</h2>
        <p>
          Jeżeli produkt spowodował zdarzenie, może stwarzać zagrożenie albo jego element konstrukcyjny uległ uszkodzeniu w sposób mogący zagrażać użytkownikowi, należy przerwać korzystanie z produktu i skontaktować się z producentem pod adresem <strong>{valueOrPending(config.manufacturer.email)}</strong>.
        </p>
        <p>
          W wiadomości warto podać nazwę modelu, numer zamówienia, kod produktu/partii, opis zdarzenia oraz — jeśli jest to bezpieczne — zdjęcia uszkodzenia. Informacje te pomagają ocenić, czy konieczne są działania naprawcze, ostrzeżenie klientów lub wycofanie produktu.
        </p>
      </section>

      <section className={styles.section}>
        <h2>7. CE</h2>
        <p>
          Zwykła torebka konsumencka nie otrzymuje oznakowania CE wyłącznie z tego powodu, że jest sprzedawana na rynku Unii Europejskiej. Oznaczenie CE stosuje się tylko do kategorii produktów objętych właściwymi przepisami wymagającymi tego oznaczenia.
        </p>
      </section>

      <section className={styles.section}>
        <h2>8. Wersja informacji</h2>
        <p>Ostatnia aktualizacja: 22 sierpnia 2026 r.</p>
      </section>
    </LegalShell>
  );
}
