import React, { useState } from 'react';
import {
  Award,
  Car,
  CheckCircle2,
  Edit3,
  Phone,
  ShieldCheck,
  Target,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useTripBirrStore } from '../store/useTripBirrStore';
import { DriverProfileRecord, TripStatus } from '../database/schema';
import { computeFinancialReport } from '../services/reports/reportService';
import { parseAmountToMinorUnits } from '../services/sms/smsParser';
import { formatMinorUnits } from '../utils/formatters';

interface DriverProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VEHICLE_LABELS: Record<DriverProfileRecord['vehicle_type'], string> = {
  MINIBUS_TAXI: 'Minibus / HiAce Taxi (12-Seat)',
  LADA_TAXI: 'Blue-White Lada / Sedan Taxi',
  METER_RIDE: 'Meter / App Ride Vehicle',
  BAJAJ: 'Bajaj Three-Wheeler',
  PRIVATE: 'Private Commercial Vehicle',
};

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { driverProfile, trips, transactions, settings, updateDriverProfile } =
    useTripBirrStore();

  const currency = settings.currency_display;
  const [isEditing, setIsEditing] = useState(false);

  const [fullName, setFullName] = useState(driverProfile.full_name);
  const [smsGreetingName, setSmsGreetingName] = useState(
    driverProfile.sms_greeting_name
  );
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

  if (!isOpen) return null;

  const allTimeReport = computeFinancialReport(
    trips,
    transactions,
    'ALL_TIME',
    '2026-10-21'
  );
  const todayReport = computeFinancialReport(
    trips,
    transactions,
    'TODAY',
    '2026-10-21'
  );

  // Extract latest E-Money Account balance from most recent Telebirr 127 SMS
  const latestBalanceTx = transactions.find(
    (tx) => tx.account_balance_minor_units !== null
  );
  const latestBalanceMinor = latestBalanceTx?.account_balance_minor_units ?? null;

  const targetProgressPct = Math.min(
    100,
    Math.round(
      (todayReport.combinedNetIncomeMinorUnits /
        Math.max(100, driverProfile.daily_target_minor_units)) *
        100
    )
  );

  const completedTripsTotal = trips.filter(
    (t) => t.status === TripStatus.COMPLETED
  ).length;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTarget = parseAmountToMinorUnits(dailyTargetInput);
    updateDriverProfile({
      full_name: fullName.trim() || 'Biniyam Zenebe',
      sms_greeting_name: smsGreetingName.trim() || 'Biniyam',
      telebirr_phone: telebirrPhone.trim() || '+251 911 408 747',
      account_type: accountType,
      vehicle_type: vehicleType,
      vehicle_plate: vehiclePlate.trim() || 'Code 3 - A58291 AA',
      primary_corridor: primaryCorridor.trim() || '4 Kilo ↔ Piassa',
      sub_city: subCity.trim() || 'Arada, Addis Ababa',
      daily_target_minor_units: parsedTarget ? parsedTarget.minor : 60000,
      driver_license_number: licenseNumber.trim() || 'AA-DL-904821',
    });
    setIsEditing(false);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const initials = driverProfile.full_name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] p-6 shadow-xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E3EAE5] dark:border-[#253831]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#123C35] text-[#43C99A] font-bold text-base flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#172B25] dark:text-[#EDF6F0]">
                {driverProfile.full_name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#75847D] dark:text-[#94A8A0]">
                <span className="font-mono">{driverProfile.telebirr_phone}</span>
                <span aria-hidden="true">·</span>
                <span>{driverProfile.vehicle_plate}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-1.5 hover:border-[#16866A] cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#16866A] dark:text-[#43C99A]" />
                Edit Profile
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#75847D] hover:text-[#172B25] dark:hover:text-[#EDF6F0]"
              aria-label="Close driver profile"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {savedBanner && (
          <div className="p-3 rounded-xl bg-[#DDF5E9] dark:bg-[#1D352D] border border-[#16866A]/30 flex items-center gap-2 text-xs text-[#123C35] dark:text-[#EDF6F0]">
            <CheckCircle2 className="w-4 h-4 text-[#16866A] dark:text-[#43C99A]" />
            <span>Driver profile updated in offline SQLite database.</span>
          </div>
        )}

        {/* Telebirr Wallet & Lifetime Driver Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-[#123C35] text-white">
            <div className="flex items-center gap-1.5 text-xs text-[#DDF5E9]/80">
              <Wallet className="w-3.5 h-3.5 text-[#43C99A]" />
              <span>E-Money Balance (SMS 127)</span>
            </div>
            <p className="text-lg font-bold font-mono tabular-nums text-[#43C99A] mt-1.5">
              {latestBalanceMinor !== null
                ? formatMinorUnits(latestBalanceMinor, currency)
                : '—'}
            </p>
            <p className="text-[11px] text-[#DDF5E9]/70 mt-0.5">
              From last payment notification
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831]">
            <div className="flex items-center gap-1.5 text-xs text-[#75847D] dark:text-[#94A8A0]">
              <Award className="w-3.5 h-3.5 text-[#16866A] dark:text-[#43C99A]" />
              <span>Lifetime Collections</span>
            </div>
            <p className="text-lg font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-1.5">
              {formatMinorUnits(allTimeReport.combinedNetIncomeMinorUnits, currency)}
            </p>
            <p className="text-[11px] text-[#75847D] dark:text-[#94A8A0] mt-0.5 font-mono">
              {completedTripsTotal} completed trips
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831]">
            <div className="flex items-center gap-1.5 text-xs text-[#75847D] dark:text-[#94A8A0]">
              <Target className="w-3.5 h-3.5 text-[#16866A] dark:text-[#43C99A]" />
              <span>Today&apos;s Goal ({targetProgressPct}%)</span>
            </div>
            <p className="text-lg font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-1.5">
              {formatMinorUnits(driverProfile.daily_target_minor_units, currency)}
            </p>
            <div className="w-full h-1.5 rounded-full bg-[#E3EAE5] dark:bg-[#253831] mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#16866A] dark:bg-[#43C99A]"
                style={{ width: `${targetProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* View or Edit Form */}
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                  Driver Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                  Telebirr SMS Greeting Name (&quot;Dear ...&quot;)
                </label>
                <input
                  type="text"
                  value={smsGreetingName}
                  onChange={(e) => setSmsGreetingName(e.target.value)}
                  placeholder="e.g., Biniyam"
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                  Telebirr Phone Number
                </label>
                <input
                  type="text"
                  value={telebirrPhone}
                  onChange={(e) => setTelebirrPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                  Telebirr Account Type
                </label>
                <select
                  value={accountType}
                  onChange={(e) =>
                    setAccountType(
                      e.target.value as DriverProfileRecord['account_type']
                    )
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831]"
                >
                  <option value="PERSONAL_EMONEY">Personal E-Money Account</option>
                  <option value="MERCHANT_AGENT">Telebirr Driver / Merchant</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                  Vehicle Type
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) =>
                    setVehicleType(
                      e.target.value as DriverProfileRecord['vehicle_type']
                    )
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831]"
                >
                  <option value="MINIBUS_TAXI">Minibus / HiAce Taxi (12-Seat)</option>
                  <option value="LADA_TAXI">Blue-White Lada / Sedan Taxi</option>
                  <option value="METER_RIDE">Meter / App Ride Vehicle</option>
                  <option value="BAJAJ">Bajaj Three-Wheeler</option>
                  <option value="PRIVATE">Private Commercial Vehicle</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                  Vehicle License Plate
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                  Primary Addis Ababa Corridor
                </label>
                <input
                  type="text"
                  value={primaryCorridor}
                  onChange={(e) => setPrimaryCorridor(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                  Daily Target (ETB)
                </label>
                <input
                  type="text"
                  value={dailyTargetInput}
                  onChange={(e) => setDailyTargetInput(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E3EAE5] dark:border-[#253831] text-xs font-semibold text-[#75847D]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#16866A] dark:bg-[#43C99A] text-white dark:text-[#101A17] text-xs font-bold"
              >
                Save Driver Profile
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-2 border-b border-[#E3EAE5] dark:border-[#253831]">
              <span className="text-[#75847D] dark:text-[#94A8A0] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#16866A] dark:text-[#43C99A]" />
                SMS Recipient Match Name
              </span>
              <span className="font-mono font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                Dear {driverProfile.sms_greeting_name}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#E3EAE5] dark:border-[#253831]">
              <span className="text-[#75847D] dark:text-[#94A8A0] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#16866A] dark:text-[#43C99A]" />
                Registered Telebirr Number
              </span>
              <span className="font-mono font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                {driverProfile.telebirr_phone} ({driverProfile.account_type.replace('_', ' ')})
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#E3EAE5] dark:border-[#253831]">
              <span className="text-[#75847D] dark:text-[#94A8A0] flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-[#16866A] dark:text-[#43C99A]" />
                Vehicle & Plate Number
              </span>
              <span className="font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                {VEHICLE_LABELS[driverProfile.vehicle_type]} ·{' '}
                <span className="font-mono">{driverProfile.vehicle_plate}</span>
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#E3EAE5] dark:border-[#253831]">
              <span className="text-[#75847D] dark:text-[#94A8A0]">
                Primary Operating Corridor
              </span>
              <span className="font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                {driverProfile.primary_corridor}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#E3EAE5] dark:border-[#253831]">
              <span className="text-[#75847D] dark:text-[#94A8A0]">
                Sub-City & License ID
              </span>
              <span className="font-mono text-[#172B25] dark:text-[#EDF6F0]">
                {driverProfile.sub_city} · {driverProfile.driver_license_number}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] flex items-center gap-2 text-[11px] text-[#75847D] dark:text-[#94A8A0]">
              <ShieldCheck className="w-4 h-4 text-[#16866A] dark:text-[#43C99A] shrink-0" />
              <span>
                100% Offline Profile: Stored locally in the Android SQLite{' '}
                <span className="font-mono">driver_profile</span> table. Never uploaded to external servers.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
