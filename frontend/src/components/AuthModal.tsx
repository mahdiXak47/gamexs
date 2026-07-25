"use client"

import { useCallback, useRef, useState } from 'react'
import { Modal, InputOTP, Button, Spinner, REGEXP_ONLY_DIGITS } from '@heroui/react'
import { useAuth } from '@/context/AuthContext'
import { api, extractApiError } from '@/lib/api'

type Screen = 'tabs' | 'otp' | 'profile'
type ActiveTab = 'login' | 'signup'

function inputClass(hasError = false) {
  return [
    'w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm text-gray-900',
    'placeholder:text-gray-400 outline-none transition-colors',
    'border',
    hasError
      ? 'border-red-400 focus:ring-2 focus:ring-red-400'
      : 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
  ].join(' ')
}

function labelClass() {
  return 'block text-xs font-medium text-gray-600 mb-1'
}

export default function AuthModal() {
  const { authModalOpen, closeAuthModal, setTokens, refreshUser } = useAuth()

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

  async function handleLogin() {
    if (!loginPhone || !loginPassword) {
      setError('شماره موبایل و رمز عبور الزامی است')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/login/', {
        phone_number: loginPhone,
        password: loginPassword,
      })
      const data = await res.json()
      if (!res.ok) { setError(extractApiError(data)); return }
      setTokens(data.access, data.refresh)
      await refreshUser()
      handleClose()
    } catch {
      setError('خطا در اتصال به سرور')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup() {
    if (!signupPhone || !signupPassword) {
      setError('شماره موبایل و رمز عبور الزامی است')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/signup/', {
        phone_number: signupPhone,
        password: signupPassword,
      })
      const data = await res.json()
      if (!res.ok) { setError(extractApiError(data)); return }
      setOtpToken(data.otp_token)
      setScreen('otp')
    } catch {
      setError('خطا در اتصال به سرور')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(code: string) {
    if (code.length !== 6) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/verify-otp/', {
        otp_token: otpToken,
        code,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(extractApiError(data))
        setOtpCode('')
        otpValueRef.current = ''
        return
      }
      setTokens(data.access, data.refresh)
      if (data.needs_profile_completion) {
        setScreen('profile')
      } else {
        await refreshUser()
        handleClose()
      }
    } catch {
      setError('خطا در اتصال به سرور')
    } finally {
      setLoading(false)
    }
  }

  async function handleCompleteProfile() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/complete-profile/', {
        first_name: firstName,
        last_name: lastName,
        email: email || undefined,
      })
      const data = await res.json()
      if (!res.ok) { setError(extractApiError(data)); return }
      await refreshUser()
      handleClose()
    } catch {
      setError('خطا در اتصال به سرور')
    } finally {
      setLoading(false)
    }
  }

  function switchTab(tab: ActiveTab) {
    setActiveTab(tab)
    setError(null)
  }

  const heading =
    screen === 'otp'
      ? 'تایید کد'
      : screen === 'profile'
      ? 'تکمیل پروفایل'
      : 'ورود یا ثبت نام'

  return (
    <Modal.Root
      isOpen={authModalOpen}
      onOpenChange={(open) => { if (!open) handleClose() }}
    >
      <Modal.Backdrop isDismissable />
      <Modal.Container size="sm" placement="center">
        <Modal.Dialog>
          <Modal.Header className="flex items-center justify-between">
            <Modal.Heading className="text-base font-bold text-gray-900">
              {heading}
            </Modal.Heading>
            <Modal.CloseTrigger />
          </Modal.Header>

          <Modal.Body className="px-6 pb-6 pt-2" dir="rtl">
            {screen === 'tabs' && (
              <>
                {/* tab switcher */}
                <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
                  {(['login', 'signup'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => switchTab(tab)}
                      className={[
                        'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
                        activeTab === tab
                          ? 'bg-white shadow-sm text-gray-900'
                          : 'text-gray-500 hover:text-gray-700',
                      ].join(' ')}
                    >
                      {tab === 'login' ? 'ورود' : 'ثبت نام'}
                    </button>
                  ))}
                </div>

                {activeTab === 'login' ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleLogin() }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <label className={labelClass()}>شماره موبایل</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="09XXXXXXXXX"
                        value={loginPhone}
                        onChange={(e) => setLoginPhone(e.target.value)}
                        dir="ltr"
                        className={inputClass(!!error)}
                        autoComplete="tel"
                        maxLength={11}
                      />
                    </div>
                    <div>
                      <label className={labelClass()}>رمز عبور</label>
                      <input
                        type="password"
                        placeholder="رمز عبور"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className={inputClass(!!error)}
                        autoComplete="current-password"
                      />
                    </div>
                    {error && (
                      <p className="text-xs text-red-500 text-right">{error}</p>
                    )}
                    <Button.Root
                      type="submit"
                      variant="primary"
                      fullWidth
                      isDisabled={loading}
                      className="mt-1"
                    >
                      {loading ? <Spinner size="sm" /> : 'ورود'}
                    </Button.Root>
                  </form>
                ) : (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSignup() }}
                    className="flex flex-col gap-4"
                  >
                    <div>
                      <label className={labelClass()}>شماره موبایل</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="09XXXXXXXXX"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        dir="ltr"
                        className={inputClass(!!error)}
                        autoComplete="tel"
                        maxLength={11}
                      />
                    </div>
                    <div>
                      <label className={labelClass()}>رمز عبور</label>
                      <input
                        type="password"
                        placeholder="حداقل ۸ کاراکتر"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className={inputClass(!!error)}
                        autoComplete="new-password"
                      />
                    </div>
                    {error && (
                      <p className="text-xs text-red-500 text-right">{error}</p>
                    )}
                    <Button.Root
                      type="submit"
                      variant="primary"
                      fullWidth
                      isDisabled={loading}
                      className="mt-1"
                    >
                      {loading ? <Spinner size="sm" /> : 'ثبت نام'}
                    </Button.Root>
                  </form>
                )}
              </>
            )}

            {screen === 'otp' && (
              <div className="flex flex-col items-center gap-5">
                <p className="text-sm text-gray-600 text-center">
                  کد ۶ رقمی ارسال شده به{' '}
                  <span className="font-mono font-bold text-gray-900" dir="ltr">
                    {signupPhone}
                  </span>{' '}
                  را وارد کنید
                </p>

                <InputOTP.Root
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otpCode}
                  onChange={(val) => {
                    setOtpCode(val)
                    otpValueRef.current = val
                  }}
                  onComplete={() => {
                    if (!loading) handleVerifyOtp(otpValueRef.current)
                  }}
                  isDisabled={loading}
                  dir="ltr"
                >
                  <InputOTP.Group className="gap-2">
                    <InputOTP.Slot index={0} />
                    <InputOTP.Slot index={1} />
                    <InputOTP.Slot index={2} />
                    <InputOTP.Slot index={3} />
                    <InputOTP.Slot index={4} />
                    <InputOTP.Slot index={5} />
                  </InputOTP.Group>
                </InputOTP.Root>

                {error && (
                  <p className="text-xs text-red-500">{error}</p>
                )}

                <Button.Root
                  variant="primary"
                  fullWidth
                  isDisabled={loading || otpCode.length !== 6}
                  onPress={() => handleVerifyOtp(otpValueRef.current)}
                >
                  {loading ? <Spinner size="sm" /> : 'تایید'}
                </Button.Root>

                <button
                  type="button"
                  onClick={() => { setScreen('tabs'); setError(null) }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  بازگشت
                </button>
              </div>
            )}

            {screen === 'profile' && (
              <form
                onSubmit={(e) => { e.preventDefault(); handleCompleteProfile() }}
                className="flex flex-col gap-4"
              >
                <p className="text-sm text-gray-500 text-right mb-1">
                  پروفایل شما را تکمیل کنید. این اطلاعات قابل ویرایش است.
                </p>
                <div>
                  <label className={labelClass()}>نام</label>
                  <input
                    type="text"
                    placeholder="نام"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass(false)}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label className={labelClass()}>نام خانوادگی</label>
                  <input
                    type="text"
                    placeholder="نام خانوادگی"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass(false)}
                    autoComplete="family-name"
                  />
                </div>
                <div>
                  <label className={labelClass()}>ایمیل (اختیاری)</label>
                  <input
                    type="email"
                    placeholder="example@mail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    className={inputClass(false)}
                    autoComplete="email"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-500 text-right">{error}</p>
                )}
                <Button.Root
                  type="submit"
                  variant="primary"
                  fullWidth
                  isDisabled={loading}
                  className="mt-1"
                >
                  {loading ? <Spinner size="sm" /> : 'ذخیره و ادامه'}
                </Button.Root>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
                >
                  بعدا تکمیل می‌کنم
                </button>
              </form>
            )}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Root>
  )
}
