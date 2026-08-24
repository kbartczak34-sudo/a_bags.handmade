import type { Metadata } from "next";
import LegalShell, { styles } from "../../legal/legal-shell";
import CaseForm from "./case-form";

export const metadata: Metadata = {
  title: "Zgłoszenie zwrotu lub reklamacji | a_bags.handmade",
  description:
    "Formularz zgłoszenia odstąpienia od umowy lub reklamacji a_bags.handmade.",
};

export default function CustomerCasePage() {
  return (
    <LegalShell
      eyebrow="Obsługa po zakupie"
      title="Zgłoś zwrot lub reklamację"
      lead="Wyślij zgłoszenie online i zachowaj numer sprawy. Formularz nie zastępuje innych prawnie dopuszczalnych sposobów złożenia oświadczenia lub reklamacji."
    >
      <section className={styles.section}>
        <h2>Formularz zgłoszenia</h2>
        <p>
          Wybierz rodzaj sprawy i podaj informacje potrzebne do jej identyfikacji.
          Numer zamówienia jest pomocny, ale nie blokuje wysłania formularza, jeśli
          go nie znasz.
        </p>
        <CaseForm />
      </section>

      <section className={styles.section}>
        <h2>Inne sposoby kontaktu</h2>
        <p>
          Z formularza online nie musisz korzystać. Zgłoszenie możesz złożyć także
          w sposób opisany na stronie <a href="/zwroty-i-reklamacje">Zwroty i reklamacje</a>.
        </p>
      </section>
    </LegalShell>
  );
}
