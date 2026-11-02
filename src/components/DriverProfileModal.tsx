import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  X,
} from 'lucide-react';
import { useTripBirrStore } from '../store/useTripBirrStore';
import { DriverProfileRecord } from '../database/schema';
import { parseAmountToMinorUnits } from '../services/sms/smsParser';
import { getTranslation, Language } from '../utils/i18n';

interface DriverProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { driverProfile, settings, updateDriverProfile } = useTripBirrStore();

  const isDark = settings.theme === 'dark';
  const lang = (settings.language || 'en') as Language;

  const [fullName, setFullName] = useState(driverProfile.full_name);
  const [telebirrPhone, setTelebirrPhone] = useState(driverProfile.telebirr_phone);
  const [accountType, setAccountType] = useState<
    DriverProfileRecord['account_type']
  >(driverProfile.account_type);
  const [vehicleType, setVehicleType] = useState<
    DriverProfileRecord['vehicle_type']
  >(driverProfile.vehicle_type);
  const [vehiclePlate, setVehiclePlate] = useState(driverProfile.vehicle_plate);
  const [primaryCorridor, setPrimaryCorridor] = useState(
    driverProfile.primary_corridor
  );
  const [subCity, setSubCity] = useState(driverProfile.sub_city);
  const [dailyTargetInput, setDailyTargetInput] = useState(
    (driverProfile.daily_target_minor_units / 100).toFixed(2)
  );
  const [licenseNumber, setLicenseNumber] = useState(
    driverProfile.driver_license_number
  );
  const [savedBanner, setSavedBanner] = useState(false);

  // Pull-down gesture state
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartYRef = useRef<number | null>(null);

  // Sync form fields whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setFullName(driverProfile.full_name);
      setTelebirrPhone(driverProfile.telebirr_phone);
      setAccountType(driverProfile.account_type);
      setVehicleType(driverProfile.vehicle_type);
      setVehiclePlate(driverProfile.vehicle_plate);
      setPrimaryCorridor(driverProfile.primary_corridor);
      setSubCity(driverProfile.sub_city);
      setDailyTargetInput(
        (driverProfile.daily_target_minor_units / 100).toFixed(2)
      );
      setLicenseNumber(driverProfile.driver_license_number);
      setSavedBanner(false);
      setDragOffsetY(0);
    }
  }, [isOpen, driverProfile]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedName = fullName.trim() || 'Abebe Kebede';
    const firstName = cleanedName.split(/\s+/)[0] || 'Abebe';
    const parsedTarget = parseAmountToMinorUnits(dailyTargetInput);

    updateDriverProfile({
      full_name: cleanedName,
      sms_greeting_name: firstName,
      telebirr_phone: telebirrPhone.trim() || '+251 91 234 8747',
      account_type: accountType,
      vehicle_type: vehicleType,
      vehicle_plate: vehiclePlate.trim() || 'Code 3 - A58291 AA',
      primary_corridor: primaryCorridor.trim() || 'Bole ↔ Piassa',
      sub_city: subCity.trim() || 'Bole, Addis Ababa',
      daily_target_minor_units: parsedTarget ? parsedTarget.minor : 200000,
      driver_license_number: licenseNumber.trim() || 'AA-DL-904821',
    });
    setSavedBanner(true);
    setTimeout(() => {
      setSavedBanner(false);
      onClose();
    }, 350);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartYRef.current === null) return;
    const delta = e.touches[0].clientY - dragStartYRef.current;
    if (delta > 0) {
      setDragOffsetY(delta);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 85) {
      onClose();
    } else {
      setDragOffsetY(0);
    }
    dragStartYRef.current = null;
  };

  const initials = (fullName || driverProfile.full_name)
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translateY(${dragOffsetY}px)`,
          transition:
            dragOffsetY > 0
              ? 'none'
              : 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className={`w-full max-w-[430px] mx-auto max-h-[92vh] overflow-y-auto rounded-t-[30px] border-t px-6 pb-7 pt-2 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-250 ${
          isDark
            ? 'bg-[#141B2D] border-white/10 text-white'
            : 'bg-white border-slate-200 text-[#0F172A]'
        }`}
      >
        {/* Pull-Down Drag Handle */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={onClose}
          className="w-full py-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none"
          title="Swipe down or tap to close"
        >
          <div className="w-11 h-1.5 rounded-full bg-[#8E9BAE]/40" />
        </div>

        {/* Header */}
        <div
          className={`flex items-center justify-between pb-3.5 border-b ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#2CD48D] text-[#052115] font-extrabold text-base flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-lg font-extrabold">{getTranslation('edit_profile_title', lang)}</h2>
              <p className="text-xs text-[#8E9BAE]">
                {driverProfile.username ? `@${driverProfile.username} · ` : ''}
                {getTranslation('edit_profile_desc', lang)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-[#8E9BAE] hover:opacity-80 cursor-pointer"
            aria-label="Close driver profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedBanner && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
              isDark
                ? 'bg-[#0B0F1A] border-[#2CD48D]/40 text-white'
                : 'bg-[#E8F1FF]/60 border-[#5CA4F8]/50 text-[#0F172A]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-[#2CD48D]" />
            <span>{lang === 'am' ? 'መረጃው ተስተካክሏል!' : 'Profile updated!'}</span>
          </div>
        )}

        {/* Direct Edit Form */}
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 gap-3">
            {driverProfile.username && (
              <div>
                <label className="block font-bold mb-1 text-[#8E9BAE]">
                  {lang === 'am' ? 'የተጠቃሚ ስም (ልዩ መለያ)' : 'Username (Unique handle)'}
                </label>
                <div
                  className={`w-full h-11 px-3.5 rounded-xl border text-sm font-mono font-bold flex items-center gap-1.5 ${
                    isDark
                      ? 'bg-[#0B0F1A]/60 border-white/10 text-[#2CD48D]'
                      : 'bg-[#F7F9FC] border-slate-200 text-[#159960]'
                  }`}
                >
                  <span>@</span>
                  <span>{driverProfile.username}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block font-bold mb-1 text-[#8E9BAE]">
                {lang === 'am' ? 'የአሽከርካሪ ሙሉ ስም' : 'Driver Name (Shown in Home Greeting & Profile)'}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Biniyam Zenebe"
                className={`w-full h-11 px-3.5 rounded-xl border text-sm font-semibold focus:outline-none focus:border-[#2CD48D] ${
                  isDark
                    ? 'bg-[#0B0F1A] border-white/10 text-white'
                    : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
                }`}
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-[#8E9BAE]">
                {getTranslation('telebirr_phone', lang)}
              </label>
              <input
                type="text"
                value={telebirrPhone}
                onChange={(e) => setTelebirrPhone(e.target.value)}
                className={`w-full h-11 px-3.5 rounded-xl border font-mono text-sm focus:outline-none focus:border-[#2CD48D] ${
                  isDark
                    ? 'bg-[#0B0F1A] border-white/10 text-white'
                    : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
                }`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold mb-1 text-[#8E9BAE]">
                  {getTranslation('account_type', lang)}
                </label>
                <select
                  value={accountType}
                  onChange={(e) =>
                    setAccountType(
                      e.target.value as DriverProfileRecord['account_type']
                    )
                  }
                  className={`w-full h-11 px-3 rounded-xl border text-xs font-semibold focus:outline-none focus:border-[#2CD48D] ${
                    isDark
                      ? 'bg-[#0B0F1A] border-white/10 text-white'
                      : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
                  }`}
                >
                  <option value="PERSONAL_EMONEY">{lang === 'am' ? 'የግል ኢ-ገንዘብ (Personal)' : 'Personal E-Money'}</option>
                  <option value="MERCHANT_AGENT">{lang === 'am' ? 'ነጋዴ / ወኪል (Merchant)' : 'Driver / Merchant'}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 text-[#8E9BAE]">
                  {getTranslation('vehicle_type', lang)}
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) =>
                    setVehicleType(
                      e.target.value as DriverProfileRecord['vehicle_type']
                    )
                  }
                  className={`w-full h-11 px-3 rounded-xl border text-xs font-semibold focus:outline-none focus:border-[#2CD48D] ${
                    isDark
                      ? 'bg-[#0B0F1A] border-white/10 text-white'
                      : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
                  }`}
                >
                  <option value="MINIBUS_TAXI">{getTranslation('taxi_minibus', lang)}</option>
                  <option value="LADA_TAXI">{getTranslation('taxi_lada', lang)}</option>
                  <option value="METER_RIDE">{lang === 'am' ? 'የሜትር / አፕ ራይድ' : 'Meter / App Ride'}</option>
                  <option value="BAJAJ">{getTranslation('taxi_bajaj', lang)}</option>
                  <option value="PRIVATE">{lang === 'am' ? 'የግል ተሽከርካሪ' : 'Private Vehicle'}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-bold mb-1 text-[#8E9BAE]">
                  {getTranslation('vehicle_plate', lang)}
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className={`w-full h-11 px-3 rounded-xl border font-mono text-sm focus:outline-none focus:border-[#2CD48D] ${
                    isDark
                      ? 'bg-[#0B0F1A] border-white/10 text-white'
                      : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
                  }`}
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-[#8E9BAE]">
                  {getTranslation('daily_target_etb', lang)}
                </label>
                <input
                  type="text"
                  value={dailyTargetInput}
                  onChange={(e) => setDailyTargetInput(e.target.value)}
                  className={`w-full h-11 px-3 rounded-xl border font-mono text-sm focus:outline-none focus:border-[#2CD48D] ${
                    isDark
                      ? 'bg-[#0B0F1A] border-white/10 text-white'
                      : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1 text-[#8E9BAE]">
                {getTranslation('primary_corridor', lang)}
              </label>
              <input
                type="text"
                value={primaryCorridor}
                onChange={(e) => setPrimaryCorridor(e.target.value)}
                className={`w-full h-11 px-3.5 rounded-xl border text-xs font-semibold focus:outline-none focus:border-[#2CD48D] ${
                  isDark
                    ? 'bg-[#0B0F1A] border-white/10 text-white'
                    : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
                }`}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                isDark
                  ? 'border-white/10 text-[#8E9BAE] hover:text-white'
                  : 'border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              {getTranslation('cancel', lang)}
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2CD48D] text-[#052115] text-xs font-extrabold cursor-pointer hover:opacity-95 transition-opacity"
            >
              {getTranslation('save_changes', lang)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
