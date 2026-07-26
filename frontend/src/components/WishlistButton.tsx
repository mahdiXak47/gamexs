"use client"

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

const PENDING_KEY = 'gx_pending_wishlist'

export default function WishlistButton({ gameId }: { gameId: number }) {
  const { user, openAuthModal } = useAuth()
  const [added, setAdded]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast]     = useState(false)
  const [hovered, setHovered] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Check if already in wishlist on mount / after login
  useEffect(() => {
    if (!user) return
    api.get('/api/wishlist/').then(async r => {
      if (!r.ok) return
      const data = await r.json()
      const items: { game_id: number }[] = data.results ?? data ?? []
      if (items.some(i => i.game_id === gameId)) setAdded(true)
    })
  }, [user, gameId])

  // Auto-add after login if user clicked heart while logged out
  useEffect(() => {
    if (!user) return
    const pending = localStorage.getItem(PENDING_KEY)
    if (pending && parseInt(pending) === gameId) {
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
      if (res.ok || res.status === 400) {
        setAdded(true)
        setToast(true)
        clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(false), 3000)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleClick() {
    if (!user) {
      localStorage.setItem(PENDING_KEY, String(gameId))
      openAuthModal()
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
        aria-label="افزودن به علاقه‌مندی‌ها"
        className="flex items-center justify-center w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm border border-white/25 text-white transition-all duration-150 cursor-pointer disabled:opacity-50 active:scale-90"
      >
        {added ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        ) : loading ? (
          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        )}
      </button>

      {/* Hover tooltip */}
      {hovered && !added && !loading && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg pointer-events-none shadow-lg"
          dir="rtl"
        >
          افزودن به علاقه‌مندی‌ها
        </div>
      )}

      {/* Success toast */}
      {toast && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg pointer-events-none shadow-lg"
          dir="rtl"
        >
          به علاقه‌مندی‌ها اضافه شد
        </div>
      )}
    </div>
  )
}
