import React, { useState } from 'react';
import {
  Car,
  Check,
  Cloud,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Target,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { TripBirrLogo } from './TripBirrLogo';
import { useTripBirrStore } from '../store/useTripBirrStore';
import { getTranslation, Language } from '../utils/i18n';
import { DriverProfileRecord } from '../database/schema';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'SIGN_IN' | 'CREATE_ACCOUNT' | 'FORGOT_PASSWORD';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'SIGN_IN',
}) => {
  const {
    settings,
    accounts,
    signIn,
    createAccount,
    switchAccount,
    driverProfile,
    signInWithCloud,
    signUpWithCloud,
    resetPasswordCloud,
  } = useTripBirrStore();

  const isDark = settings.theme === 'dark';
  const lang = (settings.language || 'en') as Language;

  const [mode, setMode] = useState<'SIGN_IN' | 'CREATE_ACCOUNT' | 'FORGOT_PASSWORD'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sign In form state
  const [loginIdentifier, setLoginIdentifier] = useState(
    settings.cloud_user_email || driverProfile.telebirr_phone || '0912348747'
  );
  const [loginPassword, setLoginPassword] = useState('');

  // Create Account form state
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [vehicleType, setVehicleType] = useState<DriverProfileRecord['vehicle_type']>('MINIBUS_TAXI');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [route, setRoute] = useState('');
  const [dailyTargetBirr, setDailyTargetBirr] = useState('1500');

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');

  if (!isOpen) return null;

  const handleSignInSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const identifier = loginIdentifier.trim();
    const password = loginPassword.trim();

    if (!identifier) {
      setErrorMessage(getTranslation('auth_fill_all_fields', lang));
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if identifier is email -> use Supabase Cloud Auth
      if (identifier.includes('@')) {
        const cloudRes = await signInWithCloud(identifier, password || '123456');
        if (cloudRes.success) {
          setSuccessMessage(getTranslation('auth_signin_success', lang));
          setTimeout(() => {
            onClose();
          }, 800);
          return;
        } else {
          setErrorMessage(cloudRes.error || getTranslation('auth_login_error_not_found', lang));
          return;
        }
      }

      // Otherwise try local account or demo sign in
      const res = signIn(identifier, password || '1234');
      if (res.success) {
        setSuccessMessage(getTranslation('auth_signin_success', lang));
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        setErrorMessage(getTranslation((res.error as any) || 'auth_login_error_not_found', lang));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAccountSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName.trim()) {
      setErrorMessage(getTranslation('auth_fill_all_fields', lang));
      return;
    }

    setIsSubmitting(true);
    const targetMinor = (parseInt(dailyTargetBirr, 10) || 1200) * 100;

    try {
      // If email is provided, register directly in Supabase Cloud
      if (regEmail.trim()) {
        const cloudRes = await signUpWithCloud({
          email: regEmail.trim(),
          password: regPassword.trim() || 'TripBirr2026!',
          fullName: fullName.trim(),
          phone: regPhone.trim(),
          vehicleType,
          vehiclePlate: vehiclePlate.trim() || '3 - A58291 AA',
          primaryCorridor: route.trim() || 'Ayat ↔ Megenagna',
          dailyTargetMinorUnits: targetMinor,
        });

        if (cloudRes.success) {
          if (cloudRes.needsEmailConfirmation) {
            setSuccessMessage(getTranslation('auth_confirm_email_notice', lang));
          } else {
            setSuccessMessage(getTranslation('auth_create_success', lang));
          }
          setTimeout(() => {
            onClose();
          }, 1200);
          return;
        } else {
          setErrorMessage(cloudRes.error || 'Cloud registration failed.');
          return;
        }
      }

      // Otherwise create local account
      const res = createAccount({
        phone: regPhone.trim() || `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        fullName: fullName.trim(),
        pin: regPassword.trim() || '1234',
        vehicleType,
        vehiclePlate: vehiclePlate.trim() || '3 - A58291 AA',
        primaryCorridor: route.trim() || 'Ayat ↔ Megenagna',
        dailyTargetMinorUnits: targetMinor,
      });

      if (res.success) {
        setSuccessMessage(getTranslation('auth_create_success', lang));
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        setErrorMessage(getTranslation((res.error as any) || 'auth_create_error_phone', lang));
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error creating account.');
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
        setErrorMessage(res.error || 'Failed to send password reset email.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error requesting password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = () => {
    setErrorMessage(null);
    signIn('0912348747', '1234');
    setSuccessMessage(getTranslation('auth_signin_success', lang));
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleAccountSelect = (accId: string) => {
    setErrorMessage(null);
    switchAccount(accId);
    setSuccessMessage(getTranslation('auth_signin_success', lang));
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full h-full sm:h-auto max-w-[440px] sm:rounded-3xl flex flex-col p-6 overflow-y-auto shadow-2xl relative border ${
          isDark
            ? 'bg-[#090E17] text-white border-[#1A2333]'
            : 'bg-white text-[#0F172A] border-slate-200'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/20">
          <div className="flex items-center gap-3">
            <TripBirrLogo size={36} shape="squircle" />
            <div>
              <h2 className="text-lg font-black tracking-tight leading-tight">
                {mode === 'SIGN_IN'
                  ? getTranslation('auth_signin', lang)
                  : mode === 'CREATE_ACCOUNT'
                  ? getTranslation('auth_create_account', lang)
                  : getTranslation('auth_forgot_password', lang)}
              </h2>
              <p className="text-xs text-[#8E9BAE]">TripBirr Cloud & Driver Ledger</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
            }`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cloud Database Sync Ready Banner */}
        <div className="mt-4 p-3 rounded-2xl bg-[#182E6F]/30 border border-[#5CA4F8]/30 flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#182E6F] text-[#5CA4F8] shrink-0 mt-0.5">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2CD48D] animate-pulse"></span>
              <p className="text-xs font-bold text-[#5CA4F8]">
                {getTranslation('auth_cloud_ready', lang)}
              </p>
            </div>
            <p className="text-[11.5px] text-slate-300 leading-snug mt-1">
              {getTranslation('sync_backup_desc', lang)}
            </p>
          </div>
        </div>

        {/* Tab Switcher: Sign In vs Create Account */}
        {mode !== 'FORGOT_PASSWORD' && (
          <div className="mt-4 p-1 rounded-2xl bg-slate-800/40 dark:bg-[#131B2A] border border-slate-700/40 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('SIGN_IN');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'SIGN_IN'
                  ? 'bg-[#2CD48D] text-[#052115] shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              {getTranslation('auth_signin', lang)}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('CREATE_ACCOUNT');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'CREATE_ACCOUNT'
                  ? 'bg-[#2CD48D] text-[#052115] shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              {getTranslation('auth_create_account', lang)}
            </button>
          </div>
        )}

        {/* Alert Feedback Messages */}
        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold animate-in fade-in">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mt-3 p-3 rounded-xl bg-[#2CD48D]/15 border border-[#2CD48D]/40 text-[#2CD48D] text-xs font-bold animate-in fade-in flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ================= MODE: SIGN IN ================= */}
        {mode === 'SIGN_IN' && (
          <form onSubmit={handleSignInSubmit} className="mt-4 space-y-3.5">
            {/* Email or Phone Field */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {getTranslation('auth_email', lang)} / {getTranslation('phone_number', lang)}
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#2CD48D]">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="driver@example.com or 0912348747"
                  className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-mono"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300">
                  {getTranslation('auth_password', lang)} / PIN
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('FORGOT_PASSWORD');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-[11px] text-[#5CA4F8] hover:underline cursor-pointer"
                >
                  {getTranslation('auth_forgot_password', lang)}
                </button>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#2CD48D]">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Password or Demo PIN (1234)"
                  className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-mono tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Primary Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3.5 rounded-2xl bg-[#2CD48D] hover:bg-[#25be7d] disabled:opacity-50 text-[#052115] font-black text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(44,212,141,0.3)] transition-all cursor-pointer active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to Cloud...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{getTranslation('auth_signin', lang)}</span>
                </>
              )}
            </button>

            {/* 1-Click Quick Demo Sign In */}
            <button
              type="button"
              onClick={handleDemoLogin}
              className="w-full py-2.5 rounded-xl bg-[#1E2B45] hover:bg-[#263757] text-[#5CA4F8] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#2CD48D]" />
              {getTranslation('auth_quick_demo_login', lang)}
            </button>

            {/* Saved Accounts on Device List */}
            {accounts.length > 0 && (
              <div className="pt-2 border-t border-slate-700/30">
                <p className="text-[11px] font-bold text-slate-400 mb-2">
                  {getTranslation('auth_saved_accounts', lang)} ({accounts.length})
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleAccountSelect(acc.id)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all cursor-pointer ${
                        driverProfile.telebirr_phone === acc.phone
                          ? 'bg-[#2CD48D]/15 border-[#2CD48D]/40 text-white'
                          : 'bg-[#131B2A] border-[#1E293B] text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#1C273C] flex items-center justify-center font-bold text-[#2CD48D]">
                          {acc.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold leading-tight">{acc.full_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{acc.phone}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#2CD48D] font-bold">
                        {driverProfile.telebirr_phone === acc.phone ? 'Current' : 'Switch'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {/* ================= MODE: CREATE ACCOUNT ================= */}
        {mode === 'CREATE_ACCOUNT' && (
          <form onSubmit={handleCreateAccountSubmit} className="mt-4 space-y-3">
            {/* Full Name */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {getTranslation('driver_full_name', lang)} *
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#2CD48D]">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={getTranslation('driver_name_placeholder', lang)}
                  className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden"
                  required
                />
              </div>
            </div>

            {/* Email Address for Cloud Sync */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {getTranslation('auth_email', lang)} (Supabase Cloud Account)
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#2CD48D]">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder={getTranslation('auth_email_placeholder', lang)}
                  className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-mono"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {getTranslation('auth_password', lang)} *
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#2CD48D]">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder={getTranslation('auth_password_placeholder', lang)}
                  minLength={6}
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
            </div>

            {/* Telebirr Phone */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {getTranslation('phone_number', lang)} (For Telebirr 127 SMS)
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#2CD48D]">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder={getTranslation('phone_placeholder', lang)}
                  className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-mono"
                />
              </div>
            </div>

            {/* Vehicle Type Selection */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {getTranslation('taxi_type', lang)}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'MINIBUS_TAXI', label: getTranslation('taxi_minibus', lang) },
                  { id: 'LADA_TAXI', label: getTranslation('taxi_lada', lang) },
                  { id: 'BAJAJ', label: getTranslation('taxi_bajaj', lang) },
                  { id: 'METER_RIDE', label: getTranslation('taxi_higer', lang) },
                ].map((vt) => (
                  <button
                    key={vt.id}
                    type="button"
                    onClick={() => setVehicleType(vt.id as any)}
                    className={`p-2 rounded-xl text-left text-xs font-bold transition-all border cursor-pointer ${
                      vehicleType === vt.id
                        ? 'bg-[#2CD48D]/20 border-[#2CD48D] text-[#2CD48D]'
                        : 'bg-[#131B2A] border-[#1E293B] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {vt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Plate & Route Row */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  {getTranslation('plate_number', lang)}
                </label>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#131B2A] border border-[#1E293B]">
                  <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="3 - A58291"
                    className="bg-transparent text-xs text-white placeholder-slate-500 w-full outline-hidden font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  {getTranslation('daily_target', lang)}
                </label>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#131B2A] border border-[#1E293B]">
                  <Target className="w-3.5 h-3.5 text-[#2CD48D] shrink-0" />
                  <input
                    type="number"
                    value={dailyTargetBirr}
                    onChange={(e) => setDailyTargetBirr(e.target.value)}
                    placeholder="1500"
                    className="bg-transparent text-xs text-white placeholder-slate-500 w-full outline-hidden font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Primary Route */}
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {getTranslation('route_corridor', lang)}
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#131B2A] border border-[#1E293B]">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  placeholder={getTranslation('route_placeholder', lang)}
                  className="bg-transparent text-xs text-white placeholder-slate-500 w-full outline-hidden"
                />
              </div>
            </div>

            {/* Create Account Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 py-3.5 rounded-2xl bg-[#2CD48D] hover:bg-[#25be7d] disabled:opacity-50 text-[#052115] font-black text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(44,212,141,0.3)] transition-all cursor-pointer active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account & Syncing Data...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{getTranslation('auth_create_and_drive', lang)}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ================= MODE: FORGOT PASSWORD ================= */}
        {mode === 'FORGOT_PASSWORD' && (
          <form onSubmit={handleForgotPasswordSubmit} className="mt-4 space-y-4">
            <p className="text-xs text-slate-300">
              Enter your registered driver email address. Supabase will send you secure recovery instructions to reset your password.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {getTranslation('auth_email', lang)}
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#2CD48D]">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="driver@example.com"
                  className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-mono"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-2xl bg-[#5CA4F8] hover:bg-[#4392f4] disabled:opacity-50 text-white font-black text-sm flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(92,164,248,0.3)] transition-all cursor-pointer active:scale-[0.99]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Instructions...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Send Reset Email</span>
                </>
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
          </form>
        )}
      </div>
    </div>
  );
};
