import React, { useState } from 'react';
import {
  CheckCircle2,
  Code2,
  Database,
  Download,
  RotateCcw,
  ShieldCheck,
  Volume2,
  XCircle,
} from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import { runAutomatedVerificationSuite } from '../../__tests__/smsAndDatabaseSuite';
import { NATIVE_ANDROID_KOTLIN_FILES } from '../../constants/androidKotlinSources';
import { exportSqliteSqlDump } from '../../database/database';
import { speakPaymentAnnouncement } from '../../services/notifications/notificationService';

export const SettingsScreen: React.FC = () => {
  const {
    schemaVersion,
    appliedMigrations,
    trips,
    transactions,
    smsProcessingRecords,
    settings,
    updateSettings,
    setSmsPermissionStatus,
    setLocationPermissionStatus,
    resetToSeedDatabase,
  } = useTripBirrStore();

  const [selectedKotlinFileIndex, setSelectedKotlinFileIndex] = useState(0);
  const [testResults, setTestResults] = useState(() =>
    runAutomatedVerificationSuite()
  );

  const passedCount = testResults.filter((r) => r.passed).length;

  const handleDownloadSqliteDump = () => {
    const sqlDump = exportSqliteSqlDump({
      schemaVersion,
      appliedMigrations,
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#172B25] dark:text-[#EDF6F0]">
          Settings, Permissions & Native Android Architecture
        </h1>
        <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
          Configure payment notifications, voice announcements, permissions, and inspect the Kotlin + SQLite engine
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preferences, Notifications & Permissions (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Payment Notification & Voice Settings (Section 6) */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3EAE5] dark:border-[#253831]">
              <div>
                <h2 className="text-base font-bold text-[#172B25] dark:text-[#EDF6F0]">
                  Payment Notification & Voice Announcement
                </h2>
                <p className="text-xs text-[#75847D] dark:text-[#94A8A0]">
                  Hands-free feedback when Telebirr 127 payments arrive while driving
                </p>
              </div>
              <button
                type="button"
                onClick={() => speakPaymentAnnouncement(5000, 'Natnael Birhanu')}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#DDF5E9] dark:bg-[#1D352D] text-[#123C35] dark:text-[#43C99A] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Test Voice TTS
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {(
                [
                  {
                    key: 'notification_sound',
                    label: 'Notification Chime Sound',
                    desc: 'Play offline two-tone audio alert on valid incoming payment',
                  },
                  {
                    key: 'notification_vibration',
                    label: 'Vibration Feedback',
                    desc: 'Vibrate phone when payment from sender 127 is detected',
                  },
                  {
                    key: 'voice_announcement',
                    label: 'Voice Announcement (Text-to-Speech)',
                    desc: 'Speak "Payment received, 50 birr from Natnael Birhanu"',
                  },
                  {
                    key: 'notification_preview',
                    label: 'Show Sender & Amount Banner Preview',
                    desc: 'Display compact banner with one-tap Active Trip association',
                  },
                  {
                    key: 'auto_suggest_trip_association',
                    label: 'Suggest Active Trip Association',
                    desc: 'Prompt to associate incoming payment when a trip is ACTIVE',
                  },
                  {
                    key: 'silent_mode',
                    label: 'Silent Driving Mode',
                    desc: 'Mute all sounds and voice announcements while recording silently',
                  },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-4 py-2 border-b border-[#E3EAE5]/60 dark:border-[#253831]/60 cursor-pointer"
                >
                  <div>
                    <p className="font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                      {item.label}
                    </p>
                    <p className="text-[#75847D] dark:text-[#94A8A0] mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(settings[item.key])}
                    onChange={(e) =>
                      updateSettings({ [item.key]: e.target.checked })
                    }
                    className="w-5 h-5 accent-[#16866A] rounded cursor-pointer shrink-0"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* App Configuration & Theme */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] space-y-4">
            <h2 className="text-base font-bold text-[#172B25] dark:text-[#EDF6F0] pb-3 border-b border-[#E3EAE5] dark:border-[#253831]">
              Application Appearance & Working Name
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                  Configurable Project Name
                </label>
                <input
                  type="text"
                  value={settings.app_name}
                  onChange={(e) =>
                    updateSettings({ app_name: e.target.value || 'TripBirr' })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                  Currency Display Format
                </label>
                <select
                  value={settings.currency_display}
                  onChange={(e) =>
                    updateSettings({
                      currency_display: e.target.value as 'ETB' | 'Birr',
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831]"
                >
                  <option value="ETB">ETB (e.g., ETB 50.00)</option>
                  <option value="Birr">Birr (e.g., Birr 50.00)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                  Android Permission Simulation Controls
                </p>
                <p className="text-xs text-[#75847D] dark:text-[#94A8A0]">
                  Test how the app behaves when RECEIVE_SMS is granted vs denied
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSmsPermissionStatus(
                      settings.sms_permission_status === 'GRANTED'
                        ? 'DENIED'
                        : 'GRANTED'
                    )
                  }
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                    settings.sms_permission_status === 'GRANTED'
                      ? 'bg-[#DDF5E9] dark:bg-[#1D352D] text-[#123C35] dark:text-[#43C99A] border-[#16866A]/30'
                      : 'bg-[#D9534F]/15 text-[#D9534F] border-[#D9534F]'
                  }`}
                >
                  RECEIVE_SMS: {settings.sms_permission_status}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLocationPermissionStatus(
                      settings.location_permission_status === 'GRANTED'
                        ? 'DENIED'
                        : 'GRANTED'
                    )
                  }
                  className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#E3EAE5] dark:border-[#253831]"
                >
                  GPS: {settings.location_permission_status}
                </button>
              </div>
            </div>
          </div>

          {/* SQLite Database Management */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#16866A] dark:text-[#43C99A]" />
                <h2 className="text-base font-bold text-[#172B25] dark:text-[#EDF6F0]">
                  Offline SQLite Database & Privacy
                </h2>
              </div>
              <span className="text-xs font-mono text-[#75847D]">
                Schema v{schemaVersion}
              </span>
            </div>

            <p className="text-xs text-[#75847D] dark:text-[#94A8A0]">
              All financial records are stored locally in normalized tables (
              <span className="font-mono">trips</span>,{' '}
              <span className="font-mono">transactions</span>,{' '}
              <span className="font-mono">sms_processing_records</span>,{' '}
              <span className="font-mono">settings</span>). No internet connection or cloud account is required.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleDownloadSqliteDump}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#123C35] dark:bg-[#43C99A] text-white dark:text-[#101A17] text-xs font-semibold flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export SQLite .sql Dump
              </button>
              <button
                type="button"
                onClick={resetToSeedDatabase}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#E3EAE5] dark:border-[#253831] text-xs font-semibold text-[#75847D] hover:text-[#172B25] dark:hover:text-[#EDF6F0] flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Demo SQLite Data
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Automated Unit Test Suite & Native Kotlin Files (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Automated Verification Test Suite (Section 19) */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3EAE5] dark:border-[#253831]">
              <div>
                <h2 className="text-base font-bold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#22A06B] dark:text-[#43C99A]" />
                  SMS Parser & Database Unit Test Suite ({passedCount}/{testResults.length} Passed)
                </h2>
                <p className="text-xs text-[#75847D] dark:text-[#94A8A0]">
                  Verifies Section 5 & Section 19 requirements against live parser and financial logic
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTestResults(runAutomatedVerificationSuite())}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#F5F7F5] dark:bg-[#101A17] text-xs font-semibold text-[#16866A] dark:text-[#43C99A]"
              >
                Re-run Suite
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-[#E3EAE5] dark:divide-[#253831] pr-1">
              {testResults.map((test) => (
                <div key={test.id} className="py-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-1.5">
                      {test.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#22A06B] shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#D9534F] shrink-0" />
                      )}
                      <span className="font-mono text-[#75847D]">{test.id}</span>
                      <span>{test.name}</span>
                    </span>
                    <span className="font-mono text-[11px] text-[#22A06B] dark:text-[#43C99A] shrink-0">
                      {test.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#75847D] dark:text-[#94A8A0] font-mono mt-0.5 pl-5">
                    {test.details}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Native Android Kotlin Source Code Inspector */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#16866A] dark:text-[#43C99A]" />
                Native Android Kotlin Modules (android/app/src/main/...)
              </h2>
              <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
                Production Kotlin BroadcastReceiver and React Native bridge modules generated in workspace
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {NATIVE_ANDROID_KOTLIN_FILES.map((file, idx) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedKotlinFileIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                    selectedKotlinFileIndex === idx
                      ? 'bg-[#123C35] text-white dark:bg-[#43C99A] dark:text-[#101A17] font-semibold'
                      : 'bg-[#F5F7F5] dark:bg-[#101A17] text-[#75847D]'
                  }`}
                >
                  {file.path.split('/').pop()}
                </button>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831]">
              <p className="text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                {NATIVE_ANDROID_KOTLIN_FILES[selectedKotlinFileIndex].title}
              </p>
              <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
                {NATIVE_ANDROID_KOTLIN_FILES[selectedKotlinFileIndex].responsibility}
              </p>
              <pre className="mt-3 p-3 rounded-lg bg-[#101A17] text-[#EDF6F0] font-mono text-[11px] overflow-x-auto max-h-64">
                {NATIVE_ANDROID_KOTLIN_FILES[selectedKotlinFileIndex].code}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
