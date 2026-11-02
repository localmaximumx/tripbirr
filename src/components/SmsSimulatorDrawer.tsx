import React, { useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  MessageSquarePlus,
  Play,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useTripBirrStore } from '../store/useTripBirrStore';
import { parseTelebirrSms } from '../services/sms/smsParser';
import { validateParsedSms } from '../services/sms/smsValidation';
import { formatMinorUnits, getDriverFirstName } from '../utils/formatters';

interface SmsSimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_SMS_SCENARIOS = [
  {
    id: 'new_passenger',
    label: 'Incoming Passenger Payment (ETB 55.00)',
    senderId: '127',
    generateBody: (driverName: string) => {
      const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `Dear ${driverName}\n\nYou have received ETB 55.00 from Brook Tesfaye(2519****4920) on 01/11/2026 15:10:10. Your transaction number is DJL55${randSuffix}. Your current E-Money Account balance is ETB 5,295.00.\n\nThank you for using telebirr\n\nEthio telecom`;
    },
  },
  {
    id: 'prompt_exact',
    label: 'Master Prompt Spec SMS (Natnael Birhanu · ETB 50.00 · DJL25NAFRW)',
    senderId: '127',
    generateBody: (driverName: string) =>
      `Dear ${driverName}\n\nYou have received ETB 50.00 from Natnael Birhanu(2519****8747) on 21/10/2026 23:43:07. Your transaction number is DJL25NAFRW. Your current E-Money Account balance is ETB 332.62.\n\nThank you for using telebirr\n\nEthio telecom`,
  },
  {
    id: 'outgoing_payment',
    label: 'Outgoing Payment (Excluded from Driver Income)',
    senderId: '127',
    generateBody: (driverName: string) => {
      const randSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
      return `Dear ${driverName}\n\nYou have paid ETB 85.00 to Kaldis Coffee Bole(2519****1100) on 01/11/2026 15:14:00. Your transaction number is DJL85${randSuffix}. Your current E-Money Account balance is ETB 5,155.00.\n\nThank you for using telebirr\n\nEthio telecom`;
    },
  },
  {
    id: 'reversal_sms',
    label: 'Reversal of Transaction DJL88KMPQ2 (ETB 30.00)',
    senderId: '127',
    generateBody: (driverName: string) =>
      `Dear ${driverName}\n\nReversal of transaction DJL88KMPQ2: reversed ETB 30.00 from Selamawit Tadesse(2519****3319) on 01/11/2026 15:16:12. Your transaction number is DJL30REV88. Your current E-Money Account balance is ETB 5,125.00.\n\nThank you for using telebirr\n\nEthio telecom`,
  },
  {
    id: 'promo_sms',
    label: 'Promotional Broadcast (Ignored Non-Financial)',
    senderId: '127',
    generateBody: () =>
      `Dear Customer, Download telebirr SuperApp and win up to ETB 100,000 in our weekly lucky draw promo! Thank you for using telebirr. Ethio telecom`,
  },
  {
    id: 'missing_tx_id',
    label: 'Missing Transaction ID (Tests Fallback Fingerprint)',
    senderId: '127',
    generateBody: (driverName: string) =>
      `Dear ${driverName}, You have received ETB 25.00 from Tigist Hailu(2519****7182) on 01/11/2026 15:18:00. Thank you for using telebirr.`,
  },
];

export const SmsSimulatorDrawer: React.FC<SmsSimulatorDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    driverProfile,
    settings,
    receiveIncomingSmsBroadcast,
    isJsRuntimeSimulatedOffline,
    toggleSimulatedJsRuntimeState,
    nativeSmsQueue,
    drainNativeSmsQueue,
  } = useTripBirrStore();

  const isDark = settings.theme === 'dark';
  const driverFirstName = getDriverFirstName(driverProfile);

  const [senderId, setSenderId] = useState('127');
  const [smsBody, setSmsBody] = useState(() =>
    PRESET_SMS_SCENARIOS[0].generateBody(getDriverFirstName(driverProfile))
  );
  const [lastResult, setLastResult] = useState<{
    status: string;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const livePreview = parseTelebirrSms({ senderId, body: smsBody });
  const liveValidation = validateParsedSms(livePreview);

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    const res = receiveIncomingSmsBroadcast({
      senderId,
      body: smsBody,
      receivedAt: new Date().toISOString(),
    });
    setLastResult(res);
  };

  const handleSimulateMultiPassengerBurst = () => {
    const passengers = [
      { name: 'Marta Bekele', phone: '2519****1029', amt: '35.00' },
      { name: 'Samson Tadesse', phone: '2519****5831', amt: '35.00' },
      { name: 'Elias Girma', phone: '2519****9942', amt: '35.00' },
    ];
    for (const p of passengers) {
      const txId = `DJL${Math.floor(100000 + Math.random() * 900000)}`;
      const body = `Dear ${driverFirstName}\n\nYou have received ETB ${p.amt} from ${p.name}(${p.phone}) on 01/11/2026 15:20:05. Your transaction number is ${txId}. Your current E-Money Account balance is ETB 5,345.00.\n\nThank you for using telebirr\n\nEthio telecom`;
      receiveIncomingSmsBroadcast({
        senderId: '127',
        body,
        receivedAt: new Date().toISOString(),
      });
    }
    setLastResult({
      status: 'BURST_PROCESSED',
      message: 'Dispatched 3 rapid passenger Telebirr 127 SMS messages (ETB 35.00 × 3).',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-[440px] sm:max-w-xl h-full overflow-y-auto p-5 sm:p-6 border-l flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-250 ${
          isDark
            ? 'bg-[#141B2D] border-white/10 text-white'
            : 'bg-white border-slate-200 text-[#0F172A]'
        }`}
      >
        <div className="space-y-5">
          <div
            className={`flex items-center justify-between pb-4 border-b ${
              isDark ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            <div>
              <h2 className="text-lg font-extrabold">
                Telebirr 127 SMS Broadcast Testbench
              </h2>
              <p className="text-xs text-[#8E9BAE] mt-0.5">
                Simulates Kotlin <span className="font-mono">SmsReceiver.kt</span> intercepting{' '}
                <span className="font-mono">android.provider.Telephony.SMS_RECEIVED</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#8E9BAE] hover:opacity-80 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Native Background Queue Simulation */}
          <div
            className={`p-4 rounded-2xl border ${
              isDark
                ? 'bg-[#0B0F1A] border-white/10'
                : 'bg-[#F7F9FC] border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-[#5CA4F8]" />
                  JS Runtime Background / Killed State Simulation
                </p>
                <p className="text-xs text-[#8E9BAE] mt-0.5">
                  {isJsRuntimeSimulatedOffline
                    ? `JS Runtime Paused — Incoming 127 SMS messages are queued in native SQLite (${nativeSmsQueue.length} queued)`
                    : 'JS Runtime Active — Native BroadcastReceiver forwards immediately to SQLite'}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleSimulatedJsRuntimeState}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isJsRuntimeSimulatedOffline
                    ? 'bg-[#F5BA36] text-[#111827]'
                    : isDark
                    ? 'bg-[#141B2D] text-white border border-white/10'
                    : 'bg-white text-[#0F172A] border border-slate-200'
                }`}
              >
                {isJsRuntimeSimulatedOffline ? 'Wake App & Drain Queue' : 'Simulate App Closed'}
              </button>
            </div>

            {nativeSmsQueue.length > 0 && (
              <div
                className={`mt-3 pt-3 border-t flex items-center justify-between ${
                  isDark ? 'border-white/10' : 'border-slate-200'
                }`}
              >
                <span className="text-xs font-mono text-[#F5BA36]">
                  {nativeSmsQueue.length} message(s) waiting in NativeSmsQueueDbHelper
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const count = drainNativeSmsQueue();
                    setLastResult({
                      status: 'QUEUE_DRAINED',
                      message: `Drained ${count} queued Telebirr SMS message(s) into SQLite transactions.`,
                    });
                  }}
                  className="text-xs font-extrabold text-[#2CD48D] underline cursor-pointer"
                >
                  Drain Queue Now
                </button>
              </div>
            )}
          </div>

          {/* Preset Scenarios */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold">
                1. Load Telebirr SMS Template
              </span>
              <button
                type="button"
                onClick={handleSimulateMultiPassengerBurst}
                className="text-xs font-extrabold text-[#2CD48D] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Fire 3-Passenger Burst (ETB 35 × 3)
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_SMS_SCENARIOS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSenderId(preset.senderId);
                    setSmsBody(preset.generateBody(driverFirstName));
                    setLastResult(null);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-[#0B0F1A] border-white/10 hover:border-[#5CA4F8]'
                      : 'bg-[#F7F9FC] border-slate-200 hover:border-[#5CA4F8]'
                  }`}
                >
                  <p className="text-xs font-bold line-clamp-1">
                    {preset.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* SMS Input Form */}
          <form onSubmit={handleBroadcast} className="space-y-3">
            <div className="flex gap-3">
              <div className="w-28">
                <label className="block text-xs font-bold mb-1">
                  Sender ID
                </label>
                <input
                  type="text"
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  className={`w-full h-10 px-3 rounded-xl border font-mono text-sm ${
                    isDark
                      ? 'bg-[#0B0F1A] border-white/10 text-white'
                      : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
                  }`}
                />
              </div>
              <div className="flex-1 flex items-end">
                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-[#2CD48D] text-[#052115] text-xs font-extrabold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-[#052115]" />
                  Broadcast Incoming SMS to Receiver
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">
                Raw SMS Body
              </label>
              <textarea
                rows={5}
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                className={`w-full p-3 rounded-xl border font-mono text-xs focus:outline-none focus:border-[#2CD48D] ${
                  isDark
                    ? 'bg-[#0B0F1A] border-white/10 text-white'
                    : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
                }`}
              />
            </div>
          </form>

          {lastResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                isDark
                  ? 'bg-[#0B0F1A] border-[#2CD48D]/40 text-white'
                  : 'bg-[#E8F1FF]/60 border-[#5CA4F8]/50 text-[#0F172A]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-[#2CD48D] shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-extrabold font-mono text-[#2CD48D]">
                  {lastResult.status}:{' '}
                </span>
                <span>{lastResult.message}</span>
              </div>
            </div>
          )}

          {/* Live Independent Parser Preview */}
          <div
            className={`p-4 rounded-2xl border space-y-2.5 ${
              isDark
                ? 'bg-[#0B0F1A] border-white/10'
                : 'bg-[#F7F9FC] border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold">
                Live Parser & Classifier Inspection
              </span>
              <span className="text-xs font-mono font-bold text-[#5CA4F8]">
                {livePreview.messageType}
              </span>
            </div>

            <div
              className={`grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-t pt-2.5 ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}
            >
              <div className="text-[#8E9BAE]">Sender Verified:</div>
              <div className="font-mono text-right">
                {liveValidation.isSenderValid ? 'Yes (127)' : 'Rejected'}
              </div>

              <div className="text-[#8E9BAE]">Extracted Amount:</div>
              <div className="font-mono text-right text-[#2CD48D] font-bold">
                {livePreview.amountMinorUnits
                  ? `${formatMinorUnits(livePreview.amountMinorUnits)} (${livePreview.amountMinorUnits} minor)`
                  : '—'}
              </div>

              <div className="text-[#8E9BAE]">Sender Name:</div>
              <div className="font-mono text-right truncate">
                {livePreview.senderName || '—'}
              </div>

              <div className="text-[#8E9BAE]">Sender Phone:</div>
              <div className="font-mono text-right">
                {livePreview.senderPhone || '—'}
              </div>

              <div className="text-[#8E9BAE]">Transaction ID:</div>
              <div className="font-mono text-right">
                {livePreview.transactionId || `Fallback (${livePreview.messageFingerprint})`}
              </div>

              <div className="text-[#8E9BAE]">Date & Time:</div>
              <div className="font-mono text-right">
                {livePreview.transactionDate || '—'} · {livePreview.transactionTime || '—'}
              </div>

              <div className="text-[#8E9BAE]">E-Money Balance:</div>
              <div className="font-mono text-right">
                {livePreview.accountBalanceMinorUnits !== null
                  ? formatMinorUnits(livePreview.accountBalanceMinorUnits)
                  : '—'}
              </div>

              <div className="text-[#8E9BAE]">Counts as Income:</div>
              <div className="font-mono text-right font-bold">
                {livePreview.isIncomingIncome ? 'YES (+Income)' : 'NO (0.00 Impact)'}
              </div>
            </div>

            {liveValidation.errors.length > 0 && (
              <div
                className={`pt-2 border-t flex items-center gap-1.5 text-xs text-[#F87171] ${
                  isDark ? 'border-white/10' : 'border-slate-200'
                }`}
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{liveValidation.errors[0]}</span>
              </div>
            )}
          </div>
        </div>

        <div
          className={`pt-4 border-t flex justify-end ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#182E6F] text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer"
          >
            <MessageSquarePlus className="w-4 h-4 text-[#5CA4F8]" />
            Done Testing
          </button>
        </div>
      </div>
    </div>
  );
};
