"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { InputOTP, Spinner, REGEXP_ONLY_DIGITS } from '@heroui/react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { api, extractApiError } from '@/lib/api'

type Screen = 'tabs' | 'otp' | 'profile'
type ActiveTab = 'login' | 'signup'

function inputCls(hasError = false) {
  return [
    'w-full rounded-xl px-4 py-3 text-sm text-gray-900',
    'bg-gray-50 border outline-none transition-all duration-150',
    'placeholder:text-gray-400',
    hasError
      ? 'border-red-400 focus:ring-2 focus:ring-red-200'
      : 'border-gray-200 focus:border-[#0050b3] focus:ring-2 focus:ring-[#003087]/10',
  ].join(' ')
}

function labelCls() {
  return 'block text-xs font-semibold text-gray-600 mb-1.5'
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function PasswordInput({
  placeholder,
  value,
  onChange,
  autoComplete,
  hasError,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  hasError?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        dir="ltr"
        className={`${inputCls(!!hasError)} pr-10`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'مخفی کردن رمز' : 'نمایش رمز'}
        className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

function PsButton({
  children,
  onClick,
  disabled,
  type = 'button',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full mt-1 py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: 'linear-gradient(135deg, #003087 0%, #0050b3 100%)' }}
    >
      {children}
    </button>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      {message}
    </div>
  )
}

function PSLogoIcon() {
  return (
    <svg width="26" height="18" viewBox="0 0 32 22" fill="white" aria-hidden>
      <path d="M11.6 0v16.8l4 1.3V4.1c0-.7.3-1.2.8-1 .6.2.9.8.9 1.5v11.6l4 1.3V4.4C21.3 1.4 19.4 0 17 0c-1.6 0-3.5.7-5.4 0zM20.8 13.8v3.3l6.4-2.1c.7-.2.8-.5.3-.7l-2.7-.9c-.5-.2-1.3-.1-2 .1l-2 .3zM0 17.3l5.8 2c2 .7 4.2.5 5.8-.5V15l-4.2 1.4c-.6.2-1.2.2-1.6 0L4 15.7c-.5-.2-.4-.5.1-.7l1.7-.6V11l-5.8 2v4.3z" />
    </svg>
  )
}

export default function AuthModal() {
  const { authModalOpen, closeAuthModal, setTokens, refreshUser } = useAuth()
  const toast = useToast()

  // Animation states
  const [shouldRender, setShouldRender] = useState(false)
  const [visible, setVisible] = useState(false)

  const [screen, setScreen] = useState<Screen>('tabs')
  const [activeTab, setActiveTab] = useState<ActiveTab>('login')

  const [loginPhone, setLoginPhone] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [signupPassword, setSignupPassword] = useState('')

  const [otpToken, setOtpToken] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const otpValueRef = useRef('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)

  const reset = useCallback(() => {
    setScreen('tabs')
    setActiveTab('login')
    setLoginPhone('')
    setLoginPassword('')
    setSignupPhone('')
    setSignupPassword('')
    setOtpToken('')
    setOtpCode('')
    otpValueRef.current = ''
    setFirstName('')
    setLastName('')
    setEmail('')
    setError(null)
    setLoading(false)
  }, [])

  const handleClose = useCallback(() => {
    closeAuthModal()
    setTimeout(reset, 300)
  }, [closeAuthModal, reset])

  // Entrance / exit animation + scroll lock
  useEffect(() => {
    let frame: number | undefined
    let timer: number | undefined
    let unmountTimer: number | undefined

    if (authModalOpen) {
      document.body.style.overflow = 'hidden'
      timer = window.setTimeout(() => {
        setShouldRender(true)
        frame = requestAnimationFrame(() => setVisible(true))
      }, 0)
    } else {
      document.body.style.overflow = ''
      timer = window.setTimeout(() => setVisible(false), 0)
      unmountTimer = window.setTimeout(() => setShouldRender(false), 200)
    }

    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame)
      if (timer !== undefined) window.clearTimeout(timer)
      if (unmountTimer !== undefined) window.clearTimeout(unmountTimer)
    }
  }, [authModalOpen])

  // Escape key
  useEffect(() => {
    if (!authModalOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [authModalOpen, handleClose])

  // Auto-focus first input on open / screen change
  useEffect(() => {
    if (!authModalOpen) return
    const t = setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>('input')?.focus()
    }, 60)
    return () => clearTimeout(t)
  }, [authModalOpen, screen])

  async function handleLogin() {
    if (!loginPhone || !loginPassword) {
      const message = 'شماره موبایل و رمز عبور الزامی است'
      setError(message)
      toast.error('ورود انجام نشد', message)
      return
    }
    setLoading(true); setError(null)
    try {
      const res = await api.post('/api/auth/login/', { phone_number: loginPhone, password: loginPassword })
      const data = await res.json()
      if (!res.ok) {
        const message = extractApiError(data)
        setError(message)
        toast.error('ورود انجام نشد', message)
        return
      }
      setTokens(data.access, data.refresh)
      await refreshUser()
      toast.success('وارد حساب شدید')
      handleClose()
    } catch {
      const message = 'خطا در اتصال به سرور'
      setError(message)
      toast.error('ورود انجام نشد', message)
    }
    finally { setLoading(false) }
  }

  async function handleSignup() {
    if (!signupPhone || !signupPassword) {
      const message = 'شماره موبایل و رمز عبور الزامی است'
      setError(message)
      toast.error('ثبت نام انجام نشد', message)
      return
    }
    setLoading(true); setError(null)
    try {
      const res = await api.post('/api/auth/signup/', { phone_number: signupPhone, password: signupPassword })
      const data = await res.json()
      if (!res.ok) {
        const message = extractApiError(data)
        setError(message)
        toast.error('ثبت نام انجام نشد', message)
        return
      }
      setOtpToken(data.otp_token)
      setScreen('otp')
      toast.info('کد تایید ارسال شد', 'کد پیامک‌شده را وارد کنید.')
    } catch {
      const message = 'خطا در اتصال به سرور'
      setError(message)
      toast.error('ثبت نام انجام نشد', message)
    }
    finally { setLoading(false) }
  }

  async function handleVerifyOtp(code: string) {
    if (code.length !== 6) return
    setLoading(true); setError(null)
    try {
      const res = await api.post('/api/auth/verify-otp/', { otp_token: otpToken, code })
      const data = await res.json()
      if (!res.ok) {
        const message = extractApiError(data)
        setError(message)
        setOtpCode('')
        otpValueRef.current = ''
        toast.error('کد تایید پذیرفته نشد', message)
        return
      }
      setTokens(data.access, data.refresh)
      if (data.needs_profile_completion) {
        setScreen('profile')
        toast.info('حساب تایید شد', 'برای ادامه اطلاعات حساب را تکمیل کنید.')
      }
      else {
        await refreshUser()
        toast.success('حساب شما تایید شد')
        handleClose()
      }
    } catch {
      const message = 'خطا در اتصال به سرور'
      setError(message)
      toast.error('کد تایید پذیرفته نشد', message)
    }
    finally { setLoading(false) }
  }

  async function handleCompleteProfile() {
    setLoading(true); setError(null)
    try {
      const res = await api.post('/api/auth/complete-profile/', {
        first_name: firstName, last_name: lastName, email: email || undefined,
      })
      const data = await res.json()
      if (!res.ok) {
        const message = extractApiError(data)
        setError(message)
        toast.error('پروفایل ذخیره نشد', message)
        return
      }
      await refreshUser()
      toast.success('پروفایل تکمیل شد')
      handleClose()
    } catch {
      const message = 'خطا در اتصال به سرور'
      setError(message)
      toast.error('پروفایل ذخیره نشد', message)
    }
    finally { setLoading(false) }
  }

  function switchTab(tab: ActiveTab) { setActiveTab(tab); setError(null) }

  const headerTitle = screen === 'otp' ? 'تایید کد' : screen === 'profile' ? 'تکمیل پروفایل' : 'GameXS'
  const headerSub = screen === 'otp' ? 'کد ارسال شده را وارد کنید' : screen === 'profile' ? 'اطلاعات حساب خود را تکمیل کنید' : 'ورود یا ایجاد حساب'

  if (!shouldRender || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" role="presentation">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={headerTitle}
        className={`relative z-10 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
      >
        {/* PS Blue Header */}
        <div
          className="px-6 pt-6 pb-5 relative"
          style={{ background: 'linear-gradient(135deg, #003087 0%, #0050b3 100%)' }}
        >
          <div className="flex items-center gap-2.5 mb-0.5">
            <PSLogoIcon />
            <span className="text-white font-bold text-lg tracking-wide">{headerTitle}</span>
          </div>
          <p className="text-white/60 text-xs">{headerSub}</p>
          <button
            type="button"
            onClick={handleClose}
            aria-label="بستن"
            className="absolute top-4 left-4 text-white/60 hover:text-white transition-colors duration-150 p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <div className="bg-white px-6 pt-5 pb-6" dir="rtl">

          {screen === 'tabs' && (
            <>
              {/* Tab switcher */}
              <div className="flex rounded-xl bg-gray-100 p-1 mb-5 gap-1">
                {(['login', 'signup'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => switchTab(tab)}
                    className={[
                      'flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer',
                      activeTab === tab
                        ? 'text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-700',
                    ].join(' ')}
                    style={activeTab === tab ? { background: 'linear-gradient(135deg, #003087 0%, #0050b3 100%)' } : {}}
                  >
                    {tab === 'login' ? 'ورود' : 'ثبت نام'}
                  </button>
                ))}
              </div>

              {activeTab === 'login' ? (
                <form onSubmit={(e) => { e.preventDefault(); handleLogin() }} className="flex flex-col gap-4">
                  <div>
                    <label className={labelCls()}>شماره موبایل</label>
                    <input type="tel" inputMode="numeric" placeholder="09XXXXXXXXX"
                      value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)}
                      dir="ltr" className={inputCls(!!error)} autoComplete="tel" maxLength={11} />
                  </div>
                  <div>
                    <label className={labelCls()}>رمز عبور</label>
                    <PasswordInput
                      placeholder="رمز عبور خود را وارد کنید"
                      value={loginPassword}
                      onChange={setLoginPassword}
                      autoComplete="current-password"
                      hasError={!!error}
                    />
                  </div>
                  {error && <ErrorBox message={error} />}
                  <PsButton type="submit" disabled={loading}>
                    {loading ? <Spinner size="sm" /> : 'ورود به حساب'}
                  </PsButton>
                </form>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleSignup() }} className="flex flex-col gap-4">
                  <div>
                    <label className={labelCls()}>شماره موبایل</label>
                    <input type="tel" inputMode="numeric" placeholder="09XXXXXXXXX"
                      value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)}
                      dir="ltr" className={inputCls(!!error)} autoComplete="tel" maxLength={11} />
                  </div>
                  <div>
                    <label className={labelCls()}>رمز عبور</label>
                    <PasswordInput
                      placeholder="حداقل ۸ کاراکتر"
                      value={signupPassword}
                      onChange={setSignupPassword}
                      autoComplete="new-password"
                      hasError={!!error}
                    />
                  </div>
                  {error && <ErrorBox message={error} />}
                  <PsButton type="submit" disabled={loading}>
                    {loading ? <Spinner size="sm" /> : 'ایجاد حساب'}
                  </PsButton>
                </form>
              )}
            </>
          )}

          {screen === 'otp' && (
            <div className="flex flex-col items-center gap-5">
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                کد ۶ رقمی ارسال شده به{' '}
                <span className="font-mono font-bold text-[#003087]" dir="ltr">{signupPhone}</span>{' '}
                را وارد کنید
              </p>

              {/* LTR wrapper ensures slots order left-to-right regardless of page dir */}
              <div dir="ltr">
                <InputOTP.Root
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otpCode}
                  onChange={(val) => { setOtpCode(val); otpValueRef.current = val }}
                  onComplete={() => { if (!loading) handleVerifyOtp(otpValueRef.current) }}
                  isDisabled={loading}
                >
                  <InputOTP.Group className="gap-2.5">
                    <InputOTP.Slot index={0} />
                    <InputOTP.Slot index={1} />
                    <InputOTP.Slot index={2} />
                    <InputOTP.Slot index={3} />
                    <InputOTP.Slot index={4} />
                    <InputOTP.Slot index={5} />
                  </InputOTP.Group>
                </InputOTP.Root>
              </div>

              {error && <ErrorBox message={error} />}

              <PsButton disabled={loading || otpCode.length !== 6} onClick={() => handleVerifyOtp(otpValueRef.current)}>
                {loading ? <Spinner size="sm" /> : 'تایید کد'}
              </PsButton>

              <button type="button" onClick={() => { setScreen('tabs'); setError(null) }}
                className="text-xs text-gray-400 hover:text-[#003087] transition-colors duration-150 cursor-pointer">
                بازگشت
              </button>
            </div>
          )}

          {screen === 'profile' && (
            <form onSubmit={(e) => { e.preventDefault(); handleCompleteProfile() }} className="flex flex-col gap-4">
              <p className="text-sm text-gray-400 text-right leading-relaxed">اطلاعات زیر قابل ویرایش است.</p>
              <div>
                <label className={labelCls()}>نام</label>
                <input type="text" placeholder="نام" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)} className={inputCls(false)} autoComplete="given-name" />
              </div>
              <div>
                <label className={labelCls()}>نام خانوادگی</label>
                <input type="text" placeholder="نام خانوادگی" value={lastName}
                  onChange={(e) => setLastName(e.target.value)} className={inputCls(false)} autoComplete="family-name" />
              </div>
              <div>
                <label className={labelCls()}>ایمیل (اختیاری)</label>
                <input type="email" placeholder="example@mail.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} dir="ltr" className={inputCls(false)} autoComplete="email" />
              </div>
              {error && <ErrorBox message={error} />}
              <PsButton type="submit" disabled={loading}>
                {loading ? <Spinner size="sm" /> : 'ذخیره و ادامه'}
              </PsButton>
              <button type="button" onClick={handleClose}
                className="text-xs text-gray-400 hover:text-[#003087] transition-colors duration-150 text-center cursor-pointer">
                بعدا تکمیل می‌کنم
              </button>
            </form>
          )}

        </div>
      </div>
    </div>,
    document.body
  )
}
