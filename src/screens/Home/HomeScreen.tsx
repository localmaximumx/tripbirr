import React, { useState } from 'react';
import {
  ArrowDown,
  Banknote,
  Bell,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  Navigation,
  StopCircle,
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
import { LiveTripMap } from '../../components/LiveTripMap';

interface HomeScreenProps {
  onNavigate: (
    tab: 'home' | 'trips' | 'transactions' | 'reports' | 'settings',
    filterHint?: string
  ) => void;
  onOpenTripModal: (mode: 'START' | 'END') => void;
  onOpenCashModal: (tripId?: string | null) => void;
  onOpenSmsSimulator: () => void;
}

function formatTime12Hour(time24: string): string {
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return time24;
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
  onOpenTripModal,
  onOpenCashModal,
  onOpenSmsSimulator,
}) => {
  const { driverProfile, trips, transactions, settings } = useTripBirrStore();
  const [showLiveMap, setShowLiveMap] = useState(false);

  const isDark = settings.theme === 'dark';
  const currency = settings.currency_display;

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

  const telebirrMinor = todayReport.netTelebirrIncomingMinorUnits;
  const cashMinor = todayReport.manualCashIncomingMinorUnits;
  const telebirrPct =
    totalMinor > 0 ? Math.max(12, Math.min(88, Math.round((telebirrMinor / totalMinor) * 100))) : 70;

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

  // Recent payments displayed on Home: Natnael Birhanu (+50.00) and Cash (+120.00) first, followed by recent today items
  const todayIncoming = transactions.filter(
    (tx) =>
      tx.iso_date === CURRENT_DEMO_ISO_DATE &&
      isPositiveIncomingTransaction(tx) &&
      tx.transaction_status === TransactionStatus.VALID
  );

  const featuredRecent: TransactionRecord[] = [
    ...todayIncoming.filter((tx) => tx.id === 'tx_nov1_01' || tx.id === 'tx_nov1_03'),
    ...todayIncoming.filter((tx) => tx.id !== 'tx_nov1_01' && tx.id !== 'tx_nov1_03'),
  ].slice(0, 4);

  const getTripRouteShort = (tripId: string | null): string => {
    if (!tripId) return 'Needs trip';
    const tr = trips.find((t) => t.id === tripId);
    if (!tr) return 'Unassigned';
    const startShort = tr.start_location_name.replace(', Addis Ababa', '');
    const endShort = tr.end_location_name
      ? tr.end_location_name.replace(', Addis Ababa', '')
      : 'In progress';
    return `${startShort} → ${endShort}`;
  };

  // Intraday bar heights matching the 6-bar visual in the PDF hero card
  const intradayBars = [28, 36, 28, 46, 32, 62];

  return (
    <div className="space-y-4">
      {/* Top Greeting & Notification Bell Header (Matches Page 1 & Page 6) */}
      <div className="flex items-center justify-between pt-1 pb-1">
        <div>
          <p className="text-sm font-medium text-[#8E9BAE]">Sunday, Nov 1</p>
          <h1
            className={`text-[30px] font-extrabold tracking-tight leading-tight mt-0.5 ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            Selam, {driverProfile.sms_greeting_name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenCashModal(activeTrip?.id || null)}
            className={`h-12 px-3.5 rounded-full flex items-center gap-1.5 text-xs font-bold transition-transform active:scale-95 cursor-pointer ${
              isDark
                ? 'bg-[#141B2D] text-[#F5BA36] border border-white/5'
                : 'bg-white text-[#B45309] border border-slate-200/80 shadow-xs'
            }`}
            title="Log Manual Cash Payment"
          >
            <Banknote className="w-4 h-4" />
            <span>+Cash</span>
          </button>

          <button
            type="button"
            onClick={onOpenSmsSimulator}
            className={`w-12 h-12 rounded-full flex items-center justify-center relative transition-transform active:scale-95 cursor-pointer ${
              isDark
                ? 'bg-[#141B2D] text-white border border-white/5'
                : 'bg-white text-[#0F172A] border border-slate-200/80 shadow-xs'
            }`}
            aria-label="Open Telebirr 127 SMS Testbench & Notifications"
            title="Simulate Incoming Telebirr 127 SMS"
          >
            <Bell className="w-5 h-5" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#2CD48D] absolute top-3 right-3 ring-2 ring-[#141B2D]" />
          </button>
        </div>
      </div>

      {/* Hero Royal Blue Today's Earnings Card (Matches Page 1 & Page 6) */}
      <section className="rounded-[28px] bg-[#182E6F] p-6 text-white shadow-lg">
        <p className="text-sm font-medium text-[#B4C6EE]">Today&apos;s earnings</p>

        <div className="mt-1.5 flex items-baseline">
          <span className="text-[42px] font-extrabold tracking-tight leading-none">
            {currency} {totalMajorWhole}
          </span>
          <span className="text-2xl font-bold text-[#B4C6EE] ml-0.5">
            .{totalCents}
          </span>
        </div>

        {/* Two-Tone Split Progress Bar (Telebirr Sky Blue vs Cash Amber) */}
        <div className="mt-5 flex items-center gap-1.5 h-2.5 w-full">
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
            Telebirr {formatWholeNumberWithCommas(telebirrMinor)}
          </span>
          <span className="text-[#F5BA36] font-semibold">
            Cash {formatWholeNumberWithCommas(cashMinor)}
          </span>
        </div>

        {/* 6-Column Intraday Bar Chart */}
        <div className="mt-5 grid grid-cols-6 gap-2.5 items-end h-16 pt-2">
          {intradayBars.map((heightPx, idx) => {
            const isLast = idx === intradayBars.length - 1;
            return (
              <div
                key={idx}
                style={{ height: `${heightPx}px` }}
                className={`w-full rounded-[10px] transition-all ${
                  isLast ? 'bg-[#F5BA36]' : 'bg-[#2B4692]'
                }`}
              />
            );
          })}
        </div>
      </section>

      {/* 2-Column KPI Cards: Payments & Trips done */}
      <div className="grid grid-cols-2 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('transactions')}
          className={`rounded-[24px] p-5 text-left transition-transform active:scale-[0.99] cursor-pointer ${
            isDark
              ? 'bg-[#141B2D]'
              : 'bg-white border border-slate-200/70 shadow-xs'
          }`}
        >
          <p className="text-sm font-medium text-[#8E9BAE]">Payments</p>
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
          className={`rounded-[24px] p-5 text-left transition-transform active:scale-[0.99] cursor-pointer ${
            isDark
              ? 'bg-[#141B2D]'
              : 'bg-white border border-slate-200/70 shadow-xs'
          }`}
        >
          <p className="text-sm font-medium text-[#8E9BAE]">Trips done</p>
          <p
            className={`text-[34px] font-extrabold leading-tight mt-1 ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            {todayReport.completedTripsCount}
          </p>
        </button>
      </div>

      {/* Unassigned Payments Callout Card (Matches Page 1 & Page 6) */}
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
          className={`rounded-[24px] p-4 border-[1.5px] flex items-center justify-between gap-3.5 cursor-pointer transition-transform active:scale-[0.99] ${
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
                Payments need a trip
              </p>
              <p
                className={`text-sm ${
                  isDark ? 'text-[#B8B2A6]' : 'text-[#64748B]'
                }`}
              >
                {currency} {formatWholeNumberWithCommas(unassignedTotalMinor)} unassigned
              </p>
            </div>
          </div>

          <span
            className={`text-sm font-bold pr-1 ${
              isDark ? 'text-[#F5BA36]' : 'text-[#9A6700]'
            }`}
          >
            Review
          </span>
        </div>
      )}

      {/* Recent Payments Section (Matches Page 1 & Page 6) */}
      <section className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <h2
            className={`text-xl font-extrabold tracking-tight ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            Recent payments
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="text-sm font-medium text-[#8E9BAE] hover:underline cursor-pointer"
          >
            See all
          </button>
        </div>

        <div className="space-y-4">
          {featuredRecent.map((tx) => {
            const isCash = tx.payment_method === PaymentMethod.CASH;
            const amountMajor = (tx.amount_minor_units / 100).toFixed(2);
            const routeText = getTripRouteShort(tx.trip_id);
            const time12 = formatTime12Hour(tx.transaction_time);

            return (
              <div
                key={tx.id}
                onClick={() => onNavigate('transactions')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onNavigate('transactions');
                }}
                className="flex items-center justify-between gap-3 py-1 cursor-pointer"
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
                      {isCash ? 'Cash' : tx.sender_name}
                    </p>
                    <p className="text-xs text-[#8E9BAE] truncate mt-0.5">
                      {isCash ? 'Manual' : 'Telebirr'} · {time12} · {routeText}
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

      {/* Active Trip Live Map & Quick Testbench Drawer Card */}
      {activeTrip && activeTripSummary && (
        <section
          className={`mt-4 rounded-[24px] p-4 border ${
            isDark
              ? 'bg-[#141B2D] border-[#5CA4F8]/40'
              : 'bg-white border-[#5CA4F8]/60 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#5CA4F8] text-[#09152B] text-[11px] font-extrabold">
                ● ACTIVE TRIP
              </span>
              <span
                className={`text-sm font-bold ${
                  isDark ? 'text-white' : 'text-[#0F172A]'
                }`}
              >
                {activeTrip.start_location_name.replace(', Addis Ababa', '')} → In progress
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenTripModal('END')}
                className="px-3 py-1.5 rounded-full bg-[#2CD48D] text-[#052115] text-xs font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <StopCircle className="w-3.5 h-3.5" />
                End
              </button>
              <button
                type="button"
                onClick={() => setShowLiveMap((v) => !v)}
                className={`p-1.5 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                  isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-700'
                }`}
                title="Toggle Live Trip Map"
              >
                <Navigation className="w-3.5 h-3.5 text-[#2CD48D]" />
                {showLiveMap ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {showLiveMap && (
            <div className="mt-3">
              <LiveTripMap
                trip={activeTrip}
                associatedTransactions={activeTripSummary.transactions}
                currency={currency}
                compact
              />
            </div>
          )}
        </section>
      )}

      {/* Quick Telebirr 127 SMS Testbench Trigger Strip */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onOpenSmsSimulator}
          className={`w-full rounded-2xl p-3.5 flex items-center justify-between text-xs font-semibold border cursor-pointer transition-colors ${
            isDark
              ? 'bg-[#141B2D]/70 border-white/5 text-[#8E9BAE] hover:text-white'
              : 'bg-white border-slate-200/80 text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-[#2CD48D]" />
            <span>Telebirr Sender 127 SMS Testbench (Simulate Incoming SMS)</span>
          </span>
          <span className="text-[#2CD48D] font-bold">Open ›</span>
        </button>
      </div>
    </div>
  );
};
