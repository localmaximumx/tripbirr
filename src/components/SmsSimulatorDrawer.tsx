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
import { formatMinorUnits } from '../utils/formatters';

interface SmsSimulatorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_SMS_SCENARIOS = [
  {
    id: 'new_passenger',
    label: 'Incoming Passenger Payment (ETB 55.00)',
    senderId: '127',
    generateBody: () => {
      const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `Dear Biniyam\n\nYou have received ETB 55.00 from Brook Tesfaye(2519****4920) on 21/10/2026 23:51:10. Your transaction number is DJL55${randSuffix}. Your current E-Money Account balance is ETB 387.62.\n\nThank you for using telebirr\n\nEthio telecom`;
    },
  },
  {
    id: 'prompt_exact',
    label: 'Master Prompt Spec SMS (Natnael Birhanu · ETB 50.00 · DJL25NAFRW)',
    senderId: '127',
    generateBody: () =>
      `Dear Biniyam\n\nYou have received ETB 50.00 from Natnael Birhanu(2519****8747) on 21/10/2026 23:43:07. Your transaction number is DJL25NAFRW. Your current E-Money Account balance is ETB 332.62.\n\nThank you for using telebirr\n\nEthio telecom`,
  },
  {
    id: 'outgoing_payment',
    label: 'Outgoing Payment (Excluded from Driver Income)',
    senderId: '127',
    generateBody: () => {
      const randSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
      return `Dear Biniyam\n\nYou have paid ETB 85.00 to Kaldis Coffee Bole(2519****1100) on 21/10/2026 23:54:00. Your transaction number is DJL85${randSuffix}. Your current E-Money Account balance is ETB 302.62.\n\nThank you for using telebirr\n\nEthio telecom`;
    },
  },
  {
    id: 'reversal_sms',
    label: 'Reversal of Transaction DJL88KMPQ2 (ETB 30.00)',
    senderId: '127',
    generateBody: () =>
      `Dear Biniyam\n\nReversal of transaction DJL88KMPQ2: reversed ETB 30.00 from Selamawit Tadesse(2519****3319) on 21/10/2026 23:56:12. Your transaction number is DJL30REV88. Your current E-Money Account balance is ETB 302.62.\n\nThank you for using telebirr\n\nEthio telecom`,
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
    generateBody: () =>
      `Dear Biniyam, You have received ETB 25.00 from Tigist Hailu(2519****7182) on 21/10/2026 23:58:00. Thank you for using telebirr.`,
  },
];

export const SmsSimulatorDrawer: React.FC<SmsSimulatorDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    receiveIncomingSmsBroadcast,
    isJsRuntimeSimulatedOffline,
    toggleSimulatedJsRuntimeState,
    nativeSmsQueue,
    drainNativeSmsQueue,
  } = useTripBirrStore();

  const [senderId, setSenderId] = useState('127');
  const [smsBody, setSmsBody] = useState(() => PRESET_SMS_SCENARIOS[0].generateBody());
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
      const body = `Dear Biniyam\n\nYou have received ETB ${p.amt} from ${p.name}(${p.phone}) on 21/10/2026 23:59:05. Your transaction number is ${txId}. Your current E-Money Account balance is ETB 450.00.\n\nThank you for using telebirr\n\nEthio telecom`;
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white dark:bg-[#192722] h-full overflow-y-auto p-6 border-l border-[#E3EAE5] dark:border-[#253831] flex flex-col justify-between">
        <div className="space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-[#E3EAE5] dark:border-[#253831]">
            <div>
              <h2 className="text-lg font-bold text-[#172B25] dark:text-[#EDF6F0]">
                Android SMS Broadcast & Parser Testbench
              </h2>
              <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
                Simulates Kotlin <span className="font-mono">SmsReceiver.kt</span> intercepting{' '}
                <span className="font-mono">android.provider.Telephony.SMS_RECEIVED</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#75847D] hover:text-[#172B25] dark:hover:text-[#EDF6F0]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Native Background Queue Simulation */}
          <div className="p-4 rounded-2xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-[#16866A] dark:text-[#43C99A]" />
                  JS Runtime Background / Killed State Simulation
                </p>
                <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
                  {isJsRuntimeSimulatedOffline
                    ? `JS Runtime Paused — Incoming 127 SMS messages are queued in native SQLite (${nativeSmsQueue.length} queued)`
                    : 'JS Runtime Active — Native BroadcastReceiver forwards immediately to SQLite'}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleSimulatedJsRuntimeState}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  isJsRuntimeSimulatedOffline
                    ? 'bg-[#E9A23B] text-[#172B25]'
                    : 'bg-white dark:bg-[#192722] text-[#172B25] dark:text-[#EDF6F0] border border-[#E3EAE5] dark:border-[#253831]'
                }`}
              >
                {isJsRuntimeSimulatedOffline ? 'Wake App & Drain Queue' : 'Simulate App Closed'}
              </button>
            </div>

            {nativeSmsQueue.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#E3EAE5] dark:border-[#253831] flex items-center justify-between">
                <span className="text-xs font-mono text-[#E9A23B]">
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
                  className="text-xs font-semibold text-[#16866A] dark:text-[#43C99A] underline"
                >
                  Drain Queue Now
                </button>
              </div>
            )}
          </div>

          {/* Preset Scenarios */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                1. Load Telebirr SMS Template
              </span>
              <button
                type="button"
                onClick={handleSimulateMultiPassengerBurst}
                className="text-xs font-semibold text-[#16866A] dark:text-[#43C99A] hover:underline flex items-center gap-1"
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
                    setSmsBody(preset.generateBody());
                    setLastResult(null);
                  }}
                  className="p-2.5 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] hover:border-[#16866A] border border-[#E3EAE5] dark:border-[#253831] text-left transition-colors"
                >
                  <p className="text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] line-clamp-1">
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
                <label className="block text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                  Sender ID
                </label>
                <input
                  type="text"
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] font-mono text-sm text-[#172B25] dark:text-[#EDF6F0]"
                />
              </div>
              <div className="flex-1 flex items-end">
                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-[#16866A] dark:bg-[#43C99A] text-white dark:text-[#101A17] text-xs font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                >
                  <Play className="w-4 h-4" />
                  Broadcast Incoming SMS to Receiver
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1">
                Raw SMS Body
              </label>
              <textarea
                rows={5}
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] font-mono text-xs text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
              />
            </div>
          </form>

          {lastResult && (
            <div className="p-3.5 rounded-xl bg-[#DDF5E9] dark:bg-[#1D352D] border border-[#16866A]/30 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#16866A] dark:text-[#43C99A] shrink-0 mt-0.5" />
              <div className="text-xs text-[#123C35] dark:text-[#EDF6F0]">
                <span className="font-bold font-mono">{lastResult.status}: </span>
                <span>{lastResult.message}</span>
              </div>
            </div>
          )}

          {/* Live Independent Parser Preview */}
          <div className="p-4 rounded-2xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#172B25] dark:text-[#EDF6F0]">
                Live Parser & Classifier Inspection
              </span>
              <span className="text-xs font-mono text-[#16866A] dark:text-[#43C99A]">
                {livePreview.messageType}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs border-t border-[#E3EAE5] dark:border-[#253831] pt-2.5">
              <div className="text-[#75847D] dark:text-[#94A8A0]">Sender Verified:</div>
              <div className="font-mono text-right text-[#172B25] dark:text-[#EDF6F0]">
                {liveValidation.isSenderValid ? 'Yes (127)' : 'Rejected'}
              </div>

              <div className="text-[#75847D] dark:text-[#94A8A0]">Extracted Amount:</div>
              <div className="font-mono text-right text-[#172B25] dark:text-[#EDF6F0]">
                {livePreview.amountMinorUnits
                  ? `${formatMinorUnits(livePreview.amountMinorUnits)} (${livePreview.amountMinorUnits} minor)`
                  : '—'}
              </div>

              <div className="text-[#75847D] dark:text-[#94A8A0]">Sender Name:</div>
              <div className="font-mono text-right text-[#172B25] dark:text-[#EDF6F0] truncate">
                {livePreview.senderName || '—'}
              </div>

              <div className="text-[#75847D] dark:text-[#94A8A0]">Sender Phone:</div>
              <div className="font-mono text-right text-[#172B25] dark:text-[#EDF6F0]">
                {livePreview.senderPhone || '—'}
              </div>

              <div className="text-[#75847D] dark:text-[#94A8A0]">Transaction ID:</div>
              <div className="font-mono text-right text-[#172B25] dark:text-[#EDF6F0]">
                {livePreview.transactionId || `Fallback (${livePreview.messageFingerprint})`}
              </div>

              <div className="text-[#75847D] dark:text-[#94A8A0]">Date & Time:</div>
              <div className="font-mono text-right text-[#172B25] dark:text-[#EDF6F0]">
                {livePreview.transactionDate || '—'} · {livePreview.transactionTime || '—'}
              </div>

              <div className="text-[#75847D] dark:text-[#94A8A0]">E-Money Balance:</div>
              <div className="font-mono text-right text-[#172B25] dark:text-[#EDF6F0]">
                {livePreview.accountBalanceMinorUnits !== null
                  ? formatMinorUnits(livePreview.accountBalanceMinorUnits)
                  : '—'}
              </div>

              <div className="text-[#75847D] dark:text-[#94A8A0]">Counts as Income:</div>
              <div className="font-mono text-right font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                {livePreview.isIncomingIncome ? 'YES (+Income)' : 'NO (0.00 Impact)'}
              </div>
            </div>

            {liveValidation.errors.length > 0 && (
              <div className="pt-2 border-t border-[#E3EAE5] dark:border-[#253831] flex items-center gap-1.5 text-xs text-[#D9534F]">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{liveValidation.errors[0]}</span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-[#E3EAE5] dark:border-[#253831] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#123C35] text-white text-xs font-semibold flex items-center gap-2"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Done Testing
          </button>
        </div>
      </div>
    </div>
  );
};
