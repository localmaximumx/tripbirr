import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  Route,
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
  isPositiveIncomingTransaction,
  ReportDateRangePreset,
  resolveDateRangeBounds,
} from '../../services/reports/reportService';
import {
  formatMinorUnits,
  formatPayerName,
  formatPhonePrivacy,
} from '../../utils/formatters';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';
import { getTranslation, Language } from '../../utils/i18n';

interface TransactionsScreenProps {
  onOpenCashModal?: () => void;
  initialFilterHint?: string | null;
}

type PaymentFilter = 'ALL' | 'TELEBIRR' | 'CASH' | 'UNASSIGNED';

const DATE_GROUP_LABELS: Record<string, string> = {
  '2026-11-01': 'TODAY · SUN, NOV 1',
  '2026-10-31': 'YESTERDAY · SAT, OCT 31',
  '2026-10-30': 'FRI, OCT 30',
  '2026-10-29': 'THU, OCT 29',
  '2026-10-28': 'WED, OCT 28',
  '2026-10-27': 'TUE, OCT 27',
  '2026-10-26': 'MON, OCT 26',
  '2026-10-21': 'WED, OCT 21',
  '2026-10-20': 'TUE, OCT 20',
};

function formatDateGroupHeader(isoDate: string): string {
  if (DATE_GROUP_LABELS[isoDate]) {
    return DATE_GROUP_LABELS[isoDate];
  }
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase();
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

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  initialFilterHint,
}) => {
  const {
    trips,
    transactions,
    settings,
    assignTransactionToTrip,
  } = useTripBirrStore();

  const isDark = settings.theme === 'dark';
  const currency = settings.currency_display;
  const lang = (settings.language || 'en') as Language;

  // Date range filter: Day ('TODAY'), Week ('LAST_7_DAYS'), Month ('LAST_30_DAYS'), Custom ('CUSTOM')
  const [datePreset, setDatePreset] = useState<ReportDateRangePreset>('TODAY');
  const [customStart, setCustomStart] = useState('2026-10-26');
  const [customEnd, setCustomEnd] = useState(CURRENT_DEMO_ISO_DATE);

  const [activeFilter, setActiveFilter] = useState<PaymentFilter>('ALL');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);

  // Pull-down gesture state for the Transaction Detail Bottom Sheet
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const dragStartYRef = useRef<number | null>(null);

  const getDateGroupHeader = (isoDate: string): string => {
    if (isoDate === '2026-11-01') {
      return lang === 'am' ? 'ዛሬ · እሁድ፣ ጥቅምት 22' : 'TODAY · SUN, NOV 1';
    }
    if (isoDate === '2026-10-31') {
      return lang === 'am' ? 'ትናንት · ቅዳሜ፣ ጥቅምት 21' : 'YESTERDAY · SAT, OCT 31';
    }
    return formatDateGroupHeader(isoDate);
  };

  useEffect(() => {
    if (initialFilterHint === 'UNASSIGNED') {
      setActiveFilter('UNASSIGNED');
    }
  }, [initialFilterHint]);

  const dateBounds = useMemo(
    () =>
      resolveDateRangeBounds(
        datePreset,
        CURRENT_DEMO_ISO_DATE,
        customStart,
        customEnd
      ),
    [datePreset, customStart, customEnd]
  );

  // Filter incoming valid payments within the selected Day / Week / Month / Custom range
  const periodPayments = useMemo(() => {
    return transactions.filter(
      (tx) =>
        tx.iso_date >= dateBounds.startIso &&
        tx.iso_date <= dateBounds.endIso &&
        isPositiveIncomingTransaction(tx) &&
        tx.transaction_status === TransactionStatus.VALID
    );
  }, [transactions, dateBounds]);

  const unassignedCount = useMemo(
    () => periodPayments.filter((tx) => tx.trip_id === null).length,
    [periodPayments]
  );

  const filteredPayments = useMemo(() => {
    return periodPayments.filter((tx) => {
      if (activeFilter === 'TELEBIRR' && tx.payment_method !== PaymentMethod.TELEBIRR) {
        return false;
      }
      if (activeFilter === 'CASH' && tx.payment_method !== PaymentMethod.CASH) {
        return false;
      }
      if (activeFilter === 'UNASSIGNED' && tx.trip_id !== null) {
        return false;
      }
      return true;
    });
  }, [periodPayments, activeFilter]);

  // Group filtered payments by iso_date (newest date first)
  const groupedPayments = useMemo(() => {
    const map = new Map<string, TransactionRecord[]>();
    for (const tx of filteredPayments) {
      const existing = map.get(tx.iso_date) || [];
      existing.push(tx);
      map.set(tx.iso_date, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([isoDate, items]) => {
        const sortedItems = [...items].sort((a, b) => {
          const tA = new Date(a.created_at || `${a.iso_date}T${a.transaction_time}`).getTime();
          const tB = new Date(b.created_at || `${b.iso_date}T${b.transaction_time}`).getTime();
          return tB - tA;
        });
        return {
          isoDate,
          headerLabel: getDateGroupHeader(isoDate),
          subtotalMinorUnits: sortedItems.reduce(
            (sum, item) => sum + item.amount_minor_units,
            0
          ),
          items: sortedItems,
        };
      });
  }, [filteredPayments, lang]);

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

  // Payments can only be assigned to an ACTIVE trip (never to completed or cancelled trips)
  const assignableTrips = useMemo(
    () => trips.filter((t) => t.status === TripStatus.ACTIVE),
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

  const handleCloseSheet = () => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedTxId(null);
      setIsClosing(false);
      setDragOffsetY(0);
    }, 200);
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
      handleCloseSheet();
    } else {
      setDragOffsetY(0);
    }
    dragStartYRef.current = null;
  };

  const dateFilterChips: { id: ReportDateRangePreset; label: string }[] = [
    { id: 'TODAY', label: getTranslation('period_day', lang) },
    { id: 'LAST_7_DAYS', label: getTranslation('period_week', lang) },
    { id: 'LAST_30_DAYS', label: getTranslation('period_month', lang) },
    { id: 'CUSTOM', label: getTranslation('period_custom', lang) },
  ];

  return (
    <div className="space-y-4 pt-3">
      {/* Page Title + Dark/Light Mode Toggle on the Same Horizontal Line */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <h1
          className={`text-[32px] font-extrabold tracking-tight ${
            isDark ? 'text-white' : 'text-[#0F172A]'
          }`}
        >
          {getTranslation('transactions_title', (settings.language || 'en') as Language)}
        </h1>
        <ThemeToggleButton />
      </div>

      {/* Date Range Filter Chips (Day, Week, Month, Custom) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
        {dateFilterChips.map((chip) => {
          const isSelected = datePreset === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setDatePreset(chip.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#5CA4F8] text-[#09152B]'
                  : isDark
                  ? 'bg-[#141B2D] text-[#8E9BAE] hover:text-white'
                  : 'bg-white text-slate-600 border border-slate-200/80'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Range Picker when Custom is selected */}
      {datePreset === 'CUSTOM' && (
        <div
          className={`rounded-2xl p-4 grid grid-cols-2 gap-3 ${
            isDark
              ? 'bg-[#141B2D]'
              : 'bg-white border border-slate-200/80 shadow-xs'
          }`}
        >
          <div>
            <label className="block text-[11px] font-bold text-[#8E9BAE] mb-1">
              {lang === 'am' ? 'ከቀን' : 'From Date'}
            </label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className={`w-full h-9 px-2.5 rounded-xl text-xs border ${
                isDark
                  ? 'bg-[#0B0F1A] border-white/10 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#8E9BAE] mb-1">
              {lang === 'am' ? 'እስከ ቀን' : 'To Date'}
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className={`w-full h-9 px-2.5 rounded-xl text-xs border ${
                isDark
                  ? 'bg-[#0B0F1A] border-white/10 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>
        </div>
      )}

      {/* Payment Method / Assignment Filter Pills Row (All, Telebirr, Cash, Unassigned) */}
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
          {getTranslation('all_methods', lang)} ({periodPayments.length})
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
          {getTranslation('filter_telebirr', lang)}
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
          {getTranslation('filter_cash', lang)}
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
          {getTranslation('filter_unassigned', lang)} {unassignedCount}
        </button>
      </div>

      {/* Grouped Payments List by Date */}
      {groupedPayments.length === 0 ? (
        <div
          className={`rounded-[26px] p-8 text-center text-sm ${
            isDark
              ? 'bg-[#141B2D] text-[#8E9BAE]'
              : 'bg-white border border-slate-200/80 text-slate-500 shadow-xs'
          }`}
        >
          {lang === 'am' ? 'በተመረጠው ቀን ወይም ማጣሪያ ምንም ክፍያ አልተገኘም።' : 'No payments match your selected date range or filter.'}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedPayments.map((group) => (
            <div key={group.isoDate} className="space-y-2">
              <div className="flex items-center justify-between px-1 pt-1">
                <p className="text-xs font-bold tracking-wider text-[#8E9BAE] uppercase">
                  {group.headerLabel}
                </p>
                <span className="text-xs font-extrabold tabular-nums text-[#2CD48D]">
                  {formatMinorUnits(group.subtotalMinorUnits, currency)}
                </span>
              </div>

              <div
                className={`rounded-[26px] p-4 sm:p-5 space-y-5 ${
                  isDark
                    ? 'bg-[#141B2D]'
                    : 'bg-white border border-slate-200/80 shadow-xs'
                }`}
              >
                {group.items.map((tx) => {
                  const isCash = tx.payment_method === PaymentMethod.CASH;
                  const amountMajor = (tx.amount_minor_units / 100).toFixed(2);
                  const time12 = formatTime12Hour(tx.transaction_time);
                  const tripPill = getTripPillLabel(tx.trip_id);

                  const subLine = isCash
                    ? `${tx.description || 'Note: Cash fare'} · ${time12}`
                    : `${tx.transaction_id || 'TELEBIRR'} · ${time12}`;

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
                      className="flex items-start justify-between gap-3 cursor-pointer transition-transform active:scale-[0.99]"
                    >
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
                            {isCash
                              ? getTranslation('cash_payment', lang)
                              : formatPayerName(
                                  tx.sender_name,
                                  settings.privacy_mask_sender_names
                                )}
                          </p>
                          <p className="text-xs text-[#8E9BAE] truncate mt-0.5">
                            {subLine}
                          </p>

                          {/* Trip Route Pill OR "Needs trip" Badge */}
                          <div className="mt-2">
                            {tripPill ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTxId(tx.id);
                                }}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-90 cursor-pointer ${
                                  isDark
                                    ? 'bg-[#1B2D54] text-[#5CA4F8]'
                                    : 'bg-[#E8F1FF] text-[#2563EB]'
                                }`}
                              >
                                {tripPill}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTxId(tx.id);
                                }}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-opacity hover:opacity-90 cursor-pointer ${
                                  isDark
                                    ? 'bg-[#332614] text-[#F5BA36]'
                                    : 'bg-[#FEF7E6] text-[#B45309]'
                                }`}
                              >
                                {getTranslation('needs_trip', lang)}
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
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pop-Up Bottom Sheet — Shows ONLY Info Related to That Person and That Specific Trip */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs"
          onClick={handleCloseSheet}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: isClosing
                ? 'translateY(100%)'
                : `translateY(${dragOffsetY}px)`,
              transition:
                dragOffsetY > 0
                  ? 'none'
                  : 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            className={`w-full max-w-[430px] mx-auto rounded-t-[30px] border-t shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250 ${
              isDark
                ? 'bg-[#141B2D] border-white/10 text-white'
                : 'bg-white border-slate-200 text-[#0F172A]'
            }`}
          >
            {/* Pull-down Drag Handle */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={handleCloseSheet}
              className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none"
              title="Swipe down or tap to close"
            >
              <div className="w-11 h-1.5 rounded-full bg-[#8E9BAE]/40" />
            </div>

            <div className="px-6 pb-7 pt-1 space-y-4">
              {/* 1. Person & Payment Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                      selectedTx.payment_method === PaymentMethod.CASH
                        ? isDark
                          ? 'bg-[#1D2436] text-[#F5BA36]'
                          : 'bg-[#FEF7E6] text-[#B45309]'
                        : isDark
                        ? 'bg-[#16274C] text-[#5CA4F8]'
                        : 'bg-[#E8F1FF] text-[#2563EB]'
                    }`}
                  >
                    <User className="w-5 h-5 stroke-[2.3]" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold truncate">
                      {selectedTx.payment_method === PaymentMethod.CASH
                        ? getTranslation('cash_payment', lang)
                        : formatPayerName(
                            selectedTx.sender_name,
                            settings.privacy_mask_sender_names
                          )}
                    </h3>
                    <p className="text-xs text-[#8E9BAE] mt-0.5">
                      {selectedTx.payment_method === PaymentMethod.CASH
                        ? getTranslation('manual', lang)
                        : `${getTranslation('telebirr', lang)}${
                            selectedTx.sender_phone
                              ? ` · ${formatPhonePrivacy(
                                  selectedTx.sender_phone,
                                  settings.privacy_mask_phones
                                )}`
                              : ''
                          }`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-2xl font-extrabold tabular-nums text-[#2CD48D]">
                    +{currency} {(selectedTx.amount_minor_units / 100).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCloseSheet}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[#8E9BAE] cursor-pointer ${
                      isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                    }`}
                    aria-label="Close payment details"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Person Payment Info Row */}
              <div
                className={`rounded-2xl p-4 grid grid-cols-2 gap-3 text-xs ${
                  isDark
                    ? 'bg-[#0B0F1A] border border-white/5'
                    : 'bg-[#F7F9FC] border border-slate-200/70'
                }`}
              >
                <div>
                  <p className="text-[#8E9BAE] font-medium">{lang === 'am' ? 'ቀን እና ሰዓት' : 'Date & Time'}</p>
                  <p className="font-bold mt-0.5">
                    {selectedTx.transaction_date} ·{' '}
                    {formatTime12Hour(selectedTx.transaction_time)}
                  </p>
                </div>
                <div>
                  <p className="text-[#8E9BAE] font-medium">
                    {selectedTx.payment_method === PaymentMethod.CASH
                      ? (lang === 'am' ? 'ማስታወሻ' : 'Note')
                      : (lang === 'am' ? 'የግብይት ቁጥር (ID)' : 'Transaction ID')}
                  </p>
                  <p className="font-mono font-bold mt-0.5 truncate">
                    {selectedTx.payment_method === PaymentMethod.CASH
                      ? (selectedTx.description || 'Cash fare').replace('Note: ', '')
                      : selectedTx.transaction_id || '—'}
                  </p>
                </div>
              </div>

              {/* 2. Specific Trip Info (Only shows the specific trip this payment belongs to, or lets you link if unassigned) */}
              {selectedTxTrip ? (
                <div
                  className={`rounded-2xl p-4 border ${
                    isDark
                      ? 'bg-[#0B0F1A] border-white/10'
                      : 'bg-[#F7F9FC] border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5CA4F8] flex items-center gap-1.5">
                      <Route className="w-3.5 h-3.5" />
                      <span>{lang === 'am' ? 'ጉዞ' : 'Trip'}</span>
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                        selectedTxTrip.status === TripStatus.ACTIVE
                          ? 'bg-[#5CA4F8] text-[#09152B]'
                          : isDark
                          ? 'bg-[#1B2D54] text-[#5CA4F8]'
                          : 'bg-[#E8F1FF] text-[#2563EB]'
                      }`}
                    >
                      {selectedTxTrip.status === TripStatus.ACTIVE
                        ? `● ${getTranslation('active_now', lang)}`
                        : getTranslation('completed', lang)}
                    </span>
                  </div>

                  <p className="text-base font-extrabold mt-2">
                    {selectedTxTrip.start_location_name.replace(', Addis Ababa', '')}{' '}
                    →{' '}
                    {(selectedTxTrip.end_location_name || (lang === 'am' ? 'በሂደት ላይ' : 'In progress')).replace(
                      ', Addis Ababa',
                      ''
                    )}
                  </p>

                  <p className="text-xs text-[#8E9BAE] mt-1">
                    {lang === 'am' ? 'የተጀመረበት፡ ' : 'Started '}{formatTime12Hour(selectedTxTrip.start_time)}
                    {selectedTxTrip.end_time
                      ? ` · ${lang === 'am' ? 'የተጠናቀቀበት፡ ' : 'Ended '}${formatTime12Hour(selectedTxTrip.end_time)}`
                      : ''}
                  </p>
                </div>
              ) : assignableTrips.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-[#F5BA36] flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5" />
                    <span>{lang === 'am' ? 'ጉዞ ይፈልጋል — ከሚካሄድ ጉዞ ጋር ለማገናኘት ይጫኑ' : 'Needs trip — Tap to assign to active trip'}</span>
                  </p>
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {assignableTrips.map((tr) => {
                      const startShort = tr.start_location_name.replace(
                        ', Addis Ababa',
                        ''
                      );
                      const endShort = (tr.end_location_name || (lang === 'am' ? 'በሂደት ላይ' : 'In progress')).replace(
                        ', Addis Ababa',
                        ''
                      );
                      const label = `${startShort} → ${endShort}`;
                      const timeStr = formatTime12Hour(tr.start_time);

                      return (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => {
                            assignTransactionToTrip(selectedTx.id, tr.id);
                            handleCloseSheet();
                          }}
                          className={`w-full px-4 py-3 rounded-2xl border text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isDark
                              ? 'bg-[#0B0F1A] border-white/10 text-white hover:border-[#2CD48D]'
                              : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A] hover:border-[#2CD48D]'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-sm">{label}</p>
                            <p className="text-[11px] text-[#8E9BAE] mt-0.5">
                              ● {getTranslation('active_now', lang)} · {lang === 'am' ? 'የተጀመረበት፡ ' : 'Started '}{timeStr}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-[#2CD48D] text-[#052115] font-extrabold">
                            {lang === 'am' ? 'አገናኝ' : 'Link'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div
                  className={`rounded-2xl p-4 border text-xs ${
                    isDark
                      ? 'bg-[#0B0F1A] border-white/10 text-[#8E9BAE]'
                      : 'bg-[#F7F9FC] border-slate-200/80 text-slate-600'
                  }`}
                >
                  <p className="font-extrabold text-[#F5BA36] flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5" />
                    <span>{getTranslation('unassigned_payments', lang)}</span>
                  </p>
                  <p className="mt-1">
                    {lang === 'am'
                      ? 'በአሁኑ ሰዓት የሚካሄድ ጉዞ የለም። ክፍያዎች ሊገናኙ የሚችሉት ንቁ ከሆኑ ጉዞዎች ጋር ብቻ ነው።'
                      : 'No active trip right now. Payments can only be linked to an active trip.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
