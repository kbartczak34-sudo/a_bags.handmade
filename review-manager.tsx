"use client";

import { useEffect, useMemo, useState } from "react";

type ReviewStatus = "pending" | "approved" | "rejected";

type AdminReview = {
  id: string;
  authorName: string;
  content: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
};

type ReviewPayload = {
  error?: string;
  reviews?: AdminReview[];
};

const statusLabels: Record<ReviewStatus, string> = {
  pending: "Oczekuje",
  approved: "Opublikowana",
  rejected: "Odrzucona",
};

async function readReviewPayload(response: Response): Promise<ReviewPayload> {
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body) as ReviewPayload;
  } catch {
    throw new Error("Sklep zwrócił nieprawidłową odpowiedź.");
  }
}

export default function ReviewManager() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pendingCount = useMemo(
    () => reviews.filter((review) => review.status === "pending").length,
    [reviews],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/admin/reviews", { cache: "no-store" })
      .then(async (response) => {
        const data = await readReviewPayload(response);
        if (!response.ok) {
          throw new Error(data.error ?? "Nie udało się wczytać opinii.");
        }
        return data.reviews ?? [];
      })
      .then((items) => {
        if (active) setReviews(items);
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Nie udało się wczytać opinii.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const changeStatus = async (review: AdminReview, status: ReviewStatus) => {
    setWorkingId(review.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: review.id, status }),
      });
      const data = await readReviewPayload(response);
      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się zmienić opinii.");
      }
      setReviews(data.reviews ?? []);
      setMessage(
        status === "approved"
          ? "Opinia została opublikowana."
          : status === "rejected"
            ? "Opinia została odrzucona."
            : "Opinia została ukryta.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się zmienić opinii.",
      );
    } finally {
      setWorkingId("");
    }
  };

  const removeReview = async (review: AdminReview) => {
    if (!window.confirm(`Usunąć opinię od „${review.authorName}”?`)) return;
    setWorkingId(review.id);
    setMessage("");
    setError("");
    try {
      const response = await fetch(
        `/api/admin/reviews?id=${encodeURIComponent(review.id)}`,
        { method: "DELETE" },
      );
      const data = await readReviewPayload(response);
      if (!response.ok) {
        throw new Error(data.error ?? "Nie udało się usunąć opinii.");
      }
      setReviews(data.reviews ?? []);
      setMessage("Opinia została usunięta.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się usunąć opinii.",
      );
    } finally {
      setWorkingId("");
    }
  };

  return (
    <section className="admin-reviews" aria-labelledby="admin-reviews-title">
      <div className="admin-reviews-heading">
        <div>
          <p className="eyebrow">Opinie klientek</p>
          <h2 id="admin-reviews-title">Akceptuj i publikuj</h2>
          <p>
            Nowe opinie nie pojawią się w sklepie, dopóki ich nie zaakceptujesz.
          </p>
        </div>
        <span>{pendingCount} oczekuje</span>
      </div>

      {(message || error) && (
        <p
          className={`admin-message ${error ? "is-error" : "is-success"}`}
          role="status"
        >
          {error || message}
        </p>
      )}

      {loading ? (
        <p className="admin-review-state">Wczytywanie opinii…</p>
      ) : reviews.length === 0 ? (
        <p className="admin-review-state">
          Nie ma jeszcze żadnych przesłanych opinii.
        </p>
      ) : (
        <div className="admin-review-list">
          {reviews.map((review) => (
            <article className="admin-review-card" key={review.id}>
              <div className="admin-review-meta">
                <div>
                  <strong>{review.authorName}</strong>
                  <small>
                    {new Date(review.createdAt).toLocaleDateString("pl-PL")}
                  </small>
                </div>
                <span className={`review-status is-${review.status}`}>
                  {statusLabels[review.status]}
                </span>
              </div>
              <p>{review.content}</p>
              <div className="admin-review-actions">
                {review.status !== "approved" && (
                  <button
                    type="button"
                    disabled={workingId === review.id}
                    onClick={() => changeStatus(review, "approved")}
                  >
                    Opublikuj
                  </button>
                )}
                {review.status === "approved" && (
                  <button
                    type="button"
                    disabled={workingId === review.id}
                    onClick={() => changeStatus(review, "pending")}
                  >
                    Ukryj
                  </button>
                )}
                {review.status !== "rejected" && (
                  <button
                    className="is-secondary"
                    type="button"
                    disabled={workingId === review.id}
                    onClick={() => changeStatus(review, "rejected")}
                  >
                    Odrzuć
                  </button>
                )}
                <button
                  className="is-danger"
                  type="button"
                  disabled={workingId === review.id}
                  onClick={() => removeReview(review)}
                >
                  Usuń
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
