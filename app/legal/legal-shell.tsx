import Link from "next/link";
import type { ReactNode } from "react";
import { getPublicLegalConfig } from "../../lib/legal-config";
import styles from "./legal.module.css";

type LegalShellProps = {
  eyebrow: string;
  title: string;
  lead: string;
  children: ReactNode;
};

function valueOrPending(value: string) {
  return value || "Do uzupełnienia przed uruchomieniem sprzedaży";
}

export default function LegalShell({ eyebrow, title, lead, children }: LegalShellProps) {
  const config = getPublicLegalConfig();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          a_bags.handmade
        </Link>
        <Link className={styles.back} href="/">
          ← Wróć do sklepu
        </Link>
      </header>

      <div className={styles.main}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>{lead}</p>

        <section
          className={`${styles.status} ${config.launchReady ? styles.statusReady : ""}`}
          aria-live="polite"
        >
          <strong>
            {config.launchReady
              ? "Dane formalne sklepu są skonfigurowane."
              : "Sprzedaż jest technicznie blokowana do czasu uzupełnienia wymaganych danych."}
          </strong>
          {!config.launchReady && (
            <>
              <p>
                Ta wersja dokumentów jest gotowa strukturalnie, ale nie może zastępować prawdziwych danych sprzedawcy i producenta.
              </p>
              <ul>
                {config.readinessIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={styles.identity} aria-label="Dane sprzedawcy">
          <p>
            <small>Sprzedawca</small>
            <strong>{valueOrPending(config.seller.legalName)}</strong>
          </p>
          <p>
            <small>Marka</small>
            <strong>{config.brand}</strong>
          </p>
          <p>
            <small>Adres</small>
            {valueOrPending(config.seller.address)}
          </p>
          <p>
            <small>E-mail</small>
            {valueOrPending(config.seller.email)}
          </p>
          <p>
            <small>Telefon</small>
            {valueOrPending(config.seller.phone)}
          </p>
          <p>
            <small>NIP</small>
            {config.businessMode === "unregistered"
              ? "Działalność nierejestrowana — pole NIP zależne od statusu podatkowego"
              : valueOrPending(config.seller.nip)}
          </p>
          {config.seller.regon && (
            <p>
              <small>REGON</small>
              {config.seller.regon}
            </p>
          )}
          <p>
            <small>Adres zwrotów i reklamacji</small>
            {valueOrPending(config.seller.returnsAddress)}
          </p>
        </section>

        <div className={styles.sections}>{children}</div>

        <footer className={styles.footer}>
          Dokumenty przygotowano dla polskiego sklepu internetowego B2C. Przed uruchomieniem sprzedaży wymagane jest uzupełnienie rzeczywistych danych przedsiębiorcy/sprzedawcy, potwierdzenie statusu VAT i dostosowanie opisów produktów do faktycznych materiałów oraz wyników oceny ryzyka GPSR.
        </footer>
      </div>
    </main>
  );
}

export { styles };
