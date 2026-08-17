"use client"

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/lib/api'

const PENDING_KEY = 'gx_pending_wishlist'

export default function WishlistButton({ gameId }: { gameId: number }) {
  const { user, openAuthModal } = useAuth()
  const toast = useToast()
  const [added, setAdded]     = useState(false)
  const [itemId, setItemId]   = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const autoAddStarted = useRef(false)
  const mutationInFlight = useRef(false)

  // Check if already in wishlist on mount / after login
  useEffect(() => {
    if (!user) return
    void checkWishlistStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, gameId])

  // Auto-add after login if user clicked heart while logged out
  useEffect(() => {
    if (!user) return
    const pending = localStorage.getItem(PENDING_KEY)
    if (pending && parseInt(pending) === gameId && !autoAddStarted.current) {
      autoAddStarted.current = true
      localStorage.removeItem(PENDING_KEY)
      doAdd()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function doAdd() {
    if (mutationInFlight.current || loading || added) return
    mutationInFlight.current = true
    setCheckFailed(false)
    setLoading(true)
    try {
      const res = await api.post('/api/wishlist/', { game_id: gameId })
      if (res.ok) {
        const data: { id?: number } = await res.json()
        setAdded(true)
        setItemId(data.id ?? null)
        toast.success('به علاقه‌مندی‌ها اضافه شد')
      } else if (res.status === 400) {
        const id = await findWishlistItemId()
        setAdded(true)
        setItemId(id)
        toast.info('این بازی قبلاً در علاقه‌مندی‌ها بود')
      } else {
        toast.error('افزودن انجام نشد', 'چند لحظه دیگر دوباره تلاش کنید.')
      }
    } catch {
      toast.error('ارتباط برقرار نشد', 'اتصال خود را بررسی کنید و دوباره تلاش کنید.')
    } finally {
      mutationInFlight.current = false
      setLoading(false)
    }
  }

  async function findWishlistItemId() {
    const res = await api.get('/api/wishlist/')
    if (!res.ok) return null

    const data = await res.json()
    const items: { id: number; game_id: number }[] = data.results ?? data ?? []
    return items.find(i => i.game_id === gameId)?.id ?? null
  }

  async function doRemove() {
    if (mutationInFlight.current || loading || !added) return
    mutationInFlight.current = true
    setCheckFailed(false)
    setLoading(true)
    try {
      const id = itemId ?? await findWishlistItemId()
      if (!id) {
        setAdded(false)
        setItemId(null)
        toast.info('این بازی در علاقه‌مندی‌ها نبود')
        return
      }

      const res = await api.delete(`/api/wishlist/${id}/`)
      if (res.ok || res.status === 404) {
        setAdded(false)
        setItemId(null)
        toast.success('از علاقه‌مندی‌ها حذف شد')
      } else {
        toast.error('حذف انجام نشد', 'چند لحظه دیگر دوباره تلاش کنید.')
      }
    } catch {
      toast.error('ارتباط برقرار نشد', 'اتصال خود را بررسی کنید و دوباره تلاش کنید.')
    } finally {
      mutationInFlight.current = false
      setLoading(false)
    }
  }

  function handleClick() {
    if (checking) return
    if (checkFailed && user) {
      void checkWishlistStatus()
      return
    }
    if (!user) {
      localStorage.setItem(PENDING_KEY, String(gameId))
      toast.info('برای ادامه وارد شوید', 'بعد از ورود، بازی به علاقه‌مندی‌ها اضافه می‌شود.')
      openAuthModal()
      return
    }
    if (added) {
      doRemove()
      return
    }
    doAdd()
  }

  async function checkWishlistStatus() {
    if (!user || checking) return
    setChecking(true)
    setCheckFailed(false)
    try {
      const res = await api.get('/api/wishlist/')
      if (!res.ok) throw new Error('wishlist_status_failed')
      const data = await res.json()
      const items: { id: number; game_id: number }[] = data.results ?? data ?? []
      const item = items.find(i => i.game_id === gameId)
      setAdded(!!item)
      setItemId(item?.id ?? null)
    } catch {
      setCheckFailed(true)
      toast.error('وضعیت علاقه‌مندی مشخص نشد', 'برای تلاش دوباره روی قلب بزنید.')
    } finally {
      setChecking(false)
    }
  }

  const isBusy = loading || checking
  const buttonLabel = checkFailed
    ? 'تلاش دوباره برای بررسی علاقه‌مندی'
    : added
      ? 'حذف از علاقه‌مندی‌ها'
      : 'افزودن به علاقه‌مندی‌ها'

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={checking}
        aria-label={buttonLabel}
        aria-pressed={added}
        aria-busy={isBusy}
        className={`flex items-center justify-center w-9 h-9 rounded-full backdrop-blur-sm border text-white transition-all duration-150 cursor-pointer disabled:opacity-60 active:scale-90 ${
          checkFailed
            ? 'bg-red-500/50 hover:bg-red-500/70 border-red-200/50'
            : 'bg-black/30 hover:bg-black/50 border-white/25'
        }`}
      >
        {isBusy ? (
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : checkFailed ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 12a9 9 0 0 1-9 9 8.8 8.8 0 0 1-5.5-1.9" />
            <path d="M3 12a9 9 0 0 1 14.9-6.8" />
            <path d="M17 1v4h4" />
            <path d="M7 23v-4H3" />
          </svg>
        ) : added ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        )}
      </button>

      {/* Hover tooltip */}
      {hovered && !isBusy && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg pointer-events-none shadow-lg z-50"
          dir="rtl"
        >
          {buttonLabel}
        </div>
      )}

    </div>
  )
}
