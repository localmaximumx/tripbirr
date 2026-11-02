import { getTranslation, Language } from '../../utils/i18n';
import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  Banknote,
  Bell,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  MessageSquarePlus,
  Route,
  StopCircle,
  Target,
  User,
  X,
} from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import {
  PaymentMethod,
  TransactionRecord,
  TransactionStatus,
  TripStatus,
} from '../../database/schema';
import { CURRENT_DEMO_ISO_DATE } from '../../database/database';
import {
  calculateTripTotalMinorUnits,
  computeFinancialReport,
  isPositiveIncomingTransaction,
} from '../../services/reports/reportService';
import {
  formatPayerName,
  formatPhonePrivacy,
  getDriverFirstName,
} from '../../utils/formatters';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';
import { TransactionDetailSheet } from '../../components/TransactionDetailSheet';

interface HomeScreenProps {
  onNavigate: (
    tab: 'home' | 'trips' | 'transactions' | 'reports' | 'settings',
    filterHint?: string
  ) => void;
  onOpenTripDetail: (tripId: string) => void;
  onOpenTripModal: (mode: 'START' | 'END') => void;
  onOpenCashModal: (tripId?: string | null) => void;
  onOpenSmsSimulator?: () => void;
}

function formatTime12Hour(time24: string): string {
  const clean = time24.length > 8 ? time24.slice(11, 16) : time24.slice(0, 5);
  const parts = clean.split(':');
  if (parts.length < 2) return clean;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return clean;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${suffix}`;
}

function formatWholeNumberWithCommas(minorUnits: number): string {
  const major = Math.round(minorUnits / 100);
  return major.toLocaleString('en-US');
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenTripDetail,
  onOpenTripModal,
  onOpenCashModal,
  onOpenSmsSimulator,
}) => {
  const {
    driverProfile,
    trips,
    transactions,
    settings,
    updateSettings,
    assignTransactionToTrip,
    receiveIncomingSmsBroadcast,
  } = useTripBirrStore();

  const isDark = settings.theme === 'dark';
  const currency = settings.currency_display;
  const lang = (settings.language || 'en') as Language;
  const driverGreetingName = getDriverFirstName(driverProfile);

  const [quickTestSuccess, setQuickTestSuccess] = useState(false);

  const handleQuickTestSms = (e: React.MouseEvent) => {
    e.stopPropagation();
    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const sampleSms = `Dear ${driverGreetingName}\n\nYou have received ETB 50.00 from Natnael Birhanu(2519****8747) on 01/11/2026 15:30:12. Your transaction number is DJL${randSuffix}. Your current E-Money Account balance is ETB 5,342.62.\n\nThank you for using telebirr\n\nEthio telecom`;
    receiveIncomingSmsBroadcast({
      senderId: '127',
      body: sampleSms,
      receivedAt: new Date().toISOString(),
    });
    setQuickTestSuccess(true);
    setTimeout(() => setQuickTestSuccess(false), 2000);
  };

  // Selected transaction for the slide-up Transaction Detail Bottom Sheet
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  const activeTrip = trips.find((t) => t.status === TripStatus.ACTIVE) || null;
  const activeTripSummary = activeTrip
    ? calculateTripTotalMinorUnits(activeTrip.id, transactions)
    : null;

  const todayReport = computeFinancialReport(
    trips,
    transactions,
    'TODAY',
    CURRENT_DEMO_ISO_DATE
  );

  const totalMinor = todayReport.combinedNetIncomeMinorUnits;
  const totalMajorWhole = Math.floor(totalMinor / 100).toLocaleString('en-US');
  const totalCents = String(Math.abs(totalMinor % 100)).padStart(2, '0');

  const dailyTargetMinor = driverProfile.daily_target_minor_units || 200000;
  const targetPct = Math.min(
    100,
    Math.round((totalMinor / Math.max(100, dailyTargetMinor)) * 100)
  );
  const isTargetReached = totalMinor >= dailyTargetMinor;

  const telebirrMinor = todayReport.netTelebirrIncomingMinorUnits;
  const cashMinor = todayReport.manualCashIncomingMinorUnits;
  const telebirrPct =
    totalMinor > 0
      ? Math.max(12, Math.min(88, Math.round((telebirrMinor / totalMinor) * 100)))
      : 70;

  const unassignedTransactions = transactions.filter(
    (tx) =>
      tx.iso_date === CURRENT_DEMO_ISO_DATE &&
      isPositiveIncomingTransaction(tx) &&
      tx.transaction_status === TransactionStatus.VALID &&
      tx.trip_id === null
  );
  const unassignedTotalMinor = unassignedTransactions.reduce(
    (acc, tx) => acc + tx.amount_minor_units,
    0
  );

  const todayIncoming = transactions.filter(
    (tx) =>
      tx.iso_date === CURRENT_DEMO_ISO_DATE &&
      isPositiveIncomingTransaction(tx) &&
      tx.transaction_status === TransactionStatus.VALID
  );

  const featuredRecent = [...transactions]
    .filter((tx) => isPositiveIncomingTransaction(tx) && tx.transaction_status === TransactionStatus.VALID)
    .sort((a, b) => {
      const timeA = new Date(a.created_at || `${a.iso_date}T${a.transaction_time}`).getTime();
      const timeB = new Date(b.created_at || `${b.iso_date}T${b.transaction_time}`).getTime();
      return timeB - timeA;
    })
    .slice(0, 5);

  // Payments can only be assigned to an ACTIVE trip (never to completed or cancelled trips)
  const assignableTrips = useMemo(
    () => trips.filter((t) => t.status === TripStatus.ACTIVE),
    [trips]
  );

  const selectedTx = useMemo(
    () =>
      selectedTxId
        ? transactions.find((tx) => tx.id === selectedTxId) || null
        : null,
    [selectedTxId, transactions]
  );

  const selectedTxTrip = useMemo(() => {
    if (!selectedTx || !selectedTx.trip_id) return null;
    return trips.find((t) => t.id === selectedTx.trip_id) || null;
  }, [selectedTx, trips]);

  const getTripRouteShort = (tripId: string | null): string => {
    if (!tripId) return getTranslation('needs_trip', lang);
    const tr = trips.find((t) => t.id === tripId);
    if (!tr) return getTranslation('unassigned', lang);
    const startShort = tr.start_location_name.replace(', Addis Ababa', '');
    const endShort = tr.end_location_name
      ? tr.end_location_name.replace(', Addis Ababa', '')
      : (lang === 'am' ? 'በሂደት ላይ' : 'In progress');
    return `${startShort} → ${endShort}`;
  };

  // 6-bar mini chart computed from real recorded daily transactions
  const intradaySlots = useMemo(() => {
    const recentDates = [
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      CURRENT_DEMO_ISO_DATE,
    ];
    const baseSlots = recentDates.map((iso) =>
      transactions
        .filter(
          (tx) =>
            tx.iso_date === iso &&
            isPositiveIncomingTransaction(tx) &&
            tx.transaction_status === TransactionStatus.VALID
        )
        .reduce((acc, tx) => acc + tx.amount_minor_units, 0)
    );
    const maxSlot = Math.max(...baseSlots, 1);
    return baseSlots.map((minor) => ({
      minor,
      heightPx: minor > 0 ? Math.max(8, Math.round((minor / maxSlot) * 56)) : 4,
    }));
  }, [transactions]);

  return (
    <div className="space-y-4 pt-3">
      {/* Top Greeting Header + SMS Testbench Button + Dark/Light Mode Toggle */}
      <div
        style={{ animationDelay: '30ms' }}
        className="animate-card-enter flex items-center justify-between gap-3 pt-2 pb-1"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#8E9BAE]">{settings.language === "am" ? "እሁድ፣ ጥቅምት 22" : "Sunday, Nov 1"}</p>
          <h1
            className={`text-[30px] font-extrabold tracking-tight leading-tight mt-0.5 truncate ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            {getTranslation('selam', (settings.language || 'en') as Language)}, {driverGreetingName}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onOpenSmsSimulator && (
            <button
              type="button"
              onClick={onOpenSmsSimulator}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-full border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs ${
                isDark
                  ? 'bg-[#141B2D] border-[#2CD48D]/40 text-[#2CD48D] hover:bg-[#1E2B45] hover:border-[#2CD48D]'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
              }`}
              title={lang === 'am' ? 'የቴሌብር ኤስኤምኤስ ሲሙሌተር ክፈት' : 'Open SMS Testbench Simulator'}
            >
              <MessageSquarePlus className="w-4 h-4 shrink-0 text-[#2CD48D]" />
              <span className="font-extrabold tracking-tight">
                {lang === 'am' ? 'ሲሙሌተር' : 'Test SMS'}
              </span>
            </button>
          )}
          <ThemeToggleButton />
        </div>
      </div>

      {/* Hero Royal Blue Today's Earnings Card — Clicking takes user to Reports section */}
      <section
        onClick={() => onNavigate('reports')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onNavigate('reports');
          }
        }}
        aria-label="Today's earnings — tap to open Reports"
        style={{ animationDelay: '80ms' }}
        className="animate-card-enter rounded-[28px] bg-[#182E6F] p-6 text-white shadow-lg transition-transform active:scale-[0.99] cursor-pointer hover:brightness-105"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[#B4C6EE]">{getTranslation('todays_earnings', (settings.language || 'en') as Language)}</p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              updateSettings({
                privacy_hide_balance: !settings.privacy_hide_balance,
              });
            }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-[#B4C6EE] hover:text-white transition-colors cursor-pointer"
            title={
              settings.privacy_hide_balance
                ? 'Show earnings balance'
                : 'Hide earnings balance for privacy'
            }
            aria-label="Toggle balance visibility"
          >
            {settings.privacy_hide_balance ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="mt-1.5 flex items-baseline">
          {settings.privacy_hide_balance ? (
            <span className="text-[40px] font-extrabold tracking-widest leading-none">
              {currency} ****
            </span>
          ) : (
            <>
              <span className="text-[42px] font-extrabold tracking-tight leading-none">
                {currency} {totalMajorWhole}
              </span>
              <span className="text-2xl font-bold text-[#B4C6EE] ml-0.5">
                .{totalCents}
              </span>
            </>
          )}
        </div>

        {/* Daily Target Progress Strip */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-[#B4C6EE] font-medium">
            {isTargetReached ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2CD48D]" />
            ) : (
              <Target className="w-3.5 h-3.5 text-[#2CD48D]" />
            )}
            <span>
              {isTargetReached
                ? getTranslation('target_achieved', lang)
                : `${getTranslation('daily_target', lang)}: ${currency} ${formatWholeNumberWithCommas(
                    dailyTargetMinor
                  )}`}
            </span>
          </span>
          <span
            className={`font-extrabold font-mono ${
              isTargetReached ? 'text-[#2CD48D]' : 'text-[#B4C6EE]'
            }`}
          >
            {targetPct}%
          </span>
        </div>

        {/* Two-Tone Split Progress Bar (Telebirr Sky Blue vs Cash Amber) */}
        <div className="mt-4 flex items-center gap-1.5 h-2.5 w-full">
          <div
            style={{ width: `${telebirrPct}%` }}
            className="h-full bg-[#5CA4F8] rounded-full transition-all duration-300"
          />
          <div
            style={{ width: `${100 - telebirrPct}%` }}
            className="h-full bg-[#F5BA36] rounded-full transition-all duration-300"
          />
        </div>

        {/* Telebirr vs Cash Legend */}
        <div className="mt-2.5 flex items-center justify-between text-sm">
          <span className="text-[#5CA4F8] font-medium">
            {getTranslation('telebirr', lang)} {formatWholeNumberWithCommas(telebirrMinor)}
          </span>
          <span className="text-[#F5BA36] font-semibold">
            {getTranslation('cash', lang)} {formatWholeNumberWithCommas(cashMinor)}
          </span>
        </div>

        {/* 6-Column Proportional Intraday Bar Chart */}
        <div className="mt-5 grid grid-cols-6 gap-2.5 items-end h-16 pt-2">
          {intradaySlots.map((slot, idx) => {
            const isLast = idx === intradaySlots.length - 1;
            return (
              <div
                key={idx}
                style={{
                  height: `${slot.heightPx}px`,
                  animationDelay: `${150 + idx * 40}ms`,
                }}
                className={`w-full rounded-[10px] animate-bar-grow transition-all ${
                  isLast ? 'bg-[#F5BA36]' : 'bg-[#2B4692]'
                }`}
              />
            );
          })}
        </div>
      </section>

      {/* Active Trip Card */}
      {activeTrip && activeTripSummary && (
        <section
          onClick={() => onOpenTripDetail(activeTrip.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onOpenTripDetail(activeTrip.id);
            }
          }}
          style={{ animationDelay: '140ms' }}
          className={`animate-card-enter rounded-[24px] p-5 border-[1.5px] transition-transform active:scale-[0.99] cursor-pointer ${
            isDark
              ? 'bg-[#141B2D] border-[#5CA4F8]/80'
              : 'bg-white border-[#5CA4F8] shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#5CA4F8] text-[#09152B] text-xs font-extrabold tracking-wide">
                ● {getTranslation('active_now', lang)}
              </span>
              <span className="text-xs font-medium text-[#8E9BAE]">
                {lang === 'am' ? 'የተጀመረበት፡ ' : 'Started '}
                {formatTime12Hour(activeTrip.start_time.slice(11, 16))}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenTripModal('END');
              }}
              className="px-3.5 py-1.5 rounded-full bg-[#2CD48D] text-[#052115] text-xs font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span>{getTranslation('end_trip', lang)}</span>
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div>
              <h3
                className={`text-xl font-extrabold tracking-tight ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                {activeTrip.start_location_name.replace(', Addis Ababa', '')} → {lang === 'am' ? 'በሂደት ላይ' : 'In progress'}
              </h3>
              <p className="text-xs font-medium text-[#8E9BAE] mt-1">
                {activeTripSummary.paymentCount} {getTranslation('payments', lang)} · {lang === 'am' ? 'የቀጥታ ካርታ እና ክፍያዎችን ለማየት ይጫኑ' : 'Tap to view live map & trip transactions'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xl font-extrabold tabular-nums text-[#5CA4F8]">
                {currency}{' '}
                {formatWholeNumberWithCommas(activeTripSummary.totalMinorUnits)}
              </span>
              <ChevronRight className="w-5 h-5 text-[#8E9BAE]" />
            </div>
          </div>
        </section>
      )}

      {/* 2-Column KPI Cards: Payments & Trips done */}
      <div className="grid grid-cols-2 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('transactions')}
          style={{ animationDelay: '190ms' }}
          className={`animate-card-enter rounded-[24px] p-5 text-left transition-transform active:scale-[0.99] cursor-pointer ${
            isDark
              ? 'bg-[#141B2D]'
              : 'bg-white border border-slate-200/70 shadow-xs'
          }`}
        >
          <p className="text-sm font-medium text-[#8E9BAE]">{getTranslation('payments', lang)}</p>
          <p
            className={`text-[34px] font-extrabold leading-tight mt-1 ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            {todayReport.incomingPaymentCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('trips')}
          style={{ animationDelay: '230ms' }}
          className={`animate-card-enter rounded-[24px] p-5 text-left transition-transform active:scale-[0.99] cursor-pointer ${
            isDark
              ? 'bg-[#141B2D]'
              : 'bg-white border border-slate-200/70 shadow-xs'
          }`}
        >
          <p className="text-sm font-medium text-[#8E9BAE]">{getTranslation('trips_done', lang)}</p>
          <p
            className={`text-[34px] font-extrabold leading-tight mt-1 ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            {todayReport.completedTripsCount}
          </p>
        </button>
      </div>

      {/* SMS Testbench Simulator Card */}
      <section
        onClick={onOpenSmsSimulator}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenSmsSimulator?.();
          }
        }}
        style={{ animationDelay: '250ms' }}
        className={`animate-card-enter rounded-[24px] p-4.5 border-[1.5px] flex items-center justify-between gap-3.5 cursor-pointer transition-transform active:scale-[0.99] hover:brightness-105 ${
          isDark
            ? 'bg-[#101B2E] border-[#5CA4F8]/30 hover:border-[#5CA4F8]/70 shadow-lg'
            : 'bg-[#F0F7FF] border-[#5CA4F8]/50 shadow-xs hover:border-[#5CA4F8]'
        }`}
        aria-label="Open SMS Testbench Simulator"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-[#5CA4F8] text-[#09152B] flex items-center justify-center shrink-0 shadow-md">
            <MessageSquarePlus className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`text-base font-extrabold tracking-tight truncate ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                {lang === 'am' ? 'የቴሌብር ኤስኤምኤስ ሲሙሌተር' : 'SMS Testbench Simulator'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#2CD48D]/20 text-[#2CD48D] shrink-0">
                LIVE
              </span>
            </div>
            <p className="text-xs text-[#8E9BAE] truncate mt-0.5">
              {lang === 'am'
                ? 'የተሳፋሪ ክፍያዎችን፣ ሪቨርሳል እና ድምፅን በቅጽበት ይሞክሩ'
                : 'Simulate passenger payments, reversals & voice alerts'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleQuickTestSms}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-xs ${
              quickTestSuccess
                ? 'bg-[#2CD48D] text-[#052115]'
                : isDark
                ? 'bg-[#1E2B45] hover:bg-[#253655] text-[#5CA4F8]'
                : 'bg-white hover:bg-slate-50 text-[#1B64DA] border border-[#5CA4F8]/30'
            }`}
            title="Fire instant ETB 50.00 payment"
          >
            {quickTestSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{lang === 'am' ? 'ተልኳል!' : 'Sent!'}</span>
              </>
            ) : (
              <span>{lang === 'am' ? 'በ1-ጠቅ ሞክር' : 'Quick +50'}</span>
            )}
          </button>
          <ChevronRight className="w-5 h-5 text-[#8E9BAE]" />
        </div>
      </section>

      {/* Unassigned Payments Callout Card */}
      {unassignedTransactions.length > 0 && (
        <div
          onClick={() => onNavigate('transactions', 'UNASSIGNED')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onNavigate('transactions', 'UNASSIGNED');
            }
          }}
          style={{ animationDelay: '270ms' }}
          className={`animate-card-enter rounded-[24px] p-4 border-[1.5px] flex items-center justify-between gap-3.5 cursor-pointer transition-transform active:scale-[0.99] ${
            isDark
              ? 'bg-[#272118] border-[#8B6520]'
              : 'bg-[#FEF7E6] border-[#F3D078]'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#F5BA36] text-[#111827] font-extrabold text-lg flex items-center justify-center shrink-0">
              {unassignedTransactions.length}
            </div>
            <div>
              <p
                className={`text-base font-bold leading-snug ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                {getTranslation('payments_need_trip', lang)}
              </p>
              <p
                className={`text-sm ${
                  isDark ? 'text-[#B8B2A6]' : 'text-[#64748B]'
                }`}
              >
                {currency} {formatWholeNumberWithCommas(unassignedTotalMinor)} {getTranslation('unassigned', lang)}
              </p>
            </div>
          </div>

          <span
            className={`text-sm font-bold pr-1 ${
              isDark ? 'text-[#F5BA36]' : 'text-[#9A6700]'
            }`}
          >
            {lang === 'am' ? 'ይመልከቱ' : 'Review'}
          </span>
        </div>
      )}

      {/* Recent Payments Section — Clicking opens the Transaction Detail Bottom Sheet for that specific person */}
      <section className="pt-2">
        <div
          style={{ animationDelay: '300ms' }}
          className="animate-card-enter flex items-center justify-between mb-3"
        >
          <h2
            className={`text-xl font-extrabold tracking-tight ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            {getTranslation('recent_payments', lang)}
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="text-sm font-medium text-[#8E9BAE] hover:underline cursor-pointer"
          >
            {getTranslation('view_all', lang)}
          </button>
        </div>

        <div className="space-y-4">
          {featuredRecent.map((tx, idx) => {
            const isCash = tx.payment_method === PaymentMethod.CASH;
            const amountMajor = (tx.amount_minor_units / 100).toFixed(2);
            const routeText = getTripRouteShort(tx.trip_id);
            const time12 = formatTime12Hour(tx.transaction_time);
            const displayName = isCash
              ? getTranslation('cash', lang)
              : formatPayerName(tx.sender_name, settings.privacy_mask_sender_names);

            return (
              <div
                key={tx.id}
                onClick={() => setSelectedTxId(tx.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedTxId(tx.id);
                  }
                }}
                style={{ animationDelay: `${340 + idx * 45}ms` }}
                className="animate-card-enter flex items-center justify-between gap-3 py-1 cursor-pointer transition-transform active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                      isCash
                        ? isDark
                          ? 'bg-[#1D2436] text-[#F5BA36]'
                          : 'bg-[#F3F4F6] text-[#B45309]'
                        : isDark
                        ? 'bg-[#16274C] text-[#5CA4F8]'
                        : 'bg-[#E8F1FF] text-[#2563EB]'
                    }`}
                  >
                    <ArrowDown className="w-5 h-5 stroke-[2.4]" />
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`text-base font-bold truncate ${
                        isDark ? 'text-white' : 'text-[#0F172A]'
                      }`}
                    >
                      {displayName}
                    </p>
                    <p className="text-xs text-[#8E9BAE] truncate mt-0.5">
                      {isCash ? getTranslation('manual', lang) : getTranslation('telebirr', lang)} · {time12} · {routeText}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-lg font-extrabold tabular-nums shrink-0 ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  +{amountMajor}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pop-Up Bottom Sheet for Clicked Recent Payment — Compact height */}
      <TransactionDetailSheet
        transaction={selectedTx}
        onClose={() => setSelectedTxId(null)}
      />
    </div>
  );
};
