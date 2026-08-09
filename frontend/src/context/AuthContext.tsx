"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api } from '@/lib/api'

export interface AuthUser {
  id: number
  phone_number: string
  first_name: string
  last_name: string
  email: string | null
  is_phone_verified: boolean
  is_email_verified: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  authModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/api/profile/', { skipAuthRefresh: true })
      if (res.ok) {
        setUser(await res.json())
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(refreshUser)
  }, [refreshUser])

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout/', {})
    } catch {}
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        authModalOpen,
        openAuthModal: () => setAuthModalOpen(true),
        closeAuthModal: () => setAuthModalOpen(false),
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
