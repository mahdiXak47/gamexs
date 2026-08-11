"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, extractApiError } from "@/lib/api";
import { toPersianDigits } from "@/lib/format";

type ReviewStatus = "pending" | "approved" | "rejected";

interface GameReview {
  id: number;
  game_id: number;
  rating: number;
  body: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  status?: ReviewStatus;
}

interface ReviewsResponse {
  approved_count: number;
  average_rating: number | null;
  reviews: GameReview[];
  current_user_review: GameReview | null;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 2.7 2.8 5.7 6.3.9-4.55 4.43 1.07 6.26L12 17.04 6.38 20l1.07-6.26L2.9 9.31l6.3-.9L12 2.7Z" />
    </svg>
  );
}

function RatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1" dir="ltr" role="radiogroup" aria-label="امتیاز شما">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          role="radio"
          aria-checked={value === rating}
          aria-label={`${rating} از ۵`}
          disabled={disabled}
          onClick={() => onChange(rating)}
          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue disabled:cursor-not-allowed disabled:opacity-50 ${
            rating <= value ? "text-ps-plus-gold" : "text-gray-300 hover:text-ps-plus-gold"
          }`}
        >
          <StarIcon filled={rating <= value} />
        </button>
      ))}
    </div>
  );
}

function RatingDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 text-ps-plus-gold" dir="ltr" aria-label={`${rating} از ۵`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} filled={star <= rating} />
      ))}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function statusText(status?: ReviewStatus) {
  if (status === "approved") return "منتشر شده";
  if (status === "rejected") return "نیازمند بازبینی";
  return "در انتظار تایید";
}

export default function GameReviewsSection({ gameId, gameTitle }: { gameId: number; gameTitle: string }) {
  const { user, openAuthModal } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/reviews/games/${gameId}/`);
      const payload = await res.json();
      if (!res.ok) {
        setError(extractApiError(payload));
        return;
      }
      setData(payload);
      if (payload.current_user_review) {
        setRating(payload.current_user_review.rating);
        setBody(payload.current_user_review.body);
      }
    } catch {
      setError("امکان دریافت دیدگاه‌ها وجود ندارد.");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews, user]);

  const averageLabel = useMemo(() => {
    if (data?.average_rating == null) return null;
    return toPersianDigits(data.average_rating.toFixed(1));
  }, [data?.average_rating]);

  async function submitReview() {
    if (!user) {
      toast.info("برای ثبت دیدگاه وارد شوید");
      openAuthModal();
      return;
    }
    if (rating < 1) {
      toast.error("امتیاز را انتخاب کنید");
      return;
    }
    if (!body.trim()) {
      toast.error("متن دیدگاه را وارد کنید");
      return;
    }

    setSaving(true);
    try {
      const res = await api.post(`/api/reviews/games/${gameId}/`, { rating, body });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(extractApiError(payload));
        return;
      }
      toast.success("دیدگاه ثبت شد", "پس از تایید نمایش داده می‌شود.");
      await loadReviews();
    } catch {
      toast.error("ثبت دیدگاه انجام نشد", "اتصال خود را بررسی کنید و دوباره تلاش کنید.");
    } finally {
      setSaving(false);
    }
  }

  const count = data?.approved_count ?? 0;
  const currentReview = data?.current_user_review ?? null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6" dir="rtl" aria-labelledby="game-reviews-heading">
      <div className="mb-6 flex items-center justify-end gap-4">
        <button
          type="button"
          className="min-h-11 rounded-lg bg-[#dfe5f6] px-7 py-2.5 text-sm font-extrabold text-gray-700"
          aria-pressed="false"
        >
          توضیحات
        </button>
        <button
          type="button"
          className="min-h-11 rounded-lg bg-[#ef0b25] px-7 py-2.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(239,11,37,0.22)]"
          aria-pressed="true"
        >
          نظرات ({toPersianDigits(count)})
        </button>
      </div>

      <div className="grid gap-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] lg:p-7">
        <div className="order-2 lg:order-1">
          <h2 id="game-reviews-heading" className="text-lg font-extrabold text-gray-900">
            دیدگاه‌ها
          </h2>
          {averageLabel && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <RatingDisplay rating={Math.round(data?.average_rating ?? 0)} />
              <span>میانگین امتیاز {averageLabel} از ۵</span>
            </div>
          )}

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="h-28 animate-pulse rounded-lg bg-gray-100" />
            ) : error ? (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p>
            ) : data?.reviews.length ? (
              data.reviews.map((review) => (
                <article key={review.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">{review.author_name}</p>
                      <p className="mt-1 text-xs text-gray-400">{formatDate(review.created_at)}</p>
                    </div>
                    <RatingDisplay rating={review.rating} />
                  </div>
                  <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-700">{review.body}</p>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                هیچ دیدگاهی برای این محصول نوشته نشده است.
              </p>
            )}
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-sm font-bold leading-7 text-gray-900">
            اولین نفری باشید که دیدگاهی برای خرید بازی {gameTitle} برای PS5 ارسال می‌کند.
          </p>
          <p className="mt-5 text-xs leading-6 text-gray-400">
            نشانی ایمیل شما منتشر نمی‌شود. دیدگاه‌ها قبل از نمایش بررسی می‌شوند.
          </p>

          {currentReview && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              وضعیت دیدگاه شما: {statusText(currentReview.status)}
            </div>
          )}

          {!user ? (
            <div className="mt-6 rounded-lg bg-[#f3f5ff] px-5 py-5 text-center">
              <p className="text-sm font-semibold text-gray-600">برای ثبت دیدگاه ابتدا وارد حساب خود شوید.</p>
              <button
                type="button"
                onClick={openAuthModal}
                className="mt-4 min-h-11 cursor-pointer rounded-lg bg-ps-blue px-6 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#1547b0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue focus-visible:ring-offset-2"
              >
                ورود برای ثبت دیدگاه
              </button>
            </div>
          ) : (
            <form
              className="mt-6 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void submitReview();
              }}
            >
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-800">
                  امتیاز شما <span className="text-[#ef0b25]">*</span>
                </label>
                <RatingInput value={rating} onChange={setRating} disabled={saving} />
              </div>

              <div>
                <label htmlFor="game-review-body" className="mb-2 block text-sm font-bold text-gray-800">
                  دیدگاه شما <span className="text-[#ef0b25]">*</span>
                </label>
                <textarea
                  id="game-review-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  disabled={saving}
                  rows={7}
                  maxLength={5000}
                  className="w-full resize-y rounded-lg border border-transparent bg-[#f1f3ff] px-4 py-3 text-sm leading-7 text-gray-900 outline-none transition focus:border-ps-blue focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="min-h-11 cursor-pointer rounded-lg bg-[#ef0b25] px-8 py-2.5 text-sm font-extrabold text-white shadow-[0_14px_26px_rgba(239,11,37,0.18)] transition hover:bg-[#d80921] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef0b25] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                {saving ? "در حال ثبت..." : "ثبت دیدگاه"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
