import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  Banknote,
  MessageSquarePlus,
  Search,
  Trash2,
} from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import {
  PaymentMethod,
  TransactionStatus,
  TripStatus,
} from '../../database/schema';
import { CURRENT_DEMO_ISO_DATE } from '../../database/database';
import { isPositiveIncomingTransaction } from '../../services/reports/reportService';

interface TransactionsScreenProps {
  onOpenSmsSimulator: () => void;
  onOpenCashModal: () => void;
  initialFilterHint?: string | null;
}

type PaymentFilter = 'ALL' | 'TELEBIRR' | 'CASH' | 'UNASSIGNED';

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

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  onOpenSmsSimulator,
  onOpenCashModal,
  initialFilterHint,
}) => {
  const {
    trips,
    transactions,
    settings,
    assignTransactionToTrip,
    deleteTransactionRecord,
  } = useTripBirrStore();

  const isDark = settings.theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<PaymentFilter>('ALL');
  const [assigningTxId, setAssigningTxId] = useState<string | null>(null);

  useEffect(() => {
    if (initialFilterHint === 'UNASSIGNED') {
      setActiveFilter('UNASSIGNED');
    }
  }, [initialFilterHint]);

  const todayPayments = useMemo(() => {
    return transactions.filter(
      (tx) =>
        tx.iso_date === CURRENT_DEMO_ISO_DATE &&
        isPositiveIncomingTransaction(tx) &&
        tx.transaction_status === TransactionStatus.VALID
    );
  }, [transactions]);

  const unassignedCount = useMemo(
    () => todayPayments.filter((tx) => tx.trip_id === null).length,
    [todayPayments]
  );

  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return todayPayments.filter((tx) => {
      if (activeFilter === 'TELEBIRR' && tx.payment_method !== PaymentMethod.TELEBIRR) {
        return false;
      }
      if (activeFilter === 'CASH' && tx.payment_method !== PaymentMethod.CASH) {
        return false;
      }
      if (activeFilter === 'UNASSIGNED' && tx.trip_id !== null) {
        return false;
      }
      if (!q) return true;
      const amountStr = (tx.amount_minor_units / 100).toFixed(2);
      return (
        (tx.sender_name || '').toLowerCase().includes(q) ||
        (tx.transaction_id || '').toLowerCase().includes(q) ||
        (tx.description || '').toLowerCase().includes(q) ||
        amountStr.includes(q)
      );
    });
  }, [todayPayments, activeFilter, searchQuery]);

  const assignableTrips = useMemo(
    () =>
      trips.filter(
        (t) =>
          t.start_time.slice(0, 10) === CURRENT_DEMO_ISO_DATE &&
          t.status !== TripStatus.CANCELLED
      ),
    [trips]
  );

  const getTripPillLabel = (tripId: string | null): string | null => {
    if (!tripId) return null;
    const tr = trips.find((t) => t.id === tripId);
    if (!tr) return null;
    const startShort = tr.start_location_name.replace(', Addis Ababa', '');
    const endShort = tr.end_location_name
      ? tr.end_location_name.replace(', Addis Ababa', '')
      : 'In progress';
    return `${startShort} → ${endShort}`;
  };

  return (
    <div className="space-y-4">
      {/* Page Title & Quick Action Buttons (Matches Page 3) */}
      <div className="flex items-center justify-between pt-1">
        <h1
          className={`text-[32px] font-extrabold tracking-tight ${
            isDark ? 'text-white' : 'text-[#0F172A]'
          }`}
        >
          Payments
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCashModal}
            className={`h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              isDark
                ? 'bg-[#141B2D] text-[#F5BA36] border border-white/5'
                : 'bg-white text-[#B45309] border border-slate-200/80 shadow-xs'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" />
            +Cash
          </button>
          <button
            type="button"
            onClick={onOpenSmsSimulator}
            className={`h-9 px-3 rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              isDark
                ? 'bg-[#141B2D] text-[#5CA4F8] border border-white/5'
                : 'bg-white text-[#2563EB] border border-slate-200/80 shadow-xs'
            }`}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            127 SMS
          </button>
        </div>
      </div>

      {/* Search Bar (Matches Page 3: "Name, amount or transaction ID") */}
      <div
        className={`h-12 px-4 rounded-2xl flex items-center gap-3 ${
          isDark
            ? 'bg-[#141B2D] text-white'
            : 'bg-white border border-slate-200/80 text-[#0F172A] shadow-xs'
        }`}
      >
        <Search className="w-5 h-5 text-[#8E9BAE] shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Name, amount or transaction ID"
          className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8E9BAE]"
        />
      </div>

      {/* Filter Pills Row (All, Telebirr, Cash, Unassigned 2) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeFilter === 'ALL'
              ? 'bg-[#2CD48D] text-[#052115]'
              : isDark
              ? 'bg-[#141B2D] text-white'
              : 'bg-white text-[#0F172A] border border-slate-200/80'
          }`}
        >
          All
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('TELEBIRR')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeFilter === 'TELEBIRR'
              ? 'bg-[#2CD48D] text-[#052115]'
              : isDark
              ? 'bg-[#141B2D] text-white'
              : 'bg-white text-[#0F172A] border border-slate-200/80'
          }`}
        >
          Telebirr
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('CASH')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeFilter === 'CASH'
              ? 'bg-[#2CD48D] text-[#052115]'
              : isDark
              ? 'bg-[#141B2D] text-white'
              : 'bg-white text-[#0F172A] border border-slate-200/80'
          }`}
        >
          Cash
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('UNASSIGNED')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
            activeFilter === 'UNASSIGNED'
              ? 'bg-[#F5BA36] text-[#111827]'
              : isDark
              ? 'bg-[#332614] text-[#F5BA36]'
              : 'bg-[#FEF7E6] text-[#B45309] border border-[#F3D078]'
          }`}
        >
          Unassigned {unassignedCount}
        </button>
      </div>

      {/* Section Date Header (Matches Page 3: "TODAY") */}
      <p className="text-xs font-bold tracking-wider text-[#8E9BAE] uppercase pt-1">
        TODAY
      </p>

      {/* Payments Container Card (Matches Page 3) */}
      <div
        className={`rounded-[26px] p-4 sm:p-5 space-y-5 ${
          isDark
            ? 'bg-[#141B2D]'
            : 'bg-white border border-slate-200/80 shadow-xs'
        }`}
      >
        {filteredPayments.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#8E9BAE]">
            No payments match your search or filter.
          </div>
        ) : (
          filteredPayments.map((tx) => {
            const isCash = tx.payment_method === PaymentMethod.CASH;
            const amountMajor = (tx.amount_minor_units / 100).toFixed(2);
            const time12 = formatTime12Hour(tx.transaction_time);
            const tripPill = getTripPillLabel(tx.trip_id);
            const isAssigning = assigningTxId === tx.id;

            const subLine = isCash
              ? `${tx.description || 'Note: Cash fare'} · ${time12}`
              : `${tx.transaction_id || 'TELEBIRR'} · ${time12}`;

            return (
              <div key={tx.id} className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
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
                        {isCash ? 'Cash payment' : tx.sender_name}
                      </p>
                      <p className="text-xs text-[#8E9BAE] truncate mt-0.5">
                        {subLine}
                      </p>

                      {/* Trip Route Pill OR "Needs trip" Badge (Matches Page 3 verbatim) */}
                      <div className="mt-2">
                        {tripPill ? (
                          <button
                            type="button"
                            onClick={() =>
                              setAssigningTxId(isAssigning ? null : tx.id)
                            }
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-90 cursor-pointer ${
                              isDark
                                ? 'bg-[#1B2D54] text-[#5CA4F8]'
                                : 'bg-[#E8F1FF] text-[#2563EB]'
                            }`}
                            title="Tap to change trip assignment"
                          >
                            {tripPill}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setAssigningTxId(isAssigning ? null : tx.id)
                            }
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-90 cursor-pointer ${
                              isDark
                                ? 'bg-[#332614] text-[#F5BA36]'
                                : 'bg-[#FEF7E6] text-[#B45309]'
                            }`}
                            title="Tap to assign this payment to a trip"
                          >
                            Needs trip
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-lg font-extrabold tabular-nums shrink-0 mt-0.5 ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    +{amountMajor}
                  </span>
                </div>

                {/* Inline Trip Assignment Selector when pill is tapped */}
                {isAssigning && (
                  <div
                    className={`ml-14 p-3 rounded-2xl border space-y-2 ${
                      isDark
                        ? 'bg-[#0B0F1A] border-white/10'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#8E9BAE]">
                        Assign to Trip:
                      </span>
                      {isCash && (
                        <button
                          type="button"
                          onClick={() => {
                            deleteTransactionRecord(tx.id);
                            setAssigningTxId(null);
                          }}
                          className="text-[11px] font-semibold text-[#F87171] flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete Cash Entry
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          assignTransactionToTrip(tx.id, null);
                          setAssigningTxId(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                          tx.trip_id === null
                            ? 'bg-[#F5BA36] text-[#111827] font-bold'
                            : 'bg-white/10 text-[#8E9BAE]'
                        }`}
                      >
                        Unassigned
                      </button>

                      {assignableTrips.map((tr) => {
                        const label = `${tr.start_location_name.replace(
                          ', Addis Ababa',
                          ''
                        )} → ${(tr.end_location_name || 'In progress').replace(
                          ', Addis Ababa',
                          ''
                        )}`;
                        const isCurrent = tx.trip_id === tr.id;
                        return (
                          <button
                            key={tr.id}
                            type="button"
                            onClick={() => {
                              assignTransactionToTrip(tx.id, tr.id);
                              setAssigningTxId(null);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                              isCurrent
                                ? 'bg-[#2CD48D] text-[#052115] font-bold'
                                : isDark
                                ? 'bg-[#141B2D] text-white hover:bg-[#1E2B45]'
                                : 'bg-white text-slate-800 border border-slate-200'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
