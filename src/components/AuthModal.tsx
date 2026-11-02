import React, { useRef, useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Phone,
  User,
  X,
  WifiOff,
} from 'lucide-react';
import { TripBirrLogo } from './TripBirrLogo';
import { useTripBirrStore } from '../store/useTripBirrStore';
import { getTranslation, Language } from '../utils/i18n';
import { DriverProfileRecord } from '../database/schema';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  initialMode?: 'SIGN_IN' | 'CREATE_ACCOUNT' | 'FORGOT_PASSWORD';
  isFullScreen?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'SIGN_IN',
  isFullScreen = false,
}) => {
  const {
    settings,
    driverProfile,
    signInWithCloud,
    signUpWithCloud,
    resetPasswordCloud,
    signIn,
  } = useTripBirrStore();

  const isDark = settings.theme === 'dark';
  const lang = (settings.language || 'en') as Language;

  const [mode, setMode] = useState<'SIGN_IN' | 'CREATE_ACCOUNT' | 'FORGOT_PASSWORD'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sign in form state (Matching Sign in@2x.png)
  const [loginName, setLoginName] = useState(driverProfile.full_name || 'Abebe Kebede');
  const [loginPin, setLoginPin] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Create account form state (Matching Create account@2x.png)
  const [fullName, setFullName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');

  useEffect(() => {
    setMode(initialMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  // Sign In handler (checks credentials from database)
  const handleSignInSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const nameOrPhone = loginName.trim();
    const pin = loginPin.trim();

    if (!nameOrPhone) {
      setErrorMessage(lang === 'am' ? 'እባክዎ ስም ወይም ስልክ ቁጥር ያስገቡ' : 'Please enter your name or phone number.');
      return;
    }

    if (!pin) {
      setErrorMessage(lang === 'am' ? 'እባክዎ ባለ 4 አሃዝ ሚስጥር ቁጥር (PIN) ያስገቡ' : 'Please enter your 4-digit PIN.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Try cloud database sign in
      const cloudRes = await signInWithCloud(nameOrPhone, pin);
      if (cloudRes.success) {
        setSuccessMessage(lang === 'am' ? 'በተሳካ ሁኔታ ገብተዋል!' : 'Signed in successfully!');
        setTimeout(() => {
          onClose?.();
        }, 600);
        return;
      }

      // 2. Fallback to local offline check (e.g. if offline or demo Abebe Kebede)
      const localRes = signIn(nameOrPhone, pin);
      if (localRes.success) {
        setSuccessMessage(lang === 'am' ? 'በተሳካ ሁኔታ ገብተዋል!' : 'Signed in successfully!');
        setTimeout(() => {
          onClose?.();
        }, 600);
        return;
      }

      setErrorMessage(
        cloudRes.error ||
          (lang === 'am'
            ? 'የተሳሳተ ስም ወይም ሚስጥር ቁጥር። እባክዎ ያረጋግጡ።'
            : 'Incorrect Name or PIN. Please check your credentials.')
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error signing in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Account handler (Enforces internet connectivity & sets default vehicle details)
  const handleCreateAccountSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Requirement: Ensure internet access is available for first-time registration
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorMessage(
        lang === 'am'
          ? 'አዲስ መለያ ለመፍጠር የበይነመረብ (Internet) ግንኙነት ያስፈልጋል። እባክዎ ዳታ ወይም Wi-Fi ያብሩ።'
          : 'Internet connection is required to create a new driver account. Please turn on mobile data or Wi-Fi.'
      );
      return;
    }

    if (!fullName.trim()) {
      setErrorMessage(lang === 'am' ? 'እባክዎ ሙሉ ስም ያስገቡ' : 'Please enter your full name.');
      return;
    }

    const cleanPhone = phoneDigits.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMessage(lang === 'am' ? 'እባክዎ ትክክለኛ የቴሌብር ስልክ ቁጥር ያስገቡ' : 'Please enter a valid Telebirr phone number.');
      return;
    }

    if (!regPassword.trim() || regPassword.trim().length < 4) {
      setErrorMessage(lang === 'am' ? 'እባክዎ ቢያንስ ባለ 4 አሃዝ የይለፍ ቃል ያስገቡ' : 'Please enter a password with at least 4 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create user account in cloud database with sensible default vehicle details
      const cloudRes = await signUpWithCloud({
        fullName: fullName.trim(),
        phone: cleanPhone.startsWith('251') ? cleanPhone : cleanPhone.startsWith('0') ? `251${cleanPhone.slice(1)}` : `251${cleanPhone}`,
        password: regPassword.trim(),
        pin: regPassword.trim().slice(0, 4),
        // Default values as requested:
        vehicleType: 'MINIBUS_TAXI',
        vehiclePlate: 'Code 3 - A58291 AA',
        primaryCorridor: 'Bole ↔ Megenagna / Piassa',
        dailyTargetMinorUnits: 150000, // ETB 1,500.00 default daily goal
      });

      if (cloudRes.success) {
        setSuccessMessage(
          lang === 'am'
            ? 'መለያዎ ተፈጥሯል! በቀጥታ ወደ ስራ እየገቡ ነው...'
            : 'Account created! Starting your first trip...'
        );
        setTimeout(() => {
          onClose?.();
        }, 800);
      } else {
        setErrorMessage(cloudRes.error || 'Account creation failed. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error creating driver account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!forgotEmail.trim()) {
      setErrorMessage(getTranslation('auth_fill_all_fields', lang));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await resetPasswordCloud(forgotEmail.trim());
      if (res.success) {
        setSuccessMessage(getTranslation('auth_reset_link_sent', lang));
      } else {
        setErrorMessage(res.error || 'Failed to send recovery instructions.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error requesting password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFull = isFullScreen || !onClose;

  return (
    <div
      className={
        isFull
          ? 'fixed inset-0 z-50 flex items-center justify-center p-0 bg-[#0B0F1A] text-white overflow-y-auto animate-in fade-in duration-200'
          : 'fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200'
      }
    >
      <div
        className={`w-full h-full sm:h-auto max-w-[430px] sm:rounded-3xl flex flex-col p-6 sm:p-8 overflow-y-auto relative ${
          isFull
            ? 'bg-[#0B0F1A] text-white min-h-screen sm:min-h-0'
            : isDark
            ? 'bg-[#0B0F1A] text-white border border-[#1A2333] shadow-2xl'
            : 'bg-[#0B0F1A] text-white border border-slate-800 shadow-2xl'
        }`}
      >
        {/* ============================================================== */}
        {/* MODE 1: SIGN IN (Matching Template: Sign in@2x.png) */}
        {/* ============================================================== */}
        {mode === 'SIGN_IN' && (
          <div className="flex flex-col flex-1 pt-4 pb-2 animate-in fade-in duration-200">
            {/* Top Close Button (only if used as dismissable modal and user is already logged in) */}
            {onClose && !isFull && (
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Squircle Brand Logo */}
            <div className="mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#141B2D] border border-white/10 flex items-center justify-center shadow-lg">
                <TripBirrLogo size={42} shape="squircle" />
              </div>
            </div>

            {/* Header Titles */}
            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
              {lang === 'am' ? 'እንኳን ደህና መጡ' : 'Welcome back'}
            </h1>
            <p className="text-sm text-slate-400 mt-1 mb-8 font-normal">
              {lang === 'am'
                ? 'የዛሬ ጉዞዎችን እና ገቢዎን ለማየት ይግቡ።'
                : "Sign in to see today's trips and earnings."}
            </p>

            {/* Alerts */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold animate-in fade-in">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-[#2CD48D]/15 border border-[#2CD48D]/40 text-[#2CD48D] text-xs font-bold animate-in fade-in flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Sign In Form */}
            <form onSubmit={handleSignInSubmit} className="space-y-6 flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                {/* Field 1: Name */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">
                    {lang === 'am' ? 'ስም ወይም ስልክ' : 'Name'}
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#101726] border border-[#1E293B] focus-within:border-[#2CD48D] transition-colors">
                    <User className="w-5 h-5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      placeholder="Abebe Kebede"
                      className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Field 2: PIN (4-Box interactive input matching Sign in@2x.png) */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">
                    {lang === 'am' ? 'ሚስጥር ቁጥር (PIN)' : 'PIN'}
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    {[0, 1, 2, 3].map((index) => {
                      const digit = loginPin[index] || '';
                      const isCurrent = index === loginPin.length || (index === 3 && loginPin.length === 4);
                      return (
                        <div
                          key={index}
                          onClick={() => pinInputRef.current?.focus()}
                          className={`flex-1 h-16 sm:h-18 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer ${
                            isCurrent
                              ? 'border-[#2CD48D] bg-[#141B2D] shadow-[0_0_15px_rgba(44,212,141,0.2)]'
                              : digit
                              ? 'border-[#2CD48D]/60 bg-[#141B2D]'
                              : 'border-[#1E293B] bg-[#101726]'
                          }`}
                        >
                          {digit ? (
                            <span className="w-3.5 h-3.5 rounded-full bg-white shadow-xs"></span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Hidden numeric input to capture keyboard digits */}
                  <input
                    ref={pinInputRef}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={loginPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setLoginPin(val);
                    }}
                    className="opacity-0 absolute -z-10 pointer-events-none"
                    autoFocus
                  />

                  {/* Forgot PIN link */}
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('FORGOT_PASSWORD');
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs font-bold text-[#5CA4F8] hover:underline cursor-pointer"
                    >
                      {lang === 'am' ? 'ሚስጥር ቁጥር ረሱ?' : 'Forgot PIN?'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-6 space-y-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl bg-[#2CD48D] hover:bg-[#25be7d] disabled:opacity-50 text-[#052115] font-black text-base flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(44,212,141,0.3)] transition-all cursor-pointer active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{lang === 'am' ? 'በመግባት ላይ...' : 'Signing in...'}</span>
                    </>
                  ) : (
                    <span>{lang === 'am' ? 'ግባ' : 'Sign in'}</span>
                  )}
                </button>

                {/* Footer Switcher */}
                <p className="text-center text-xs text-slate-400">
                  {lang === 'am' ? 'አዲስ አሽከርካሪ ነዎት? ' : 'New to TripBirr? '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('CREATE_ACCOUNT');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="font-bold text-[#5CA4F8] hover:underline cursor-pointer"
                  >
                    {lang === 'am' ? 'መለያ ይፍጠሩ' : 'Create account'}
                  </button>
                </p>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 2: CREATE ACCOUNT (Matching Template: Create account@2x.png) */}
        {/* ============================================================== */}
        {mode === 'CREATE_ACCOUNT' && (
          <div className="flex flex-col flex-1 pt-2 pb-2 animate-in fade-in duration-200">
            {/* Top Back Button */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  setMode('SIGN_IN');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="w-10 h-10 rounded-2xl bg-[#141B2D] border border-white/10 flex items-center justify-center text-white hover:bg-[#1E2B45] transition-colors cursor-pointer"
                aria-label="Back to Sign In"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Header Titles */}
            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
              {lang === 'am' ? 'መለያ ፍጠር' : 'Create account'}
            </h1>
            <p className="text-sm text-slate-400 mt-1 mb-6 font-normal">
              {lang === 'am'
                ? 'ሶስት መረጃዎችን ብቻ በማስገባት የመጀመሪያ ጉዞዎን ይጀምሩ።'
                : "Three details and you're ready to start your first trip."}
            </p>

            {/* Alerts */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold animate-in fade-in">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-[#2CD48D]/15 border border-[#2CD48D]/40 text-[#2CD48D] text-xs font-bold animate-in fade-in flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Create Account Form */}
            <form onSubmit={handleCreateAccountSubmit} className="space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-5">
                {/* Field 1: Full name */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">
                    {lang === 'am' ? 'ሙሉ ስም' : 'Full name'}
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#101726] border border-[#1E293B] focus-within:border-[#2CD48D] transition-colors">
                    <User className="w-5 h-5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Abebe Kebede"
                      className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Field 2: Telebirr phone number with +251 prefix */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">
                    {lang === 'am' ? 'የቴሌብር ስልክ ቁጥር' : 'Telebirr phone number'}
                  </label>
                  <div className="flex items-center px-4 py-3.5 rounded-2xl bg-[#101726] border border-[#1E293B] focus-within:border-[#2CD48D] transition-colors">
                    <span className="text-sm font-bold text-[#5CA4F8] pr-3 border-r border-slate-700 select-none">
                      +251
                    </span>
                    <input
                      type="tel"
                      value={phoneDigits}
                      onChange={(e) => setPhoneDigits(e.target.value)}
                      placeholder="91 234 8747"
                      className="bg-transparent text-sm text-white placeholder-slate-500 w-full pl-3 outline-hidden font-mono"
                      required
                    />
                  </div>
                  <p className="text-[11.5px] text-slate-400 mt-1.5">
                    {lang === 'am'
                      ? 'የቴሌብር ክፍያ መልዕክቶችን የሚቀበሉበት ስልክ ቁጥር።'
                      : 'The number that receives your Telebirr payments.'}
                  </p>
                </div>

                {/* Field 3: Password / PIN with 4-segment strength indicator */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">
                    {lang === 'am' ? 'የይለፍ ቃል / ሚስጥር ቁጥር' : 'Password'}
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#101726] border border-[#1E293B] focus-within:border-[#2CD48D] transition-colors">
                    <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      minLength={4}
                      className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-mono tracking-wider"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* 4-segment strength bar (Matching Create account@2x.png) */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {[0, 1, 2, 3].map((idx) => {
                      const active = regPassword.length >= (idx + 1) * 2;
                      return (
                        <div
                          key={idx}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            active ? 'bg-[#2CD48D]' : 'bg-[#1E293B]'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[11.5px] text-slate-400 mt-1.5">
                    {regPassword.length >= 8
                      ? lang === 'am'
                        ? 'ጥሩ · ቢያንስ 8 ፊደላት ተጠቅመዋል'
                        : 'Good · use at least 8 characters'
                      : lang === 'am'
                      ? 'ቢያንስ 4-8 አሃዝ ሚስጥር ቁጥር ያስገቡ'
                      : 'Enter at least 4-8 characters'}
                  </p>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-6 space-y-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl bg-[#2CD48D] hover:bg-[#25be7d] disabled:opacity-50 text-[#052115] font-black text-base flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(44,212,141,0.3)] transition-all cursor-pointer active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{lang === 'am' ? 'መለያ በመፍጠር ላይ...' : 'Creating account...'}</span>
                    </>
                  ) : (
                    <span>{lang === 'am' ? 'መለያ ፍጠር' : 'Create account'}</span>
                  )}
                </button>

                {/* Footer Switcher */}
                <p className="text-center text-xs text-slate-400">
                  {lang === 'am' ? 'አስቀድመው መለያ አለዎት? ' : 'Already have an account? '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('SIGN_IN');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="font-bold text-[#5CA4F8] hover:underline cursor-pointer"
                  >
                    {lang === 'am' ? 'ይግቡ' : 'Sign in'}
                  </button>
                </p>
              </div>
            </form>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 3: FORGOT PASSWORD */}
        {/* ============================================================== */}
        {mode === 'FORGOT_PASSWORD' && (
          <div className="flex flex-col flex-1 pt-4 pb-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  setMode('SIGN_IN');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="w-10 h-10 rounded-2xl bg-[#141B2D] border border-white/10 flex items-center justify-center text-white hover:bg-[#1E2B45] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
              {lang === 'am' ? 'የይለፍ ቃል ቀይር' : 'Reset password'}
            </h1>
            <p className="text-sm text-slate-400 mt-1 mb-6 font-normal">
              {lang === 'am'
                ? 'የተመዘገቡበትን ኢሜይል ወይም ስልክ ያስገቡ፤ መመሪያ ይላክልዎታል።'
                : 'Enter your registered email address to receive password reset instructions.'}
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold animate-in fade-in">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="mb-4 p-3 rounded-xl bg-[#2CD48D]/15 border border-[#2CD48D]/40 text-[#2CD48D] text-xs font-bold animate-in fade-in flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-6 flex-1 flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">
                  {lang === 'am' ? 'ኢሜይል አድራሻ' : 'Email address'}
                </label>
                <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#101726] border border-[#1E293B] focus-within:border-[#2CD48D] transition-colors">
                  <KeyRound className="w-5 h-5 text-slate-400 shrink-0" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="driver@example.com"
                    className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl bg-[#5CA4F8] hover:bg-[#4392f4] disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending instructions...</span>
                    </>
                  ) : (
                    <span>Send Reset Email</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('SIGN_IN');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
