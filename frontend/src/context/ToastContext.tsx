"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "info" | "error";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastInput {
  type?: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastContextValue {
  notify: (toast: ToastInput) => number;
  success: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_LIMIT = 4;
const DEFAULT_DURATION = 5000;

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function iconFor(type: ToastType) {
  if (type === "success") return <CheckIcon />;
  if (type === "error") return <ErrorIcon />;
  return <InfoIcon />;
}

function progressColorFor(type: ToastType) {
  if (type === "success") return "bg-emerald-500";
  if (type === "error") return "bg-red-500";
  return "bg-ps-blue";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    const toast: Toast = {
      id,
      type: input.type ?? "info",
      title: input.title,
      description: input.description,
    };

    setToasts((current) => [toast, ...current].slice(0, TOAST_LIMIT));

    const timer = setTimeout(() => dismiss(id), input.durationMs ?? DEFAULT_DURATION);
    timers.current.set(id, timer);
    return id;
  }, [dismiss]);

  const value = useMemo<ToastContextValue>(() => ({
    notify,
    success: (title, description) => notify({ type: "success", title, description }),
    info: (title, description) => notify({ type: "info", title, description }),
    error: (title, description) => notify({ type: "error", title, description }),
    dismiss,
  }), [dismiss, notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-16 z-[500] flex flex-col items-center gap-2 px-4 sm:top-20 sm:items-end"
        dir="rtl"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-item pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-lg border bg-white px-4 py-3 pb-4 text-right shadow-xl shadow-slate-900/10 ${
              toast.type === "success"
                ? "border-emerald-200"
                : toast.type === "error"
                  ? "border-red-200"
                  : "border-blue-200"
            }`}
            role={toast.type === "error" ? "alert" : "status"}
          >
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                toast.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : toast.type === "error"
                    ? "bg-red-50 text-red-600"
                    : "bg-blue-50 text-ps-blue"
              }`}
            >
              {iconFor(toast.type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-xs leading-5 text-gray-500">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ps-blue"
              aria-label="بستن اعلان"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gray-100" aria-hidden>
              <div className={`toast-progress h-full ${progressColorFor(toast.type)}`} />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
