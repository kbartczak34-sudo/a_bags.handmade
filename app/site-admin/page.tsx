import { getChatGPTUser } from "../chatgpt-auth";
import { isAdminEmail } from "../../lib/admin-auth";
import AdminPanel from "../panel/admin-panel";

export const dynamic = "force-dynamic";

export default async function SiteAdminPage() {
  const user = await getChatGPTUser();

  if (!user) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
        <section style={{ maxWidth: 560, textAlign: "center" }}>
          <h1>Panel właścicielki</h1>
          <p>
            Dostęp do tej strony jest chroniony przez Cloudflare Access. Zaloguj się
            kontem właścicielki, aby przejść dalej.
          </p>
        </section>
      </main>
    );
  }

  if (!isAdminEmail(user.email)) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
        <section style={{ maxWidth: 560, textAlign: "center" }}>
          <h1>Brak dostępu</h1>
          <p>To konto nie ma uprawnień do panelu właścicielki.</p>
        </section>
      </main>
    );
  }

  return <AdminPanel ownerName={user.fullName ?? "Klaudia"} />;
}
