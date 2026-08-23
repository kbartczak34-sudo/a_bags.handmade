import { cookies } from "next/headers";

const PRIVACY_COOKIE = "abags-external-content";

export default async function PrivacyConsentBanner() {
  const cookieStore = await cookies();
  const storedChoice = cookieStore.get(PRIVACY_COOKIE)?.value;

  if (storedChoice === "accepted" || storedChoice === "rejected") {
    return null;
  }

  return (
    <aside
      className="privacy-banner privacy-banner-server"
      data-server-privacy-banner="true"
      role="dialog"
      aria-label="Ustawienia prywatności"
    >
      <strong>Prywatność i treści zewnętrzne</strong>
      <p>
        Koszyk i wybór płatności korzystają z mechanizmów niezbędnych do działania sklepu.
        Osadzone treści z Instagrama są opcjonalne i mogą łączyć się z serwisem Meta.
        Szczegóły: <a href="/cookies">polityka cookies</a>.
      </p>
      <form className="privacy-actions" method="post" action="/api/privacy-choice">
        <button type="submit" name="choice" value="essential">
          Tylko niezbędne
        </button>
        <button type="submit" name="choice" value="external">
          Zezwól na Instagram
        </button>
      </form>
    </aside>
  );
}
