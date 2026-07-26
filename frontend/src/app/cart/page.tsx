"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { api, extractApiError } from '@/lib/api'
import { formatToman, toPersianDigits } from '@/lib/format'
import Header from '@/components/Header'

interface CartItem {
  id: number
  game_id: number
  game_title?: string
  product_type: string
  tier?: string | null
  price_toman: number
  added_at: string
}

interface CartResponse {
  items?: CartItem[]
  results?: CartItem[]
  total?: number
  count?: number
}

const PRODUCT_MAP: Record<string, string> = {
  'ACCOUNT_GAME:CAPACITY_1': 'اکانت ظرفیت ۱',
  'ACCOUNT_GAME:CAPACITY_2': 'اکانت ظرفیت ۲',
  'ACCOUNT_GAME:CAPACITY_3': 'اکانت ظرفیت ۳',
  DISC:             'نسخه فیزیکی',
  OWN_ACCOUNT_GAME: 'خرید برای اکانت شما',
}

function productLabel(type: string, tier?: string | null) {
  return tier ? (PRODUCT_MAP[`${type}:${tier}`] ?? type) : (PRODUCT_MAP[type] ?? type)
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

export default function CartPage() {
  const { user, isLoading, openAuthModal } = useAuth()
  const router = useRouter()

  const [items, setItems] = useState<CartItem[]>([])
  const [pageLoading, setPageLoading] = useState(true)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [ordering, setOrdering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !user) return
    if (!user) return
    fetchCart()
  }, [user, isLoading])

  async function fetchCart() {
    setPageLoading(true)
    try {
      const res = await api.get('/api/cart/')
      if (!res.ok) { setPageLoading(false); return }
      const data: CartResponse = await res.json()
      setItems(data.items ?? data.results ?? [])
    } finally {
      setPageLoading(false)
    }
  }

  async function removeItem(id: number) {
    setRemovingId(id)
    try {
      const res = await api.delete(`/api/cart/items/${id}/`)
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id))
    } finally {
      setRemovingId(null)
    }
  }

  async function clearCart() {
    try {
      const res = await api.delete('/api/cart/clear/')
      if (res.ok) setItems([])
    } catch {}
  }

  async function placeOrder() {
    setOrdering(true)
    setError(null)
    try {
      const res = await api.post('/api/orders/', {})
      const data = await res.json()
      if (!res.ok) { setError(extractApiError(data)); return }
      router.push('/account?ordered=true')
    } catch {
      setError('خطا در ثبت سفارش. لطفا دوباره تلاش کنید.')
    } finally {
      setOrdering(false)
    }
  }

  const total = items.reduce((sum, i) => sum + i.price_toman, 0)

  // Not logged in
  if (!isLoading && !user) {
    return (
      <>
        <Header />
        <div className="max-w-md mx-auto px-4 py-20 flex flex-col items-center gap-5 text-center" dir="rtl">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#003087" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <h1 className="text-xl font-bold text-gray-800">سبد خرید</h1>
          <p className="text-gray-500 text-sm">برای مشاهده سبد خرید ابتدا وارد حساب خود شوید.</p>
          <button
            type="button"
            onClick={openAuthModal}
            className="px-8 py-3 rounded-xl text-white text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #003087 0%, #0050b3 100%)' }}
          >
            ورود به حساب
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <main id="main-content" className="max-w-2xl mx-auto px-4 sm:px-6 py-8" dir="rtl">

        <h1 className="text-xl font-bold text-gray-800 mb-6">
          سبد خرید
          {items.length > 0 && (
            <span className="mr-2 text-sm font-normal text-gray-400">
              {toPersianDigits(items.length)} آیتم
            </span>
          )}
        </h1>

        {pageLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#003087] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-4 py-16 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <p className="text-gray-500 text-sm">سبد خرید شما خالی است</p>
            <Link
              href="/"
              className="text-sm font-semibold text-[#003087] hover:underline"
            >
              مشاهده بازی‌ها
            </Link>
          </div>
        ) : (
          <>
            {/* Items list */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 divide-y divide-gray-50">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {item.game_title ?? `بازی شناسه ${toPersianDigits(item.game_id)}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {productLabel(item.product_type, item.tier)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-gray-800 price-figure">
                      {formatToman(item.price_toman)} تومان
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={removingId === item.id}
                      aria-label="حذف از سبد"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150 cursor-pointer disabled:opacity-40"
                    >
                      {removingId === item.id
                        ? <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                        : <TrashIcon />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm text-gray-600">جمع کل</span>
                <span className="text-lg font-bold text-gray-900 price-figure">
                  {formatToman(total)} تومان
                </span>
              </div>

              {error && (
                <div className="mb-4 flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={placeOrder}
                disabled={ordering || items.length === 0}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #003087 0%, #0050b3 100%)' }}
              >
                {ordering
                  ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : 'ثبت سفارش'}
              </button>

              <button
                type="button"
                onClick={clearCart}
                className="w-full mt-3 py-2.5 rounded-xl text-gray-400 text-sm font-medium hover:text-red-500 hover:bg-red-50 transition-colors duration-150 cursor-pointer"
              >
                خالی کردن سبد
              </button>
            </div>
          </>
        )}
      </main>
    </>
  )
}
