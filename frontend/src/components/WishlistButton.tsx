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
  const [hovered, setHovered] = useState(false)
  const autoAddStarted = useRef(false)

  // Check if already in wishlist on mount / after login
  useEffect(() => {
    if (!user) return
    api.get('/api/wishlist/').then(async r => {
      if (!r.ok) return
      const data = await r.json()
      const items: { id: number; game_id: number }[] = data.results ?? data ?? []
      const item = items.find(i => i.game_id === gameId)
      setAdded(!!item)
      setItemId(item?.id ?? null)
    })
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
    if (loading || added) return
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
    if (loading || !added) return
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
      setLoading(false)
    }
  }

  function handleClick() {
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

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={loading}
        aria-label={added ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
        aria-pressed={added}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm border border-white/25 text-white transition-all duration-150 cursor-pointer disabled:opacity-50 active:scale-90"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
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
      {hovered && !loading && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg pointer-events-none shadow-lg z-50"
          dir="rtl"
        >
          {added ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
        </div>
      )}

    </div>
  )
}
