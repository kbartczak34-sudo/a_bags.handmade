import type { Metadata } from "next";
import LegalShell, { styles } from "../legal/legal-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Polityka cookies | a_bags.handmade",
  description: "Informacje o cookies, localStorage i zewnętrznych treściach a_bags.handmade.",
};

export default function CookiesPage() {
  return (
    <LegalShell
      eyebrow="Prywatność urządzenia"
      title="Polityka cookies i pamięci lokalnej"
      lead="Opis informacji zapisywanych lub odczytywanych na urządzeniu podczas korzystania ze sklepu oraz zasad uruchamiania zewnętrznych treści."
    >
      <section className={styles.section}>
        <h2>1. Niezbędne mechanizmy sklepu</h2>
        <p>
          Sklep korzysta z pamięci lokalnej przeglądarki do zapamiętania zawartości koszyka pod kluczem <span className={styles.code}>abags-cart</span>. Informacja ta pozwala zachować koszyk między odsłonami i jest związana z funkcją wyraźnie żądaną przez użytkownika.
        </p>
        <p>
          Do zapamiętania wybranej metody płatności może być używane krótkotrwałe cookie <span className={styles.code}>abags-payment-method</span>. Cookie to służy przekazaniu wyboru BLIK/karta do procesu Stripe Checkout i nie jest używane do profilowania marketingowego.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Zewnętrzne treści — Instagram</h2>
        <p>
          Osadzone treści z Instagrama mogą powodować połączenie przeglądarki użytkownika z infrastrukturą Meta. Dlatego warstwa compliance sklepu traktuje Instagram jako zewnętrzną treść opcjonalną: jeżeli użytkownik nie zezwoli na jej załadowanie, powinien zobaczyć zwykły link prowadzący do profilu zamiast aktywnego embedu.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Analityka i marketing</h2>
        <p>
          Aktualna wersja sklepu nie powinna uruchamiać opcjonalnych trackerów marketingowych ani analitycznych przed uzyskaniem wymaganej zgody. Jeżeli w przyszłości zostaną dodane Google Analytics, Meta Pixel, TikTok Pixel, remarketing lub podobne technologie, lista dostawców, cele, okresy przechowywania i mechanizm zgody muszą zostać zaktualizowane przed ich uruchomieniem.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Zarządzanie wyborem</h2>
        <p>
          Użytkownik może korzystać z funkcji sklepu przy pozostawieniu wyłącznie mechanizmów niezbędnych. Zgoda na opcjonalne treści zewnętrzne może być później zmieniona przez „Ustawienia prywatności” dostępne w stopce sklepu.
        </p>
        <p>
          Niezależnie od ustawień sklepu można również usuwać cookies i dane witryny w ustawieniach przeglądarki. Usunięcie pamięci lokalnej może spowodować utratę zapisanej zawartości koszyka.
        </p>
      </section>

      <section className={styles.section}>
        <h2>5. Podstawa prawna</h2>
        <p>
          Zapis lub dostęp do informacji na urządzeniu końcowym odbywa się zgodnie z przepisami Prawa komunikacji elektronicznej. Mechanizmy konieczne do dostarczenia funkcji żądanej przez użytkownika są traktowane odmiennie od opcjonalnych technologii analitycznych, reklamowych i zewnętrznych treści, które wymagają odpowiedniej podstawy i — gdy przepisy tego wymagają — uprzedniej zgody.
        </p>
      </section>

      <section className={styles.section}>
        <h2>6. Wersja dokumentu</h2>
        <p>Ostatnia aktualizacja: 22 sierpnia 2026 r.</p>
      </section>
    </LegalShell>
  );
}
