import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Code2,
  Database,
  Download,
  Edit3,
  RotateCcw,
  ShieldCheck,
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
import { formatMinorUnits } from '../../utils/formatters';
import { TripBirrLogo } from '../../components/TripBirrLogo';

interface SettingsScreenProps {
  onOpenDriverProfile: () => void;
  onOpenSmsSimulator?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onOpenDriverProfile,
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
    resetToSeedDatabase,
  } = useTripBirrStore();

  const isDark = settings.theme === 'dark';

  // Segmented control: 'SETTINGS' (default as shown on Page 5) or 'OVERVIEW'
  const [subTab, setSubTab] = useState<'OVERVIEW' | 'SETTINGS'>('SETTINGS');
  const [expandedPanel, setExpandedPanel] = useState<'NONE' | 'PRIVACY' | 'ABOUT'>('NONE');
  const [selectedKotlinFileIndex, setSelectedKotlinFileIndex] = useState(0);
  const [testResults, setTestResults] = useState(() =>
    runAutomatedVerificationSuite()
  );

  const passedCount = testResults.filter((r) => r.passed).length;

  const initials = driverProfile.full_name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const vehicleRoleLabel =
    driverProfile.vehicle_type === 'MINIBUS_TAXI' ||
    driverProfile.vehicle_type === 'LADA_TAXI'
      ? 'Taxi driver'
      : driverProfile.vehicle_type === 'METER_RIDE'
      ? 'Ride-hail driver'
      : driverProfile.vehicle_type === 'BAJAJ'
      ? 'Bajaj driver'
      : 'Driver';

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

  return (
    <div className="space-y-4">
      {/* Page Title (Matches Page 5: "Profile") */}
      <h1
        className={`text-[32px] font-extrabold tracking-tight pt-1 ${
          isDark ? 'text-white' : 'text-[#0F172A]'
        }`}
      >
        Profile
      </h1>

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
          {/* Appearance Card (Matches Page 5: Dark | Light toggle) */}
          <section
            className={`rounded-[26px] p-5 ${
              isDark
                ? 'bg-[#141B2D]'
                : 'bg-white border border-slate-200/80 shadow-xs'
            }`}
          >
            <h3
              className={`text-base font-extrabold mb-3.5 ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              Appearance
            </h3>

            <div
              className={`rounded-2xl p-1 grid grid-cols-2 ${
                isDark ? 'bg-[#0B0F1A]' : 'bg-slate-100'
              }`}
            >
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'dark' })}
                className={`py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#2CD48D] text-[#052115]'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                Dark
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ theme: 'light' })}
                className={`py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                  !isDark
                    ? 'bg-[#2CD48D] text-[#052115]'
                    : 'text-[#8E9BAE] hover:text-white'
                }`}
              >
                Light
              </button>
            </div>
          </section>

          {/* 7-Item Settings Menu Card (Matches Page 5 verbatim) */}
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

            {/* 6. Privacy */}
            <button
              type="button"
              onClick={() =>
                setExpandedPanel(expandedPanel === 'PRIVACY' ? 'NONE' : 'PRIVACY')
              }
              className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer hover:opacity-90"
            >
              <span
                className={`text-sm font-bold ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                Privacy
              </span>
              <span className="text-sm text-[#8E9BAE] flex items-center gap-1">
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>

            {/* 7. About TripBirr */}
            <button
              type="button"
              onClick={() =>
                setExpandedPanel(expandedPanel === 'ABOUT' ? 'NONE' : 'ABOUT')
              }
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

          {/* Expandable Privacy Sheet */}
          {expandedPanel === 'PRIVACY' && (
            <div
              className={`rounded-[24px] p-5 space-y-2 border ${
                isDark
                  ? 'bg-[#141B2D] border-[#2CD48D]/40 text-white'
                  : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#2CD48D]">
                <ShieldCheck className="w-4 h-4" />
                <span>100% Offline Privacy Guarantee</span>
              </div>
              <p className="text-xs text-[#8E9BAE] leading-relaxed">
                TripBirr strictly filters incoming Android broadcasts for Telebirr sender ID{' '}
                <strong className="text-white">127</strong>. Personal SMS messages from other senders are ignored immediately and raw SMS bodies are never stored in full or uploaded to any cloud server.
              </p>
            </div>
          )}

          {/* Expandable About TripBirr (App Icon + Automated Tests + RN/Kotlin Source) */}
          {expandedPanel === 'ABOUT' && (
            <div
              className={`rounded-[24px] p-5 space-y-4 border ${
                isDark
                  ? 'bg-[#141B2D] border-white/10'
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <TripBirrLogo size={54} shape="squircle" />
                  <div>
                    <p
                      className={`text-sm font-extrabold ${
                        isDark ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      TripBirr Android v1.0
                    </p>
                    <p className="text-xs text-[#8E9BAE]">
                      SQLite v{schemaVersion} · {passedCount}/{testResults.length} Unit Tests Passing
                    </p>
                  </div>
                </div>

                <a
                  href="/tripbirr-icon.svg"
                  download="tripbirr-icon.svg"
                  className="px-3 py-1.5 rounded-xl bg-[#2CD48D] text-[#052115] text-xs font-extrabold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Icon
                </a>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => speakPaymentAnnouncement(5000, 'Natnael Birhanu')}
                  className="px-3 py-1.5 rounded-xl bg-[#5CA4F8]/15 text-[#5CA4F8] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Test Voice Alert
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSqliteDump}
                  className="px-3 py-1.5 rounded-xl bg-[#2CD48D]/15 text-[#2CD48D] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5" />
                  SQLite .sql Dump
                </button>
                <button
                  type="button"
                  onClick={resetToSeedDatabase}
                  className="px-3 py-1.5 rounded-xl bg-[#F5BA36]/15 text-[#F5BA36] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Demo Data
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* OVERVIEW TAB: Driver Vehicle Details, App Icon, Automated Test Suite & RN/Kotlin Code */
        <div className="space-y-4">
          <section
            className={`rounded-[26px] p-5 space-y-3 ${
              isDark
                ? 'bg-[#141B2D]'
                : 'bg-white border border-slate-200/80 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3
                className={`text-base font-extrabold ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                Driver & Vehicle Details
              </h3>
              <button
                type="button"
                onClick={onOpenDriverProfile}
                className="px-3 py-1.5 rounded-xl bg-[#2CD48D] text-[#052115] text-xs font-extrabold cursor-pointer"
              >
                Edit Profile
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div
                className={`p-3 rounded-2xl ${
                  isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'
                }`}
              >
                <p className="text-[#8E9BAE]">SMS Greeting Name</p>
                <p
                  className={`font-bold font-mono mt-0.5 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Dear {driverProfile.sms_greeting_name}
                </p>
              </div>

              <div
                className={`p-3 rounded-2xl ${
                  isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'
                }`}
              >
                <p className="text-[#8E9BAE]">Vehicle Plate</p>
                <p
                  className={`font-bold font-mono mt-0.5 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {driverProfile.vehicle_plate}
                </p>
              </div>

              <div
                className={`p-3 rounded-2xl ${
                  isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'
                }`}
              >
                <p className="text-[#8E9BAE]">Primary Corridor</p>
                <p
                  className={`font-bold truncate mt-0.5 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {driverProfile.primary_corridor}
                </p>
              </div>

              <div
                className={`p-3 rounded-2xl ${
                  isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'
                }`}
              >
                <p className="text-[#8E9BAE]">Daily Target</p>
                <p className="font-bold font-mono text-[#2CD48D] mt-0.5">
                  {formatMinorUnits(
                    driverProfile.daily_target_minor_units,
                    settings.currency_display
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* React Native + Kotlin Source Inspector */}
          <section
            className={`rounded-[26px] p-5 space-y-3 ${
              isDark
                ? 'bg-[#141B2D]'
                : 'bg-white border border-slate-200/80 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-sm font-extrabold flex items-center gap-1.5 ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                <Code2 className="w-4 h-4 text-[#2CD48D]" />
                React Native & Kotlin Modules
              </span>
              <span className="text-xs font-mono text-[#2CD48D]">
                {passedCount}/{testResults.length} Tests Passed
              </span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {NATIVE_ANDROID_KOTLIN_FILES.map((file, idx) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedKotlinFileIndex(idx)}
                  className={`px-3 py-1 rounded-full text-[11px] font-mono whitespace-nowrap cursor-pointer ${
                    selectedKotlinFileIndex === idx
                      ? 'bg-[#2CD48D] text-[#052115] font-bold'
                      : 'bg-[#0B0F1A] text-[#8E9BAE]'
                  }`}
                >
                  {file.path.split('/').pop()}
                </button>
              ))}
            </div>

            <pre className="p-3 rounded-2xl bg-[#0B0F1A] text-[#DDF5E9] font-mono text-[10px] leading-relaxed overflow-x-auto max-h-60">
              <code>{NATIVE_ANDROID_KOTLIN_FILES[selectedKotlinFileIndex].code}</code>
            </pre>

            {/* Automated Verification Results */}
            <div className="pt-2 space-y-1.5 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#8E9BAE]">
                  Automated SMS & SQLite Verification Suite
                </span>
                <button
                  type="button"
                  onClick={() => setTestResults(runAutomatedVerificationSuite())}
                  className="text-[11px] font-bold text-[#2CD48D] cursor-pointer"
                >
                  Re-run
                </button>
              </div>
              {testResults.map((tc) => (
                <div
                  key={tc.id}
                  className="p-2 rounded-xl bg-[#0B0F1A] flex items-center justify-between text-[11px]"
                >
                  <span className="text-white truncate pr-2">
                    <strong className="text-[#2CD48D] font-mono">{tc.id}</strong> · {tc.name}
                  </span>
                  {tc.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2CD48D] shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-[#F87171] shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
