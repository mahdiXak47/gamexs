"use client"

import React, { useCallback, useEffect, useState } from 'react'
import Image from '@/components/RemoteImage'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { api, extractApiError } from '@/lib/api'
import { formatToman, toPersianDigits } from '@/lib/format'
import Header from '@/components/Header'

// ─── Types ──────────────────────────────────────────────────────────────────

type Section = 'orders' | 'wishlist' | 'psn' | 'tickets' | 'security'

interface Order {
  id: number
  game_id: number
  game_title?: string
  product_type: string
  tier?: string | null
  price_toman: number
  status: string
  created_at: string
}

interface WishlistItem {
  id: number
  game_id: number
  game_title: string
  game_slug: string
  cover_url: string | null
  target_price_toman?: number | null
  added_at: string
}

interface PsnAccount {
  id: number
  nickname: string
  psn_id: string
  region: string
  added_at: string
}

interface Ticket {
  id: number
  subject: string
  category: string
  status: string
  created_at: string
}

// ─── Label maps ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending:    { label: 'در انتظار تایید',  cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  confirmed:  { label: 'تایید شده',        cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  processing: { label: 'در حال پردازش',    cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  delivered:  { label: 'تحویل داده شده',   cls: 'text-green-700 bg-green-50 border-green-200' },
  cancelled:  { label: 'لغو شده',          cls: 'text-red-600 bg-red-50 border-red-200' },
  refunded:   { label: 'مسترد شده',        cls: 'text-gray-500 bg-gray-50 border-gray-200' },
}

const TICKET_STATUS: Record<string, { label: string; cls: string }> = {
  open:          { label: 'باز',              cls: 'text-blue-700 bg-blue-50 border-blue-200' },
  in_progress:   { label: 'در حال بررسی',     cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  waiting_user:  { label: 'منتظر پاسخ شما',  cls: 'text-purple-700 bg-purple-50 border-purple-200' },
  resolved:      { label: 'حل شده',           cls: 'text-green-700 bg-green-50 border-green-200' },
  closed:        { label: 'بسته',             cls: 'text-gray-500 bg-gray-50 border-gray-200' },
}

const PRODUCT_MAP: Record<string, string> = {
  'ACCOUNT_GAME:CAPACITY_1': 'اکانت ظرفیت ۱',
  'ACCOUNT_GAME:CAPACITY_2': 'اکانت ظرفیت ۲',
  'ACCOUNT_GAME:CAPACITY_3': 'اکانت ظرفیت ۳',
  DISC:             'نسخه فیزیکی',
  OWN_ACCOUNT_GAME: 'خرید برای اکانت شما',
}

const REGION_MAP: Record<string, string> = {
  NA: 'امریکای شمالی', EU: 'اروپا', IR: 'ایران', AS: 'آسیا',
}

function productLabel(type: string, tier?: string | null) {
  return tier ? (PRODUCT_MAP[`${type}:${tier}`] ?? type) : (PRODUCT_MAP[type] ?? type)
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso))
  } catch { return iso }
}

function initials(first: string, last: string, phone: string) {
  if (first && last) return `${first[0]}${last[0]}`
  if (first) return first[0]
  return phone.slice(-2)
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

const Icons = {
  orders: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  wishlist: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  psn: () => (
    <svg width="18" height="18" viewBox="0 0 32 22" fill="currentColor" aria-hidden>
      <path d="M11.6 0v16.8l4 1.3V4.1c0-.7.3-1.2.8-1 .6.2.9.8.9 1.5v11.6l4 1.3V4.4C21.3 1.4 19.4 0 17 0c-1.6 0-3.5.7-5.4 0zM20.8 13.8v3.3l6.4-2.1c.7-.2.8-.5.3-.7l-2.7-.9c-.5-.2-1.3-.1-2 .1l-2 .3zM0 17.3l5.8 2c2 .7 4.2.5 5.8-.5V15l-4.2 1.4c-.6.2-1.2.2-1.6 0L4 15.7c-.5-.2-.4-.5.1-.7l1.7-.6V11l-5.8 2v4.3z" />
    </svg>
  ),
  tickets: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  security: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  support: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  ),
  logout: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  game: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M12 12h.01M7 12h2m-1-1v2M17 11h-2" />
    </svg>
  ),
  empty: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
    </svg>
  ),
}

// ─── Sidebar nav config ──────────────────────────────────────────────────────

const NAV_MAIN: { id: Section; label: string; Icon: () => React.ReactElement }[] = [
  { id: 'orders',   label: 'سفارشات من',    Icon: Icons.orders },
  { id: 'wishlist', label: 'علاقه‌مندی‌ها',    Icon: Icons.wishlist },
  { id: 'psn',      label: 'اکانت PSN',    Icon: Icons.psn },
  { id: 'tickets',  label: 'تیکت‌های پشتیبانی', Icon: Icons.tickets },
  { id: 'security', label: 'تنظیمات حساب کاربری', Icon: Icons.security },
]

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
}

type LoadState = 'loading' | 'ready' | 'error'

function SectionError({
  title = 'بارگذاری انجام نشد',
  message,
  onRetry,
  retrying = false,
}: {
  title?: string
  message: string
  onRetry: () => void
  retrying?: boolean
}) {
  return (
    <div className="bg-white border border-red-100 rounded-2xl flex flex-col items-center justify-center gap-4 flex-1 min-h-64 px-5 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-500" aria-hidden>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 7v6M12 17h.01" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800">{title}</p>
        <p className="mt-1 text-xs leading-6 text-gray-500">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-[#003087] px-4 text-xs font-bold text-white transition-opacity disabled:cursor-wait disabled:opacity-60"
      >
        {retrying ? 'در حال تلاش...' : 'تلاش دوباره'}
      </button>
    </div>
  )
}

function SectionRefreshing({ label = 'در حال به‌روزرسانی' }: { label?: string }) {
  return (
    <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#003087]" role="status" aria-live="polite">
      <span className="h-3 w-3 rounded-full border-2 border-[#003087]/25 border-t-[#003087] animate-spin" aria-hidden />
      {label}
    </div>
  )
}

function SectionErrorBanner({
  message,
  onRetry,
  retrying = false,
}: {
  message: string
  onRetry: () => void
  retrying?: boolean
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="cursor-pointer font-bold text-amber-900 underline-offset-4 hover:underline disabled:cursor-wait disabled:opacity-60"
      >
        {retrying ? 'در حال تلاش...' : 'تلاش دوباره'}
      </button>
    </div>
  )
}

// ─── Order card ──────────────────────────────────────────────────────────────

function OrderCard({ order }: { order: Order }) {
  const status = STATUS_MAP[order.status] ?? { label: order.status, cls: 'text-gray-500 bg-gray-50 border-gray-200' }
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-gray-100">
        <div>
          <p className="font-bold text-gray-900 text-sm">
            سفارش شماره: <span className="price-figure">{toPersianDigits(order.id)}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">{formatDate(order.created_at)}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${status.cls}`}>
          {status.label}
        </span>
      </div>

      {/* Game info */}
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#003087]/10 to-[#0050b3]/10 flex items-center justify-center text-[#003087] shrink-0">
          <Icons.game />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {order.game_title ?? `بازی شناسه ${toPersianDigits(order.game_id)}`}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{productLabel(order.product_type, order.tier)}</p>
        </div>
        <div className="shrink-0 text-left">
          <p className="text-sm font-bold text-gray-900 price-figure">{formatToman(order.price_toman)}</p>
          <p className="text-xs text-gray-400 mt-0.5">تومان</p>
        </div>
      </div>
    </div>
  )
}

// ─── Section: Orders ─────────────────────────────────────────────────────────

function OrdersSection() {
  const [tab, setTab] = useState<'current' | 'all'>('current')
  const [orders, setOrders] = useState<Order[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    try {
      const res = await api.get('/api/orders/')
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(extractApiError(data))
      }
      setOrders(data?.results ?? data ?? [])
      setLoadState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در اتصال به سرور')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadOrders)
  }, [loadOrders])

  const ACTIVE = new Set(['pending', 'confirmed', 'processing'])
  const filtered = tab === 'current' ? orders.filter(o => ACTIVE.has(o.status)) : orders
  const loading = loadState === 'loading'
  const failed = loadState === 'error'

  return (
    <div className="flex flex-col flex-1">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {([['current', 'جاری'], ['all', 'همه سفارشات']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              'px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer',
              tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {failed && orders.length > 0 && error && (
        <SectionErrorBanner message={error} onRetry={loadOrders} retrying={loading} />
      )}

      {loading && orders.length > 0 && <SectionRefreshing />}

      {loading && orders.length === 0 ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
              <div className="flex gap-4 pt-2">
                <Skeleton className="w-14 h-14 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : failed && orders.length === 0 ? (
        <SectionError message={error ?? 'امکان دریافت سفارش‌ها وجود ندارد.'} onRetry={loadOrders} retrying={loading} />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-4 flex-1 min-h-64 text-center">
          <Icons.empty />
          <p className="text-sm text-gray-500">
            {tab === 'current' ? 'سفارش فعالی وجود ندارد' : 'هنوز سفارشی ثبت نشده'}
          </p>
          <Link href="/" className="text-sm text-[#003087] font-semibold hover:underline cursor-pointer">
            مشاهده بازی‌ها
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(order => <OrderCard key={order.id} order={order} />)}
        </div>
      )}
    </div>
  )
}

// ─── Section: Wishlist ───────────────────────────────────────────────────────

function WishlistSection() {
  const toast = useToast()
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadWishlist = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    try {
      const res = await api.get('/api/wishlist/')
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(extractApiError(data))
      }
      setItems(data?.results ?? data ?? [])
      setLoadState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در اتصال به سرور')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadWishlist)
  }, [loadWishlist])

  async function removeItem(id: number) {
    if (deletingId !== null) return
    setDeletingId(id)
    try {
      const res = await api.delete(`/api/wishlist/${id}/`)
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== id))
        toast.success('از علاقه‌مندی‌ها حذف شد')
        return
      }

      const data = await res.json()
      toast.error('حذف انجام نشد', extractApiError(data))
    } catch {
      toast.error('حذف انجام نشد', 'خطا در اتصال به سرور')
    } finally {
      setDeletingId(null)
    }
  }

  const loading = loadState === 'loading'
  const failed = loadState === 'error'

  if (loading && items.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex-1">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
      </div>
    </div>
  )

  if (failed && items.length === 0) return (
    <SectionError message={error ?? 'امکان دریافت علاقه‌مندی‌ها وجود ندارد.'} onRetry={loadWishlist} retrying={loading} />
  )

  if (items.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-4 flex-1 min-h-64 text-center">
      <Icons.empty />
      <p className="text-sm text-gray-500">علاقه‌مندی‌ها خالی است</p>
      <Link href="/" className="text-sm text-[#003087] font-semibold hover:underline cursor-pointer">افزودن بازی</Link>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex-1">
    {failed && error && (
      <SectionErrorBanner message={error} onRetry={loadWishlist} retrying={loading} />
    )}
    {loading && items.length > 0 && <SectionRefreshing />}
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {items.map(item => {
        const s3Base = 'https://gs3.gamexs.ir/gamexs'
        const cover = item.cover_url?.includes('gs3.gamexs.ir')
          ? item.cover_url.replace(/^http:\/\//, 'https://')
          : item.game_slug
            ? `${s3Base}/covers/${item.game_slug}-main-cover.webp`
            : null
        const initial = item.game_title?.trim().split(/\s+/)[0]?.[0]?.toUpperCase() ?? '?'
        const deleting = deletingId === item.id
        return (
          <div key={item.id} className="relative group">
            <Link href={item.game_slug ? `/games/${item.game_slug}` : '#'} className={`block ${deleting ? 'pointer-events-none opacity-60' : ''}`} aria-disabled={deleting}>
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
                {cover ? (
                  <Image
                    src={cover}
                    alt={item.game_title}
                    fill
                    sizes="(max-width: 640px) 50vw, 160px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-300 bg-gradient-to-br from-gray-100 to-gray-200">
                    {initial}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
              <p className="mt-2 text-xs font-semibold text-gray-800 text-center line-clamp-2 leading-snug px-1">
                {item.game_title}
              </p>
            </Link>
            <button
              onClick={() => removeItem(item.id)}
              disabled={deletingId !== null}
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-red-500 transition-colors duration-150 opacity-0 group-hover:opacity-100 cursor-pointer disabled:cursor-wait disabled:opacity-100"
              aria-label={deleting ? 'در حال حذف از علاقه‌مندی‌ها' : 'حذف از علاقه‌مندی‌ها'}
            >
              {deleting ? (
                <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        )
      })}
    </div>
    </div>
  )
}

// ─── Section: PSN Accounts ───────────────────────────────────────────────────

function PsnSection() {
  const [accounts, setAccounts] = useState<PsnAccount[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    try {
      const res = await api.get('/api/game-accounts/psn/')
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(extractApiError(data))
      }
      setAccounts(data?.results ?? data ?? [])
      setLoadState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در اتصال به سرور')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadAccounts)
  }, [loadAccounts])

  const loading = loadState === 'loading'
  const failed = loadState === 'error'

  if (loading && accounts.length === 0) return <div className="flex flex-col gap-3">{[1,2].map(i => <Skeleton key={i} className="h-20" />)}</div>

  if (failed && accounts.length === 0) return (
    <SectionError message={error ?? 'امکان دریافت اکانت‌های PSN وجود ندارد.'} onRetry={loadAccounts} retrying={loading} />
  )

  if (accounts.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-4 flex-1 min-h-64 text-center">
      <div className="w-12 h-12 flex items-center justify-center text-gray-300"><Icons.psn /></div>
      <p className="text-sm text-gray-500">اکانت PSN اضافه نشده</p>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {failed && error && (
        <div className="p-4 pb-0">
          <SectionErrorBanner message={error} onRetry={loadAccounts} retrying={loading} />
        </div>
      )}
      {loading && accounts.length > 0 && (
        <div className="px-4 pt-4">
          <SectionRefreshing />
        </div>
      )}
      <ul className="divide-y divide-gray-50">
        {accounts.map(acc => (
          <li key={acc.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#003087]/8 flex items-center justify-center text-[#003087] shrink-0">
                <Icons.psn />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{acc.nickname}</p>
                <p className="text-xs text-gray-400 mt-0.5" dir="ltr">{acc.psn_id}</p>
              </div>
            </div>
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              {REGION_MAP[acc.region] ?? acc.region}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Section: Tickets ────────────────────────────────────────────────────────

function TicketsSection() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)

  const loadTickets = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    try {
      const res = await api.get('/api/tickets/')
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(extractApiError(data))
      }
      setTickets(data?.results ?? data ?? [])
      setLoadState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در اتصال به سرور')
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadTickets)
  }, [loadTickets])

  const loading = loadState === 'loading'
  const failed = loadState === 'error'

  if (loading && tickets.length === 0) return <div className="flex flex-col gap-3">{[1,2].map(i => <Skeleton key={i} className="h-16" />)}</div>

  if (failed && tickets.length === 0) return (
    <SectionError message={error ?? 'امکان دریافت تیکت‌ها وجود ندارد.'} onRetry={loadTickets} retrying={loading} />
  )

  if (tickets.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-4 flex-1 min-h-64 text-center">
      <div className="w-12 h-12 flex items-center justify-center text-gray-300"><Icons.tickets /></div>
      <p className="text-sm text-gray-500">تیکتی وجود ندارد</p>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {failed && error && (
        <div className="p-4 pb-0">
          <SectionErrorBanner message={error} onRetry={loadTickets} retrying={loading} />
        </div>
      )}
      {loading && tickets.length > 0 && (
        <div className="px-4 pt-4">
          <SectionRefreshing />
        </div>
      )}
      <ul className="divide-y divide-gray-50">
        {tickets.map(t => {
          const s = TICKET_STATUS[t.status] ?? { label: t.status, cls: 'text-gray-500 bg-gray-50 border-gray-200' }
          return (
            <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{t.subject}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.created_at)}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${s.cls}`}>
                {s.label}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Section: Account Settings ───────────────────────────────────────────────

const INPUT_CLS = 'w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#003087]/20 focus:border-[#003087] transition-colors duration-150'
const INPUT_RO_CLS = 'w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-100 bg-gray-50 text-gray-400 cursor-default select-all'

function FeedbackMsg({ msg }: { msg: { type: 'ok' | 'err'; text: string } }) {
  return (
    <p className={`text-xs font-medium px-3 py-2 rounded-xl ${msg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
      {msg.text}
    </p>
  )
}

function SecuritySection() {
  const { user, refreshUser } = useAuth()
  const toast = useToast()

  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName,  setLastName]  = useState(user?.last_name  ?? '')
  const [email,     setEmail]     = useState(user?.email      ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [oldPass,     setOldPass]     = useState('')
  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passSaving,  setPassSaving]  = useState(false)
  const [passMsg,     setPassMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Forgot-password sub-flow: 'idle' | 'sent' (OTP sent, awaiting code)
  const [forgotMode,   setForgotMode]   = useState<'idle' | 'sent'>('idle')
  const [forgotOtp,    setForgotOtp]    = useState('')
  const [forgotNew,    setForgotNew]    = useState('')
  const [forgotConfirm,setForgotConfirm]= useState('')
  const [forgotSaving, setForgotSaving] = useState(false)
  const [forgotMsg,    setForgotMsg]    = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      const res = await api.patch('/api/profile/', { first_name: firstName, last_name: lastName, email })
      if (res.ok) {
        await refreshUser()
        setProfileMsg({ type: 'ok', text: 'اطلاعات با موفقیت ذخیره شد.' })
        toast.success('اطلاعات حساب ذخیره شد')
      } else {
        const d = await res.json()
        const message = extractApiError(d)
        setProfileMsg({ type: 'err', text: message })
        toast.error('ذخیره اطلاعات انجام نشد', message)
      }
    } catch {
      const message = 'خطا در اتصال به سرور'
      setProfileMsg({ type: 'err', text: message })
      toast.error('ذخیره اطلاعات انجام نشد', message)
    } finally {
      setProfileSaving(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confirmPass) {
      const message = 'رمز جدید و تکرار آن یکسان نیستند.'
      setPassMsg({ type: 'err', text: message })
      toast.error('رمز عبور تغییر نکرد', message)
      return
    }
    setPassSaving(true)
    setPassMsg(null)
    try {
      const res = await api.post('/api/auth/change-password/', { old_password: oldPass, new_password: newPass })
      if (res.ok) {
        setOldPass(''); setNewPass(''); setConfirmPass('')
        setPassMsg({ type: 'ok', text: 'رمز عبور با موفقیت تغییر یافت.' })
        toast.success('رمز عبور تغییر کرد')
      } else {
        const d = await res.json()
        const message = extractApiError(d)
        setPassMsg({ type: 'err', text: message })
        toast.error('رمز عبور تغییر نکرد', message)
      }
    } catch {
      const message = 'خطا در اتصال به سرور'
      setPassMsg({ type: 'err', text: message })
      toast.error('رمز عبور تغییر نکرد', message)
    } finally {
      setPassSaving(false)
    }
  }

  async function sendForgotOtp() {
    setForgotSaving(true)
    setForgotMsg(null)
    try {
      const res = await api.post('/api/auth/forgot-password/', {})
      if (res.ok) {
        setForgotMode('sent')
        setForgotMsg({ type: 'ok', text: `کد تایید به شماره ${user?.phone_number} ارسال شد.` })
        toast.info('کد بازیابی ارسال شد', 'کد پیامک‌شده را وارد کنید.')
      } else {
        const d = await res.json()
        const message = extractApiError(d)
        setForgotMsg({ type: 'err', text: message })
        toast.error('کد بازیابی ارسال نشد', message)
      }
    } catch {
      const message = 'خطا در اتصال به سرور'
      setForgotMsg({ type: 'err', text: message })
      toast.error('کد بازیابی ارسال نشد', message)
    } finally {
      setForgotSaving(false)
    }
  }

  async function resetWithOtp(e: React.FormEvent) {
    e.preventDefault()
    if (forgotNew !== forgotConfirm) {
      const message = 'رمز جدید و تکرار آن یکسان نیستند.'
      setForgotMsg({ type: 'err', text: message })
      toast.error('رمز عبور بازیابی نشد', message)
      return
    }
    setForgotSaving(true)
    setForgotMsg(null)
    try {
      const res = await api.post('/api/auth/forgot-password/verify/', { code: forgotOtp, new_password: forgotNew })
      if (res.ok) {
        setForgotOtp(''); setForgotNew(''); setForgotConfirm('')
        setForgotMode('idle')
        setPassMsg({ type: 'ok', text: 'رمز عبور با موفقیت بازیابی و تغییر یافت.' })
        toast.success('رمز عبور بازیابی شد')
      } else {
        const d = await res.json()
        const message = extractApiError(d)
        setForgotMsg({ type: 'err', text: message })
        toast.error('رمز عبور بازیابی نشد', message)
      }
    } catch {
      const message = 'خطا در اتصال به سرور'
      setForgotMsg({ type: 'err', text: message })
      toast.error('رمز عبور بازیابی نشد', message)
    } finally {
      setForgotSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 flex-1">

      {/* ── Personal info ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-[#003087]/8 flex items-center justify-center text-[#003087]"><Icons.security /></span>
          اطلاعات شخصی
        </h3>
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">نام</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="نام"
                className={INPUT_CLS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">نام خانوادگی</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="نام خانوادگی"
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-500">ایمیل</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                className={INPUT_CLS}
                dir="ltr"
              />
              {user?.is_email_verified && (
                <span className="absolute top-1/2 -translate-y-1/2 left-3 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                  تایید شده
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">شماره موبایل</label>
              <div className={INPUT_RO_CLS} dir="ltr">{user?.phone_number}</div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">وضعیت تایید شماره</label>
              <div className={INPUT_RO_CLS}>
                <span className={`text-xs font-semibold ${user?.is_phone_verified ? 'text-green-600' : 'text-amber-600'}`}>
                  {user?.is_phone_verified ? 'تایید شده' : 'تایید نشده'}
                </span>
              </div>
            </div>
          </div>

          {profileMsg && <FeedbackMsg msg={profileMsg} />}

          <div className="flex justify-start">
            <button
              type="submit"
              disabled={profileSaving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 cursor-pointer transition-opacity"
              style={{ background: 'linear-gradient(135deg, #003087 0%, #0050b3 100%)' }}
            >
              {profileSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Change password ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-[#003087]/8 flex items-center justify-center text-[#003087]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          تغییر رمز عبور
        </h3>

        {forgotMode === 'idle' ? (
          <form onSubmit={changePassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500">رمز عبور فعلی</label>
                <button
                  type="button"
                  onClick={sendForgotOtp}
                  disabled={forgotSaving}
                  className="text-xs text-[#003087] hover:underline cursor-pointer disabled:opacity-50"
                >
                  {forgotSaving ? 'در حال ارسال...' : 'رمز عبور خود را فراموش کردم'}
                </button>
              </div>
              <input
                type="password"
                value={oldPass}
                onChange={e => setOldPass(e.target.value)}
                placeholder="رمز عبور فعلی را وارد کنید"
                className={INPUT_CLS}
                dir="ltr"
                autoComplete="current-password"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">رمز عبور جدید</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="حداقل ۸ کاراکتر"
                  className={INPUT_CLS}
                  dir="ltr"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">تکرار رمز جدید</label>
                <input
                  type="password"
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  placeholder="رمز جدید را تکرار کنید"
                  className={INPUT_CLS}
                  dir="ltr"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {passMsg && <FeedbackMsg msg={passMsg} />}
            {forgotMsg && <FeedbackMsg msg={forgotMsg} />}

            <div className="flex justify-start">
              <button
                type="submit"
                disabled={passSaving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 cursor-pointer transition-opacity"
                style={{ background: 'linear-gradient(135deg, #003087 0%, #0050b3 100%)' }}
              >
                {passSaving ? 'در حال تغییر...' : 'تغییر رمز عبور'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={resetWithOtp} className="flex flex-col gap-4">
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              کد تایید به شماره <span className="font-semibold text-[#003087]" dir="ltr">{user?.phone_number}</span> ارسال شد. کد را وارد کرده و رمز جدید تعیین کنید.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">کد تایید</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={forgotOtp}
                onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="کد ۶ رقمی"
                className={INPUT_CLS}
                dir="ltr"
                autoComplete="one-time-code"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">رمز عبور جدید</label>
                <input
                  type="password"
                  value={forgotNew}
                  onChange={e => setForgotNew(e.target.value)}
                  placeholder="حداقل ۸ کاراکتر"
                  className={INPUT_CLS}
                  dir="ltr"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-500">تکرار رمز جدید</label>
                <input
                  type="password"
                  value={forgotConfirm}
                  onChange={e => setForgotConfirm(e.target.value)}
                  placeholder="رمز جدید را تکرار کنید"
                  className={INPUT_CLS}
                  dir="ltr"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {forgotMsg && <FeedbackMsg msg={forgotMsg} />}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={forgotSaving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 cursor-pointer transition-opacity"
                style={{ background: 'linear-gradient(135deg, #003087 0%, #0050b3 100%)' }}
              >
                {forgotSaving ? 'در حال بازیابی...' : 'تایید و تغییر رمز'}
              </button>
              <button
                type="button"
                onClick={() => { setForgotMode('idle'); setForgotMsg(null); setForgotOtp(''); setForgotNew(''); setForgotConfirm('') }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                بازگشت
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<Section, string> = {
  orders:   'سفارشات من',
  wishlist: 'علاقه‌مندی‌ها',
  psn:      'اکانت PSN',
  tickets:  'تیکت‌های پشتیبانی',
  security: 'تنظیمات حساب کاربری',
}

export default function AccountPage() {
  const { user, isLoading, logout } = useAuth()
  const toast = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const ordered = searchParams.get('ordered') === 'true'

  const [section, setSection] = useState<Section>('orders')

  useEffect(() => {
    if (!isLoading && !user) router.replace('/')
  }, [user, isLoading, router])

  const handleLogout = useCallback(async () => {
    await logout()
    toast.info('از حساب خارج شدید')
    router.push('/')
  }, [logout, router, toast])

  if (isLoading || !user) {
    return (
      <>
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[#003087] border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    )
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.phone_number

  return (
    <>
      <Header />
      <div className="w-full px-4 sm:px-6 lg:px-10 py-8 min-h-[calc(100dvh-5rem)] flex flex-col" dir="rtl">

        {ordered && (
          <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-2xl px-5 py-4 text-sm font-medium">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" />
            </svg>
            سفارش شما با موفقیت ثبت شد.
          </div>
        )}

        {/* Two-column layout — in RTL, flex row starts from right */}
        <div className="flex flex-col md:flex-row gap-5 flex-1">

          {/* ── Sidebar (RIGHT in RTL) ────────────────────────────────── */}
          <aside className="w-full md:w-64 shrink-0 md:sticky md:top-[4.5rem] md:flex md:flex-col">

            {/* Mobile: horizontal scroll tabs */}
            <div className="md:hidden flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-none">
              {NAV_MAIN.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={[
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all duration-150',
                    section === id ? 'text-white' : 'text-gray-600 bg-white border border-gray-200',
                  ].join(' ')}
                  style={section === id ? { background: 'linear-gradient(135deg, #003087 0%, #0050b3 100%)' } : {}}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>

            {/* Title above sidebar — desktop only */}
            <div className="hidden md:block mb-4">
              <h1 className="text-2xl font-bold text-gray-900">حساب کاربری</h1>
            </div>

            {/* Desktop sidebar card */}
            <div className="hidden md:flex flex-col flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden">

              {/* User info at top of sidebar */}
              <div
                className="px-4 pt-5 pb-4 flex items-center gap-3"
                style={{ background: 'linear-gradient(135deg, #003087 0%, #0050b3 100%)' }}
              >
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-base shrink-0">
                  {initials(user.first_name, user.last_name, user.phone_number)}
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{displayName}</p>
                  <p className="text-white/60 text-xs mt-0.5" dir="ltr">{user.phone_number}</p>
                </div>
              </div>

              {/* Main nav items */}
              <nav className="px-2 pt-3 pb-1" aria-label="ناوبری حساب">
                {NAV_MAIN.map(({ id, label, Icon }) => {
                  const active = section === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSection(id)}
                      className={[
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-150 mb-0.5',
                        active
                          ? 'text-white'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                      ].join(' ')}
                      style={active ? { background: 'linear-gradient(135deg, #003087 0%, #0050b3 100%)' } : {}}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon />
                      {label}
                    </button>
                  )
                })}
              </nav>

              {/* Separator */}
              <div className="mx-4 border-t border-gray-100 my-2" />

              {/* Utility items */}
              <div className="px-2 pb-3">
                <button
                  type="button"
                  onClick={() => setSection('tickets')}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 cursor-pointer"
                >
                  <Icons.support />
                  پشتیبانی
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors duration-150 cursor-pointer mt-0.5"
                >
                  <Icons.logout />
                  خروج از حساب
                </button>
              </div>
            </div>
          </aside>

          {/* ── Content (LEFT in RTL) ─────────────────────────────────── */}
          <main className="flex-1 min-w-0 flex flex-col" id="main-content">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-800">{SECTION_LABELS[section]}</h2>
            </div>

            <div className="flex-1 flex flex-col">
              {section === 'orders'   && <OrdersSection />}
              {section === 'wishlist' && <WishlistSection />}
              {section === 'psn'      && <PsnSection />}
              {section === 'tickets'  && <TicketsSection />}
              {section === 'security' && <SecuritySection />}
            </div>
          </main>

        </div>
      </div>
    </>
  )
}
