import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Code2,
  Database,
  Download,
  Edit3,
  EyeOff,
  Lock,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Shield,
  Sparkles,
  Trash2,
  Volume2,
  XCircle,
} from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import { runAutomatedVerificationSuite } from '../../__tests__/smsAndDatabaseSuite';
import { NATIVE_ANDROID_KOTLIN_FILES } from '../../constants/androidKotlinSources';
import { CURRENT_DEMO_ISO_DATE, exportSqliteSqlDump } from '../../database/database';
import { speakPaymentAnnouncement } from '../../services/notifications/notificationService';
import {
  generateTransactionsCsv,
  triggerCsvDownload,
} from '../../services/reports/reportService';
import { formatMinorUnits, getDriverFirstName } from '../../utils/formatters';
import { getTranslation, Language } from '../../utils/i18n';
import { TripBirrLogo } from '../../components/TripBirrLogo';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';

interface SettingsScreenProps {
  onOpenDriverProfile: () => void;
  onOpenFirstLaunch?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onOpenDriverProfile,
  onOpenFirstLaunch,
}) => {
  const {
    schemaVersion,
    appliedMigrations,
    driverProfile,
    trips,
    transactions,
    smsProcessingRecords,
    settings,
    updateSettings,
    setSmsPermissionStatus,
    setLocationPermissionStatus,
    clearSmsAuditLogs,
    resetToSeedDatabase,
  } = useTripBirrStore();

  const isDark = settings.theme === 'dark';

  // Segmented control: 'SETTINGS' (default as shown on Page 5) or 'OVERVIEW'
  const [subTab, setSubTab] = useState<'OVERVIEW' | 'SETTINGS'>('SETTINGS');
  // Dedicated sub-sections for 'PRIVACY' and 'ABOUT' (only visible when clicked, replacing the main profile view)
  const [activeSection, setActiveSection] = useState<'MAIN' | 'PRIVACY'>('MAIN');
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [selectedKotlinFileIndex, setSelectedKotlinFileIndex] = useState(0);
  const [logsClearedFeedback, setLogsClearedFeedback] = useState(false);
  const [testResults, setTestResults] = useState(() =>
    runAutomatedVerificationSuite()
  );

  const passedCount = testResults.filter((r) => r.passed).length;
  const driverFirstName = getDriverFirstName(driverProfile);

  const initials =
    driverProfile.full_name
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'TB';

  const vehicleRoleLabel =
    driverProfile.vehicle_type === 'MINIBUS_TAXI' ||
    driverProfile.vehicle_type === 'LADA_TAXI'
      ? 'Taxi driver'
      : driverProfile.vehicle_type === 'METER_RIDE'
      ? 'Ride-hail driver'
      : driverProfile.vehicle_type === 'BAJAJ'
      ? 'Bajaj driver'
      : 'Driver';

  const activePrivacyCount = [
    settings.privacy_hide_balance,
    settings.privacy_mask_sender_names,
    settings.privacy_mask_phones,
    settings.privacy_hide_popup_amounts,
  ].filter(Boolean).length;

  const handleExportCsvData = () => {
    const csv = generateTransactionsCsv(transactions, trips);
    triggerCsvDownload(`tripbirr_export_${CURRENT_DEMO_ISO_DATE}.csv`, csv);
  };

  const handleDownloadSqliteDump = () => {
    const sqlDump = exportSqliteSqlDump({
      schemaVersion,
      appliedMigrations,
      driverProfile,
      trips,
      transactions,
      smsProcessingRecords,
      settings,
    });
    const blob = new Blob([sqlDump], { type: 'application/sql;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tripbirr_offline_database.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearSmsLogs = () => {
    clearSmsAuditLogs();
    setLogsClearedFeedback(true);
    setTimeout(() => setLogsClearedFeedback(false), 2500);
  };

  // ============================================================================
  // SEPARATE DEDICATED SECTION 1: PRIVACY
  // ============================================================================
  if (activeSection === 'PRIVACY') {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* Top Header: Back Button + Section Title + Dark/Light Mode Toggle on Same Horizontal Line */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setActiveSection('MAIN')}
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                isDark
                  ? 'bg-[#141B2D] text-white hover:bg-[#1E2B45] border border-white/10'
                  : 'bg-white text-[#0F172A] hover:bg-slate-100 border border-slate-200 shadow-xs'
              }`}
              aria-label="Back to Profile"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1
              className={`text-[28px] font-extrabold tracking-tight truncate ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              Privacy
            </h1>
          </div>

          <ThemeToggleButton />
        </div>

        {/* Dedicated Privacy & Passenger Shield Controls Card */}
        <div
          className={`rounded-[26px] p-5 space-y-4 border ${
            isDark
              ? 'bg-[#141B2D] border-white/10 text-white'
              : 'bg-white border-slate-200 text-[#0F172A] shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#2CD48D]">
                <ShieldCheck className="w-4 h-4" />
                <span>Privacy &amp; Passenger Shield Controls</span>
              </div>
              <p className="text-xs text-[#8E9BAE] mt-1 leading-relaxed">
                Customize what is visible on your screen when passengers sit next to you in the cab. All preferences are saved automatically.
              </p>
            </div>
          </div>

          {/* Interactive Privacy Toggles */}
          <div
            className={`rounded-2xl divide-y border overflow-hidden ${
              isDark
                ? 'bg-[#0B0F1A] border-white/10 divide-white/5'
                : 'bg-[#F7F9FC] border-slate-200/80 divide-slate-200/60'
            }`}
          >
            {/* Toggle 1: Hide Earnings Balance on Home Screen */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold">
                  Hide earnings balance on Home
                </p>
                <p className="text-xs text-[#8E9BAE] mt-0.5">
                  Masks your daily total and Telebirr/cash breakdown as ****
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.privacy_hide_balance}
                onClick={() =>
                  updateSettings({
                    privacy_hide_balance: !settings.privacy_hide_balance,
                  })
                }
                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                  settings.privacy_hide_balance
                    ? 'bg-[#2CD48D]'
                    : isDark
                    ? 'bg-[#1E2B45]'
                    : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform ${
                    settings.privacy_hide_balance
                      ? 'translate-x-5 bg-[#052115]'
                      : 'translate-x-0 bg-white'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Mask Passenger Last Names */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold">
                  Mask passenger last names
                </p>
                <p className="text-xs text-[#8E9BAE] mt-0.5">
                  Shows payer names as &ldquo;Natnael B.&rdquo; across lists &amp; receipts
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.privacy_mask_sender_names}
                onClick={() =>
                  updateSettings({
                    privacy_mask_sender_names:
                      !settings.privacy_mask_sender_names,
                  })
                }
                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                  settings.privacy_mask_sender_names
                    ? 'bg-[#2CD48D]'
                    : isDark
                    ? 'bg-[#1E2B45]'
                    : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform ${
                    settings.privacy_mask_sender_names
                      ? 'translate-x-5 bg-[#052115]'
                      : 'translate-x-0 bg-white'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 3: Mask Passenger Phone Numbers */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold">
                  Redact passenger phone numbers
                </p>
                <p className="text-xs text-[#8E9BAE] mt-0.5">
                  Hides middle digits (2519••••••47) inside transaction sheets
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.privacy_mask_phones}
                onClick={() =>
                  updateSettings({
                    privacy_mask_phones: !settings.privacy_mask_phones,
                  })
                }
                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                  settings.privacy_mask_phones
                    ? 'bg-[#2CD48D]'
                    : isDark
                    ? 'bg-[#1E2B45]'
                    : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform ${
                    settings.privacy_mask_phones
                      ? 'translate-x-5 bg-[#052115]'
                      : 'translate-x-0 bg-white'
                  }`}
                />
              </button>
            </div>

            {/* Toggle 4: Hide Amounts in Pop-up Banner */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold">
                  Discreet pop-up payment alerts
                </p>
                <p className="text-xs text-[#8E9BAE] mt-0.5">
                  Confirms incoming payment without showing the exact ETB amount
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.privacy_hide_popup_amounts}
                onClick={() =>
                  updateSettings({
                    privacy_hide_popup_amounts:
                      !settings.privacy_hide_popup_amounts,
                  })
                }
                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                  settings.privacy_hide_popup_amounts
                    ? 'bg-[#2CD48D]'
                    : isDark
                    ? 'bg-[#1E2B45]'
                    : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full transition-transform ${
                    settings.privacy_hide_popup_amounts
                      ? 'translate-x-5 bg-[#052115]'
                      : 'translate-x-0 bg-white'
                }`}
                />
              </button>
            </div>
          </div>

          {/* SMS Audit Log Sanitizer + Sender 127 Hardware Guarantee */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-xs text-[#8E9BAE]">
              <span className="font-bold text-[#5CA4F8]">
                {smsProcessingRecords.length}
              </span>{' '}
              local SMS audit fingerprints cached
            </div>

            <button
              type="button"
              onClick={handleClearSmsLogs}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors ${
                logsClearedFeedback
                  ? 'bg-[#2CD48D] text-[#052115]'
                  : isDark
                  ? 'bg-[#1E2B45] text-white hover:bg-[#273758]'
                  : 'bg-slate-100 text-[#0F172A] hover:bg-slate-200'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {logsClearedFeedback ? 'Audit Logs Cleared' : 'Clear SMS Logs'}
              </span>
            </button>
          </div>

          <div
            className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
              isDark
                ? 'bg-[#0B0F1A]/80 border-white/5 text-[#8E9BAE]'
                : 'bg-slate-50 border-slate-200/60 text-slate-600'
            }`}
          >
            <strong className={isDark ? 'text-white' : 'text-[#0F172A]'}>
              Strict Sender-127 Isolation:
            </strong>{' '}
            TripBirr only inspects incoming SMS broadcasts from official Ethio telecom Telebirr short-code{' '}
            <span className="font-mono font-bold text-[#2CD48D]">127</span>. Personal messages, contacts, and bank OTPs are never read, stored, or transmitted off your phone.
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SEPARATE DEDICATED SECTION 2: ABOUT TRIPBIRR
  // ============================================================================
  // ============================================================================
  // MAIN PROFILE & SETTINGS SCREEN
  // ============================================================================
  const lang = (settings.language || 'en') as Language;

  return (
    <div className="space-y-4 pt-3">
      {/* Page Title + Dark/Light Mode Toggle on the Same Horizontal Line */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <h1
          className={`text-[32px] font-extrabold tracking-tight ${
            isDark ? 'text-white' : 'text-[#0F172A]'
          }`}
        >
          Profile
        </h1>
        <ThemeToggleButton />
      </div>

      {/* Driver Identity Card (Matches Page 5 verbatim) */}
      <div
        onClick={onOpenDriverProfile}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpenDriverProfile();
        }}
        className={`rounded-[26px] p-5 flex items-center justify-between gap-4 cursor-pointer transition-transform active:scale-[0.99] ${
          isDark
            ? 'bg-[#141B2D]'
            : 'bg-white border border-slate-200/80 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-16 rounded-[20px] bg-[#2CD48D] text-[#052115] font-extrabold text-2xl flex items-center justify-center shrink-0">
            {initials}
          </div>

          <div className="min-w-0">
            <h2
              className={`text-xl font-extrabold truncate ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              {driverProfile.full_name}
            </h2>
            <p className="text-xs font-medium text-[#8E9BAE] truncate mt-0.5">
              {driverProfile.telebirr_phone} · {vehicleRoleLabel}
            </p>
          </div>
        </div>

        <Edit3 className="w-4 h-4 text-[#8E9BAE] shrink-0" />
      </div>

      {/* Segmented Control: Overview | Settings (Matches Page 5) */}
      <div
        className={`rounded-2xl p-1.5 grid grid-cols-2 ${
          isDark
            ? 'bg-[#141B2D]'
            : 'bg-white border border-slate-200/80 shadow-xs'
        }`}
      >
        <button
          type="button"
          onClick={() => setSubTab('OVERVIEW')}
          className={`py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
            subTab === 'OVERVIEW'
              ? isDark
                ? 'bg-[#1E2B45] text-white'
                : 'bg-slate-100 text-[#0F172A]'
              : 'text-[#8E9BAE]'
          }`}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => setSubTab('SETTINGS')}
          className={`py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
            subTab === 'SETTINGS'
              ? isDark
                ? 'bg-[#1E2B45] text-white'
                : 'bg-slate-100 text-[#0F172A]'
              : 'text-[#8E9BAE]'
          }`}
        >
          Settings
        </button>
      </div>

      {subTab === 'SETTINGS' ? (
        <>
          {/* 7-Item Settings Menu Card */}
          <section
            className={`rounded-[26px] overflow-hidden divide-y ${
              isDark
                ? 'bg-[#141B2D] divide-white/5'
                : 'bg-white border border-slate-200/80 divide-slate-100 shadow-xs'
            }`}
          >
            {/* 1. Language */}
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  language: settings.language === 'en' ? 'am' : 'en',
                })
              }
              className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer hover:opacity-90"
            >
              <span
                className={`text-sm font-bold ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                Language
              </span>
              <span className="text-sm text-[#8E9BAE] flex items-center gap-1">
                {settings.language === 'en' ? 'English' : 'አማርኛ (Amharic)'}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>

            {/* 2. Notifications */}
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  notification_sound: !settings.notification_sound,
                  voice_announcement: !settings.voice_announcement,
                })
              }
              className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer hover:opacity-90"
            >
              <span
                className={`text-sm font-bold ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                Notifications
              </span>
              <span className="text-sm text-[#8E9BAE] flex items-center gap-1">
                {settings.notification_sound ? 'On' : 'Off'}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>

            {/* 3. Location access */}
            <button
              type="button"
              onClick={() =>
                setLocationPermissionStatus(
                  settings.location_permission_status === 'GRANTED'
                    ? 'DENIED'
                    : 'GRANTED'
                )
              }
              className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer hover:opacity-90"
            >
              <span
                className={`text-sm font-bold ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                Location access
              </span>
              <span className="text-sm text-[#8E9BAE] flex items-center gap-1">
                {settings.location_permission_status === 'GRANTED'
                  ? 'Allowed'
                  : 'Denied'}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>

            {/* 4. SMS access (sender 127) */}
            <button
              type="button"
              onClick={() =>
                setSmsPermissionStatus(
                  settings.sms_permission_status === 'GRANTED'
                    ? 'DENIED'
                    : 'GRANTED'
                )
              }
              className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer hover:opacity-90"
            >
              <span
                className={`text-sm font-bold ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                SMS access (sender 127)
              </span>
              <span className="text-sm text-[#8E9BAE] flex items-center gap-1">
                {settings.sms_permission_status === 'GRANTED'
                  ? 'Allowed'
                  : 'Denied'}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>

            {/* 5. Export data */}
            <button
              type="button"
              onClick={handleExportCsvData}
              className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer hover:opacity-90"
            >
              <span
                className={`text-sm font-bold ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                Export data
              </span>
              <span className="text-sm text-[#8E9BAE] flex items-center gap-1">
                CSV
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>

            {/* 6. Privacy — Opens Separate Privacy Section */}
            <button
              type="button"
              onClick={() => setActiveSection('PRIVACY')}
              className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer hover:opacity-90"
            >
              <span
                className={`text-sm font-bold ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                Privacy
              </span>
              <span className="text-sm text-[#8E9BAE] flex items-center gap-1.5">
                {activePrivacyCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#2CD48D]/15 text-[#2CD48D]">
                    {activePrivacyCount} active
                  </span>
                )}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>

            {/* 7. About TripBirr — Opens Separate About TripBirr Section */}
            <button
              type="button"
              onClick={() => setShowAboutModal(true)}
              className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer hover:opacity-90"
            >
              <span
                className={`text-sm font-bold ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                About TripBirr
              </span>
              <span className="text-sm text-[#8E9BAE] flex items-center gap-1">
                v1.0
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>
          </section>
        </>
      ) : (
        /* OVERVIEW TAB: Driver Vehicle Details, App Icon, Automated Test Suite & RN/Kotlin Code */
        <div className="space-y-4">
          {/* Unified Complete Driver & Vehicle Profile Summary */}
          <section
            className={`rounded-[26px] p-5 space-y-4 ${
              isDark
                ? 'bg-[#141B2D]'
                : 'bg-white border border-slate-200/80 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between pb-1">
              <div>
                <h3
                  className={`text-base font-extrabold ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  {lang === 'am' ? 'የአሽከርካሪ እና ተሽከርካሪ ዝርዝር መረጃ' : 'Driver & Vehicle Profile'}
                </h3>
                <p className="text-xs text-[#8E9BAE] mt-0.5">
                  {lang === 'am' ? 'የተመዘገበ ሙሉ መረጃ' : 'Complete driver registration and ledger setup'}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenDriverProfile}
                className="px-3.5 py-1.5 rounded-xl bg-[#2CD48D] hover:bg-[#25B87B] text-[#052115] text-xs font-extrabold transition-all cursor-pointer shadow-xs"
              >
                {lang === 'am' ? 'መገለጫ አርትዕ' : 'Edit Profile'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'}`}>
                <p className="text-[#8E9BAE]">{lang === 'am' ? 'ሙሉ ስም' : 'Full Name'}</p>
                <p className={`font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {driverProfile.full_name}
                </p>
              </div>

              <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'}`}>
                <p className="text-[#8E9BAE]">{lang === 'am' ? 'የቴሌብር ስልክ' : 'Telebirr Phone'}</p>
                <p className={`font-bold font-mono mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {driverProfile.telebirr_phone}
                </p>
              </div>

              <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'}`}>
                <p className="text-[#8E9BAE]">{lang === 'am' ? 'የተሽከርካሪ አይነት' : 'Vehicle Type'}</p>
                <p className={`font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {vehicleRoleLabel}
                </p>
              </div>

              <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'}`}>
                <p className="text-[#8E9BAE]">{lang === 'am' ? 'የሰሌዳ ቁጥር' : 'Vehicle Plate'}</p>
                <p className={`font-bold font-mono mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {driverProfile.vehicle_plate}
                </p>
              </div>

              <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'}`}>
                <p className="text-[#8E9BAE]">{lang === 'am' ? 'ዋና መስመር' : 'Primary Corridor'}</p>
                <p className={`font-bold truncate mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {driverProfile.primary_corridor}
                </p>
              </div>

              <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'}`}>
                <p className="text-[#8E9BAE]">{lang === 'am' ? 'ክፍለ ከተማ' : 'Sub-City'}</p>
                <p className={`font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {driverProfile.sub_city || 'Addis Ababa'}
                </p>
              </div>

              <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'}`}>
                <p className="text-[#8E9BAE]">{lang === 'am' ? 'የመንጃ ፈቃድ' : 'License Number'}</p>
                <p className={`font-bold font-mono mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {driverProfile.driver_license_number || 'AA-DL-82910'}
                </p>
              </div>

              <div className={`p-3 rounded-2xl ${isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'}`}>
                <p className="text-[#8E9BAE]">{lang === 'am' ? 'የአካውንት አይነት' : 'Account Type'}</p>
                <p className="font-bold mt-0.5 text-[#2CD48D]">
                  {driverProfile.account_type === 'PERSONAL_EMONEY'
                    ? lang === 'am'
                      ? 'የግል ኢ-ገንዘብ (Personal)'
                      : 'Personal E-Money'
                    : lang === 'am'
                    ? 'ነጋዴ / ወኪል (Merchant)'
                    : 'Merchant / Agent'}
                </p>
              </div>

              <div className={`p-3 rounded-2xl col-span-2 ${isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8E9BAE]">{lang === 'am' ? 'የቀን ገቢ ግብ' : 'Daily Earnings Target'}</p>
                    <p className="font-extrabold font-mono text-base text-[#2CD48D] mt-0.5">
                      {formatMinorUnits(
                        driverProfile.daily_target_minor_units,
                        settings.currency_display
                      )}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-[#8E9BAE]">
                    <p>{lang === 'am' ? 'የኤስኤምኤስ ሰላምታ' : 'SMS Greeting'}</p>
                    <p className={`font-bold font-mono mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Dear {driverFirstName}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Self-Contained About TripBirr Modal Dialog */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className={`w-full max-w-md rounded-3xl p-6 space-y-4 border shadow-2xl relative ${
            isDark ? 'bg-[#0F172A] border-white/10 text-white' : 'bg-white border-slate-200 text-[#0F172A]'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-3">
                <TripBirrLogo size={42} shape="squircle" />
                <div>
                  <h3 className="text-lg font-extrabold flex items-center gap-2">
                    <span>TripBirr</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#2CD48D]/20 text-[#2CD48D]">
                      v1.0.0
                    </span>
                  </h3>
                  <p className="text-xs text-[#8E9BAE]">Smart Telebirr &amp; Cash Fare Ledger</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#8E9BAE] leading-relaxed">
              Purpose-built for Ethiopian taxi, minibus, Lada, ride-hail, and Bajaj drivers. Eliminates verification delays and fare disputes by automatically capturing incoming Telebirr (127) SMS payments, linking them to GPS routes, and calculating cash and digital revenue 100% offline.
            </p>

            <div className="space-y-2 text-xs">
              <div className={`p-3 rounded-xl ${isDark ? 'bg-[#1E293B]' : 'bg-slate-50'}`}>
                <p className="font-bold text-[#2CD48D]">100% Offline Ledger</p>
                <p className="text-[11px] text-[#8E9BAE] mt-0.5">Your trip logs and balances never leave your phone.</p>
              </div>
              <div className={`p-3 rounded-xl ${isDark ? 'bg-[#1E293B]' : 'bg-slate-50'}`}>
                <p className="font-bold text-[#5CA4F8]">Official 127 SMS Detection</p>
                <p className="text-[11px] text-[#8E9BAE] mt-0.5">Detects authentic receipts; personal SMS messages are never touched.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAboutModal(false)}
              className="w-full py-3 rounded-xl bg-[#2CD48D] hover:bg-[#25B87B] text-[#052115] font-extrabold text-sm transition-all cursor-pointer"
            >
              {lang === 'am' ? 'ዝጋ' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
