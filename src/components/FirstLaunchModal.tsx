import React, { useState } from 'react';
import {
  Bell,
  Car,
  Check,
  CreditCard,
  Info,
  MapPin,
  MessageSquare,
  Phone,
  Shield,
  Target,
  User,
  X,
} from 'lucide-react';
import { TripBirrLogo } from './TripBirrLogo';
import { useTripBirrStore } from '../store/useTripBirrStore';
import { getTranslation, Language } from '../utils/i18n';

interface FirstLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export const FirstLaunchModal: React.FC<FirstLaunchModalProps> = ({
  isOpen,
  onClose,
  onAccept,
}) => {
  const { settings, updateSettings, driverProfile, updateDriverProfile } = useTripBirrStore();
  const [step, setStep] = useState<'WELCOME' | 'SETUP'>('WELCOME');
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [activeLegalModal, setActiveLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [showManualNotice, setShowManualNotice] = useState(false);

  // Profile setup form state
  const [fullName, setFullName] = useState(driverProfile.full_name || '');
  const [phone, setPhone] = useState(driverProfile.telebirr_phone || '');
  const [vehicleType, setVehicleType] = useState(driverProfile.vehicle_type || 'MINIBUS_TAXI');
  const [vehiclePlate, setVehiclePlate] = useState(driverProfile.vehicle_plate || '');
  const [route, setRoute] = useState(driverProfile.primary_corridor || '');
  const [targetBirr, setTargetBirr] = useState(
    String(Math.round((driverProfile.daily_target_minor_units || 120000) / 100))
  );

  if (!isOpen) return null;

  const lang = (settings.language || 'en') as Language;
  const isAmharic = lang === 'am';

  const handleLanguageToggle = (selectedLang: Language) => {
    updateSettings({ language: selectedLang });
  };

  const handleAcceptWelcome = () => {
    if (!acceptedTerms) return;

    // Trigger Android Native runtime permissions
    try {
      (window as any).TripBirrNative?.requestPermissions?.();
    } catch {
      // ignore
    }

    updateSettings({
      sms_permission_status: 'GRANTED',
      location_permission_status: 'GRANTED',
    });

    setStep('SETUP');
  };

  const handleNotNow = () => {
    // Show polite notice that user can use the app manually
    setShowManualNotice(true);
    setTimeout(() => {
      setStep('SETUP');
    }, 2000);
  };

  const handleSaveProfileAndFinish = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const targetNum = parseInt(targetBirr, 10) || 1200;
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || 'Driver';

    updateDriverProfile({
      full_name: fullName.trim() || 'Biniyam Zenebe',
      sms_greeting_name: firstName,
      telebirr_phone: phone.trim() || '0911234567',
      vehicle_type: vehicleType as any,
      vehicle_plate: vehiclePlate.trim() || '3 - A58291 AA',
      primary_corridor: route.trim() || 'Ayat ↔ Megenagna',
      daily_target_minor_units: targetNum * 100,
      updated_at: new Date().toISOString(),
    });

    updateSettings({
      first_launch_completed: true,
    });

    onAccept();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full h-full sm:h-auto max-w-[430px] sm:rounded-3xl bg-[#090E17] text-white flex flex-col justify-between p-6 overflow-y-auto border border-[#1A2333] shadow-2xl relative">

        {/* STEP 1: WELCOME & PERMISSIONS */}
        {step === 'WELCOME' && (
          <>
            <div>
              <div className="flex items-center justify-between pt-2">
                <div className="w-14 h-14 rounded-2xl bg-[#111827] border border-[#1E293B] flex items-center justify-center shadow-lg p-1.5">
                  <TripBirrLogo size={42} shape="squircle" />
                </div>

                {/* Language Switcher Pill */}
                <div className="flex items-center bg-[#111827] border border-[#1E293B] rounded-full p-1 shadow-inner">
                  <button
                    type="button"
                    onClick={() => handleLanguageToggle('en')}
                    className={`px-3.5 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                      !isAmharic
                        ? 'bg-[#10B981] text-[#052115] shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageToggle('am')}
                    className={`px-3 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                      isAmharic
                        ? 'bg-[#10B981] text-[#052115] shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    አማ
                  </button>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="mt-7">
                <h1 className="text-[28px] font-black tracking-tight text-white leading-tight">
                  {getTranslation('welcome_title', lang)}
                </h1>
                <p className="text-slate-300 text-[13.5px] mt-2.5 leading-relaxed font-normal">
                  {getTranslation('welcome_subtitle', lang)}
                </p>
              </div>

              {/* Notice banner if "Not now" was clicked */}
              {showManualNotice && (
                <div className="mt-4 p-3.5 rounded-2xl bg-[#1E293B] border border-[#38BDF8]/40 flex items-start gap-3 text-xs text-[#38BDF8] animate-in fade-in duration-200">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="leading-snug">
                    {getTranslation('permission_not_now_notice', lang)}
                  </p>
                </div>
              )}

              {/* Three Transparency & Permission Cards */}
              <div className="space-y-3.5 mt-5">
                {/* Card 1: Read Telebirr SMS */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#131B2A] border border-[#1E293B]/80 hover:border-[#2CD48D]/30 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-[#1C273C] flex items-center justify-center shrink-0 border border-[#2A374F]">
                    <MessageSquare className="w-6 h-6 text-[#60A5FA]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-[15px] leading-tight">
                      {getTranslation('feature_sms_title', lang)}
                    </h3>
                    <p className="text-slate-400 text-xs mt-1 leading-snug">
                      {getTranslation('feature_sms_desc', lang)}
                    </p>
                  </div>
                </div>

                {/* Card 2: Location at Trip Start & End */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#131B2A] border border-[#1E293B]/80 hover:border-[#2CD48D]/30 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-[#1C273C] flex items-center justify-center shrink-0 border border-[#2A374F]">
                    <MapPin className="w-6 h-6 text-[#2CD48D]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-[15px] leading-tight">
                      {getTranslation('feature_gps_title', lang)}
                    </h3>
                    <p className="text-slate-400 text-xs mt-1 leading-snug">
                      {getTranslation('feature_gps_desc', lang)}
                    </p>
                  </div>
                </div>

                {/* Card 3: Privacy & Offline */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#131B2A] border border-[#1E293B]/80 hover:border-[#2CD48D]/30 transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-[#1C273C] flex items-center justify-center shrink-0 border border-[#2A374F]">
                    <Shield className="w-6 h-6 text-[#F5BA36]" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-[15px] leading-tight">
                      {getTranslation('feature_privacy_title', lang)}
                    </h3>
                    <p className="text-slate-400 text-xs mt-1 leading-snug">
                      {getTranslation('feature_privacy_desc', lang)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Acceptance Section */}
            <div className="mt-8 pt-4">
              {/* Checkbox */}
              <div
                onClick={() => setAcceptedTerms(!acceptedTerms)}
                className="flex items-start gap-3 cursor-pointer select-none group"
              >
                <div
                  className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center transition-all ${
                    acceptedTerms
                      ? 'bg-[#10B981] text-[#052115]'
                      : 'border-2 border-slate-500 bg-transparent group-hover:border-slate-300'
                  }`}
                >
                  {acceptedTerms && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
                </div>

                <p className="text-slate-300 text-[13px] leading-snug">
                  {isAmharic ? (
                    <>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveLegalModal('terms');
                        }}
                        className="text-[#38BDF8] hover:underline font-medium"
                      >
                        የአጠቃቀም ደንቦችን
                      </span>{' '}
                      እና{' '}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveLegalModal('privacy');
                        }}
                        className="text-[#38BDF8] hover:underline font-medium"
                      >
                        የግላዊነት ፖሊሲውን
                      </span>{' '}
                      እስማማለሁ። መረጃዬ በስልኬ ላይ ብቻ ይቀመጣል።
                    </>
                  ) : (
                    <>
                      I accept the{' '}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveLegalModal('terms');
                        }}
                        className="text-[#38BDF8] hover:underline font-medium"
                      >
                        Terms of Use
                      </span>{' '}
                      and{' '}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveLegalModal('privacy');
                        }}
                        className="text-[#38BDF8] hover:underline font-medium"
                      >
                        Privacy Policy
                      </span>
                      . My data stays on my phone.
                    </>
                  )}
                </p>
              </div>

              {/* Primary Button */}
              <button
                type="button"
                onClick={handleAcceptWelcome}
                disabled={!acceptedTerms}
                className={`w-full mt-5 py-4 rounded-2xl font-black text-base flex items-center justify-center transition-all cursor-pointer ${
                  acceptedTerms
                    ? 'bg-[#10B981] hover:bg-[#0EA271] text-[#052115] shadow-[0_10px_28px_rgba(16,185,129,0.35)] active:scale-[0.99]'
                    : 'bg-[#1A2535] text-slate-500 cursor-not-allowed'
                }`}
              >
                {getTranslation('accept_and_continue', lang)}
              </button>

              {/* Secondary "Not now" Button */}
              <button
                type="button"
                onClick={handleNotNow}
                className="w-full mt-3 py-2 text-slate-400 hover:text-slate-200 text-sm font-semibold text-center transition-colors cursor-pointer"
              >
                {getTranslation('not_now', lang)}
              </button>
            </div>
          </>
        )}

        {/* STEP 2: DRIVER REGISTRATION / LOGIN SETUP */}
        {step === 'SETUP' && (
          <form onSubmit={handleSaveProfileAndFinish} className="flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pt-2">
                <div className="w-12 h-12 rounded-2xl bg-[#111827] border border-[#1E293B] flex items-center justify-center p-1">
                  <TripBirrLogo size={36} shape="squircle" />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10B981]/15 text-[#10B981] text-xs font-extrabold">
                  <User className="w-3.5 h-3.5" />
                  <span>Step 2 of 2</span>
                </div>
              </div>

              <div className="mt-5">
                <h2 className="text-2xl font-black tracking-tight text-white leading-tight">
                  {getTranslation('setup_profile_title', lang)}
                </h2>
                <p className="text-slate-400 text-xs mt-1 leading-snug">
                  {getTranslation('setup_profile_subtitle', lang)}
                </p>
              </div>

              <div className="space-y-3.5 mt-5">
                {/* Full Name */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {getTranslation('driver_full_name', lang)}
                  </label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#10B981]">
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

                {/* Telebirr Phone */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {getTranslation('phone_number', lang)}
                  </label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#10B981]">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={getTranslation('phone_placeholder', lang)}
                      className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-mono"
                      required
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
                        className={`p-2.5 rounded-xl text-left text-xs font-bold transition-all border cursor-pointer ${
                          vehicleType === vt.id
                            ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                            : 'bg-[#131B2A] border-[#1E293B] text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {vt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Plate Number */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {getTranslation('plate_number', lang)}
                  </label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#10B981]">
                    <Car className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      placeholder={getTranslation('plate_placeholder', lang)}
                      className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-mono"
                    />
                  </div>
                </div>

                {/* Primary Route */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {getTranslation('route_corridor', lang)}
                  </label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#10B981]">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={route}
                      onChange={(e) => setRoute(e.target.value)}
                      placeholder={getTranslation('route_placeholder', lang)}
                      className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden"
                    />
                  </div>
                </div>

                {/* Daily Target */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {getTranslation('daily_target', lang)} (ETB)
                  </label>
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#131B2A] border border-[#1E293B] focus-within:border-[#10B981]">
                    <Target className="w-4 h-4 text-[#10B981] shrink-0" />
                    <input
                      type="number"
                      value={targetBirr}
                      onChange={(e) => setTargetBirr(e.target.value)}
                      placeholder="1200"
                      className="bg-transparent text-sm text-white placeholder-slate-500 w-full outline-hidden font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit & Enter App Button */}
            <div className="mt-6 pt-2">
              <button
                type="submit"
                className="w-full py-4 rounded-2xl font-black text-base bg-[#10B981] hover:bg-[#0EA271] text-[#052115] shadow-[0_10px_28px_rgba(16,185,129,0.35)] active:scale-[0.99] flex items-center justify-center transition-all cursor-pointer"
              >
                {getTranslation('save_and_start', lang)}
              </button>
            </div>
          </form>
        )}

        {/* In-Modal Legal Sheet Dialog */}
        {activeLegalModal && (
          <div className="absolute inset-0 z-50 bg-[#0B101B] p-6 rounded-3xl flex flex-col justify-between animate-in fade-in duration-150">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <Shield className="w-5 h-5 text-[#2CD48D]" />
                  <span>
                    {activeLegalModal === 'terms'
                      ? isAmharic ? 'የአጠቃቀም ደንቦች' : 'Terms of Use'
                      : isAmharic ? 'የግላዊነት ፖሊሲ' : 'Privacy Policy'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 text-slate-300 text-xs leading-relaxed space-y-3 overflow-y-auto max-h-[400px] pr-1">
                {activeLegalModal === 'terms' ? (
                  <>
                    <p>
                      <strong>1. Local Companion:</strong> TripBirr is an offline utility intended for drivers to parse official Telebirr payment notifications (Sender ID 127).
                    </p>
                    <p>
                      <strong>2. No Financial Custody:</strong> TripBirr does not initiate bank transfers, hold customer funds, or operate as a financial institution. All payments are executed within Telebirr by Ethio Telecom.
                    </p>
                    <p>
                      <strong>3. Driver Responsibility:</strong> Drivers remain solely responsible for verifying the authenticity of passengers and verifying physical trips.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>1. 100% Offline Storage:</strong> All passenger trip logs, payment amounts, and transaction records remain strictly stored on your device's local database.
                    </p>
                    <p>
                      <strong>2. Zero Inbox Scanning:</strong> The app only listens to incoming broadcast notifications from Telebirr short-code 127. Your personal SMS inbox is never uploaded or read.
                    </p>
                    <p>
                      <strong>3. Location Privacy:</strong> GPS coordinates are captured only at the discrete moment a trip is started or ended. There is no background route tracing when idle.
                    </p>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveLegalModal(null)}
              className="w-full py-3 mt-4 rounded-xl bg-[#1C273C] hover:bg-[#25334E] text-white font-bold text-sm cursor-pointer"
            >
              {isAmharic ? 'ተመለስ' : 'Close'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
