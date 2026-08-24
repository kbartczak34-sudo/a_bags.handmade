"use client";

import { FormEvent, useState } from "react";

type CaseType = "withdrawal" | "complaint";

type ApiPayload = {
  ok?: boolean;
  caseId?: string;
  responseDueAt?: string | null;
  confirmationEmailSent?: boolean;
  message?: string;
  error?: string;
};

const fieldStyle = {
  display: "grid",
  gap: ".45rem",
} as const;

const inputStyle = {
  width: "100%",
  border: "1px solid rgba(90, 66, 69, .24)",
  borderRadius: "14px",
  background: "#fffaf8",
  color: "#5a4245",
  padding: ".85rem 1rem",
  font: "inherit",
} as const;

export default function CaseForm() {
  const [type, setType] = useState<CaseType>("complaint");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<ApiPayload | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError("");
    setSuccess(null);

    try {
      const response = await fetch("/api/customer-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          customerName: String(data.get("customerName") ?? ""),
          email: String(data.get("email") ?? ""),
          orderReference: String(data.get("orderReference") ?? ""),
          productName: String(data.get("productName") ?? ""),
          description: String(data.get("description") ?? ""),
          requestedResolution: String(data.get("requestedResolution") ?? ""),
          website: String(data.get("website") ?? ""),
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Nie udało się wysłać zgłoszenia.");
      }
      setSuccess(payload);
      form.reset();
      setType("complaint");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się wysłać zgłoszenia.",
      );
    } finally {
      setPending(false);
    }
  }

  if (success?.caseId) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          border: "1px solid rgba(90, 66, 69, .18)",
          borderRadius: 18,
          padding: "1.25rem",
          background: "#fffaf8",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Zgłoszenie zostało zapisane</h3>
        <p>{success.message}</p>
        <p>
          Numer sprawy: <strong>{success.caseId}</strong>
        </p>
        {success.responseDueAt && (
          <p>
            Termin odpowiedzi zapisany w systemie:{" "}
            <strong>
              {new Date(success.responseDueAt).toLocaleDateString("pl-PL")}
            </strong>
          </p>
        )}
        <p style={{ marginBottom: 0 }}>
          {success.confirmationEmailSent
            ? "Potwierdzenie zgłoszenia zostało wysłane na podany adres e-mail."
            : "Zachowaj numer sprawy. Jeżeli nie otrzymasz potwierdzenia e-mail, możesz skontaktować się ze sklepem, podając ten numer."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{ display: "grid", gap: "1rem", maxWidth: 760 }}
    >
      <fieldset
        style={{
          border: "1px solid rgba(90, 66, 69, .16)",
          borderRadius: 18,
          padding: "1rem",
          display: "grid",
          gap: ".75rem",
        }}
      >
        <legend style={{ padding: "0 .4rem", fontWeight: 700 }}>
          Rodzaj zgłoszenia
        </legend>
        <label style={{ display: "flex", gap: ".65rem", alignItems: "flex-start" }}>
          <input
            type="radio"
            name="caseType"
            value="complaint"
            checked={type === "complaint"}
            onChange={() => setType("complaint")}
          />
          <span>
            <strong>Reklamacja</strong>
            <br />
            Produkt jest niezgodny z umową, uszkodzony albo występuje inny problem
            wymagający rozpatrzenia.
          </span>
        </label>
        <label style={{ display: "flex", gap: ".65rem", alignItems: "flex-start" }}>
          <input
            type="radio"
            name="caseType"
            value="withdrawal"
            checked={type === "withdrawal"}
            onChange={() => setType("withdrawal")}
          />
          <span>
            <strong>Odstąpienie od umowy</strong>
            <br />
            Chcesz złożyć jednoznaczne oświadczenie o odstąpieniu od umowy zawartej
            na odległość.
          </span>
        </label>
      </fieldset>

      <label style={fieldStyle}>
        <span>Imię i nazwisko / dane osoby zgłaszającej</span>
        <input
          style={inputStyle}
          name="customerName"
          autoComplete="name"
          minLength={2}
          maxLength={100}
          required
        />
      </label>

      <label style={fieldStyle}>
        <span>Adres e-mail do kontaktu</span>
        <input
          style={inputStyle}
          type="email"
          name="email"
          autoComplete="email"
          maxLength={254}
          required
        />
      </label>

      <label style={fieldStyle}>
        <span>Numer zamówienia, jeśli go znasz</span>
        <input
          style={inputStyle}
          name="orderReference"
          maxLength={120}
          placeholder="np. numer sesji / numer zamówienia"
        />
      </label>

      <label style={fieldStyle}>
        <span>Produkt, którego dotyczy zgłoszenie</span>
        <input
          style={inputStyle}
          name="productName"
          maxLength={120}
          placeholder="np. Torebka Rose"
        />
      </label>

      <label style={fieldStyle}>
        <span>
          {type === "complaint"
            ? "Opis problemu"
            : "Dodatkowe informacje (opcjonalnie)"}
        </span>
        <textarea
          style={{ ...inputStyle, resize: "vertical" }}
          name="description"
          minLength={type === "complaint" ? 20 : undefined}
          maxLength={3000}
          rows={7}
          required={type === "complaint"}
          placeholder={
            type === "complaint"
              ? "Opisz, na czym polega problem i kiedy został zauważony."
              : "Możesz doprecyzować, którego produktu lub zamówienia dotyczy odstąpienie."
          }
        />
        {type === "withdrawal" && (
          <small>
            Przy odstąpieniu wskaż przynajmniej numer zamówienia, produkt albo krótką
            informację pozwalającą zidentyfikować umowę.
          </small>
        )}
      </label>

      {type === "complaint" && (
        <label style={fieldStyle}>
          <span>Oczekiwane rozwiązanie</span>
          <select style={inputStyle} name="requestedResolution" required defaultValue="">
            <option value="" disabled>
              Wybierz
            </option>
            <option value="Naprawa">Naprawa</option>
            <option value="Wymiana">Wymiana</option>
            <option value="Obniżenie ceny">Obniżenie ceny</option>
            <option value="Odstąpienie od umowy">Odstąpienie od umowy</option>
            <option value="Inne / proszę o kontakt">Inne / proszę o kontakt</option>
          </select>
        </label>
      )}

      <label
        aria-hidden="true"
        style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}
      >
        Strona internetowa
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <p style={{ margin: 0, fontSize: ".9rem", lineHeight: 1.6 }}>
        Dane z formularza są używane do obsługi zgłoszenia. Nie wymagamy osobnej
        zgody na przetwarzanie danych niezbędnych do rozpatrzenia sprawy. Szczegóły
        znajdziesz w <a href="/polityka-prywatnosci">polityce prywatności</a>.
      </p>

      {error && (
        <p role="alert" style={{ margin: 0, color: "#8a2f3c", fontWeight: 700 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          minHeight: 50,
          border: 0,
          borderRadius: 999,
          padding: ".9rem 1.25rem",
          background: "#b87880",
          color: "white",
          font: "inherit",
          fontWeight: 700,
          cursor: pending ? "wait" : "pointer",
        }}
      >
        {pending ? "Wysyłanie zgłoszenia…" : "Wyślij zgłoszenie"}
      </button>
    </form>
  );
}
