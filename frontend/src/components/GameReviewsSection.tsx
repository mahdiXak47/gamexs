"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  hasError,
  describedBy,
  groupRef,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  hasError?: boolean;
  describedBy?: string;
  groupRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={groupRef}
      className="flex items-center gap-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue"
      dir="ltr"
      role="radiogroup"
      aria-label="امتیاز شما"
      aria-invalid={hasError}
      aria-describedby={describedBy}
      tabIndex={-1}
    >
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

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-2 text-xs font-bold text-red-600">{message}</p>;
}

export default function GameReviewsSection({
  gameId,
  gameTitle,
  description,
}: {
  gameId: number;
  gameTitle: string;
  description?: string | null;
}) {
  const { user, openAuthModal } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<"description" | "reviews">("reviews");
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{ rating?: string; body?: string }>({});
  const ratingRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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
    void Promise.resolve().then(loadReviews);
  }, [loadReviews, user]);

  const averageLabel = data?.average_rating == null ? null : toPersianDigits(data.average_rating.toFixed(1));

  async function submitReview() {
    if (!user) {
      toast.info("برای ثبت دیدگاه وارد شوید");
      openAuthModal();
      return;
    }
    const nextErrors: { rating?: string; body?: string } = {};
    if (rating < 1) nextErrors.rating = "امتیاز را انتخاب کنید.";
    if (!body.trim()) nextErrors.body = "متن دیدگاه را وارد کنید.";
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      if (nextErrors.rating) ratingRef.current?.focus();
      else bodyRef.current?.focus();
      toast.error("دیدگاه ثبت نشد", "موارد مشخص‌شده را اصلاح کنید.");
      return;
    }
    setFormErrors({});

    setSaving(true);
    try {
      const res = await api.post(`/api/reviews/games/${gameId}/`, { rating, body });
      const payload = await res.json();
      if (!res.ok) {
        const message = extractApiError(payload);
        setFormErrors({ body: message });
        bodyRef.current?.focus();
        toast.error("دیدگاه ثبت نشد", message);
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
      <div className="mb-6 flex items-center justify-end gap-4" dir="ltr">
        <button
          type="button"
          onClick={() => setTab("description")}
          aria-pressed={tab === "description"}
          className={`min-h-11 cursor-pointer rounded-lg px-7 py-2.5 text-sm font-extrabold ${
            tab === "description"
              ? "bg-ps-blue text-white shadow-[0_12px_28px_rgba(0,48,135,0.22)] ring-1 ring-ps-blue/10"
              : "bg-blue-50 text-ps-blue ring-1 ring-blue-100"
          }`}
          dir="rtl"
        >
          توضیحات
        </button>
        <button
          type="button"
          onClick={() => setTab("reviews")}
          aria-pressed={tab === "reviews"}
          className={`min-h-11 cursor-pointer rounded-lg px-7 py-2.5 text-sm font-extrabold ${
            tab === "reviews"
              ? "bg-ps-blue text-white shadow-[0_12px_28px_rgba(0,48,135,0.22)] ring-1 ring-ps-blue/10"
              : "bg-blue-50 text-ps-blue ring-1 ring-blue-100"
          }`}
          dir="rtl"
        >
          نظرات ({toPersianDigits(count)})
        </button>
      </div>

      <div className="grid gap-6 rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] lg:p-7">
        {tab === "description" ? (
          <div className="ui-fade-panel col-span-2">
            {description ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-4">
                <h2 className="mb-4 text-lg font-extrabold text-gray-900">توضیحات بازی</h2>
                <p className="whitespace-pre-line text-sm leading-7 text-gray-700">{description}</p>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                توضیحاتی برای این بازی در دسترس نیست.
              </p>
            )}
          </div>
        ) : (
          <div className="order-2 lg:order-1 ui-fade-panel">
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
              <div className="rounded-lg bg-red-50 px-4 py-4 text-sm text-red-700">
                <p className="font-semibold">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadReviews()}
                  className="mt-3 cursor-pointer rounded-lg bg-white px-4 py-2 text-xs font-extrabold text-red-600 ring-1 ring-red-100 transition hover:bg-red-100"
                >
                  تلاش دوباره
                </button>
              </div>
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
        )}

        {tab === "reviews" && (
        <div className="order-1 lg:order-2 ui-fade-panel">
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
                <RatingInput
                  value={rating}
                  onChange={(nextRating) => {
                    setRating(nextRating);
                    setFormErrors((current) => ({ ...current, rating: undefined }));
                  }}
                  disabled={saving}
                  hasError={!!formErrors.rating}
                  describedBy="review-rating-error"
                  groupRef={ratingRef}
                />
                <FieldError id="review-rating-error" message={formErrors.rating} />
              </div>

              <div>
                <label htmlFor="game-review-body" className="mb-2 block text-sm font-bold text-gray-800">
                  دیدگاه شما <span className="text-[#ef0b25]">*</span>
                </label>
                <textarea
                  id="game-review-body"
                  ref={bodyRef}
                  value={body}
                  onChange={(event) => {
                    setBody(event.target.value);
                    setFormErrors((current) => ({ ...current, body: undefined }));
                  }}
                  disabled={saving}
                  rows={7}
                  maxLength={5000}
                  aria-invalid={!!formErrors.body}
                  aria-describedby="review-body-error review-body-count"
                  className={`w-full resize-y rounded-lg border bg-[#f1f3ff] px-4 py-3 text-sm leading-7 text-gray-900 outline-none transition focus:border-ps-blue focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60 ${
                    formErrors.body ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-transparent"
                  }`}
                />
                <div className="mt-1 flex items-center justify-between gap-3">
                  <FieldError id="review-body-error" message={formErrors.body} />
                  <p id="review-body-count" className="mr-auto text-xs text-gray-400">
                    {toPersianDigits(body.length)} / {toPersianDigits(5000)}
                  </p>
                </div>
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
        )}
      </div>
    </section>
  );
}
