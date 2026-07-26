"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
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
  game_title?: string
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
  { id: 'wishlist', label: 'لیست آرزو',    Icon: Icons.wishlist },
  { id: 'psn',      label: 'اکانت PSN',    Icon: Icons.psn },
  { id: 'tickets',  label: 'تیکت‌های پشتیبانی', Icon: Icons.tickets },
  { id: 'security', label: 'امنیت و ورود', Icon: Icons.security },
]

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await api.get('/api/orders/')
        if (res.ok) {
          const data = await res.json()
          setOrders(data.results ?? data ?? [])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const ACTIVE = new Set(['pending', 'confirmed', 'processing'])
  const filtered = tab === 'current' ? orders.filter(o => ACTIVE.has(o.status)) : orders

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

      {loading ? (
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
  const [items, setItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/wishlist/').then(async r => {
      if (r.ok) { const d = await r.json(); setItems(d.results ?? d ?? []) }
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex flex-col gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>

  if (items.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-4 flex-1 min-h-64 text-center">
      <Icons.empty />
      <p className="text-sm text-gray-500">لیست آرزو خالی است</p>
      <Link href="/" className="text-sm text-[#003087] font-semibold hover:underline cursor-pointer">افزودن بازی</Link>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <ul className="divide-y divide-gray-50">
        {items.map(item => (
          <li key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#003087]/8 flex items-center justify-center text-[#003087] shrink-0">
                <Icons.game />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {item.game_title ?? `بازی شناسه ${toPersianDigits(item.game_id)}`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(item.added_at)}</p>
              </div>
            </div>
            {item.target_price_toman && (
              <p className="text-xs text-[#003087] font-medium shrink-0 price-figure">
                هدف: {formatToman(item.target_price_toman)} ت
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Section: PSN Accounts ───────────────────────────────────────────────────

function PsnSection() {
  const [accounts, setAccounts] = useState<PsnAccount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/game-accounts/psn/').then(async r => {
      if (r.ok) { const d = await r.json(); setAccounts(d.results ?? d ?? []) }
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex flex-col gap-3">{[1,2].map(i => <Skeleton key={i} className="h-20" />)}</div>

  if (accounts.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-4 flex-1 min-h-64 text-center">
      <div className="w-12 h-12 flex items-center justify-center text-gray-300"><Icons.psn /></div>
      <p className="text-sm text-gray-500">اکانت PSN اضافه نشده</p>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/tickets/').then(async r => {
      if (r.ok) { const d = await r.json(); setTickets(d.results ?? d ?? []) }
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex flex-col gap-3">{[1,2].map(i => <Skeleton key={i} className="h-16" />)}</div>

  if (tickets.length === 0) return (
    <div className="bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-4 flex-1 min-h-64 text-center">
      <div className="w-12 h-12 flex items-center justify-center text-gray-300"><Icons.tickets /></div>
      <p className="text-sm text-gray-500">تیکتی وجود ندارد</p>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
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

// ─── Section: Security ───────────────────────────────────────────────────────

function SecuritySection() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-4 flex-1 min-h-64 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#003087]/8 flex items-center justify-center text-[#003087]">
        <Icons.security />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800">امنیت و ورود</p>
        <p className="text-xs text-gray-400 mt-1">تغییر رمز عبور و تنظیمات امنیتی به زودی اضافه می‌شود.</p>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<Section, string> = {
  orders:   'سفارشات من',
  wishlist: 'لیست آرزو',
  psn:      'اکانت PSN',
  tickets:  'تیکت‌های پشتیبانی',
  security: 'امنیت و ورود',
}

export default function AccountPage() {
  const { user, isLoading, logout } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const ordered = searchParams.get('ordered') === 'true'

  const [section, setSection] = useState<Section>('orders')

  useEffect(() => {
    if (!isLoading && !user) router.replace('/')
  }, [user, isLoading, router])

  const handleLogout = useCallback(async () => {
    await logout()
    router.push('/')
  }, [logout, router])

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
          <aside className="w-full md:w-64 shrink-0 md:self-start md:sticky md:top-4">

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
            <div className="hidden md:flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden">

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
                <Link
                  href="#"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150 cursor-pointer"
                >
                  <Icons.support />
                  پشتیبانی
                </Link>
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
