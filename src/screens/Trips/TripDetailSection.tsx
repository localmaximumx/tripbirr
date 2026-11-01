import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  Banknote,
  ChevronDown,
  Link2,
  Plus,
  Route,
  User,
  X,
} from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import {
  PaymentMethod,
  TransactionRecord,
  TransactionStatus,
  TripRecord,
  TripStatus,
} from '../../database/schema';
import { CURRENT_DEMO_ISO_DATE } from '../../database/database';
import {
  calculateTripTotalMinorUnits,
  isPositiveIncomingTransaction,
} from '../../services/reports/reportService';
import {
  formatMinorUnits,
  formatPayerName,
  formatPhonePrivacy,
} from '../../utils/formatters';
import { LiveTripMap } from '../../components/LiveTripMap';

interface TripDetailSectionProps {
  trip: TripRecord;
  onClose: () => void;
  onOpenTripModal: (mode: 'START' | 'END') => void;
  onOpenCashModal: (tripId?: string | null) => void;
}

function formatClock12Hour(timeStr: string): string {
  const clean = timeStr.length > 8 ? timeStr.slice(11, 16) : timeStr.slice(0, 5);
  const parts = clean.split(':');
  if (parts.length < 2) return clean;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return clean;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${suffix}`;
}

export const TripDetailSection: React.FC<TripDetailSectionProps> = ({
  trip,
  onClose,
  onOpenTripModal,
  onOpenCashModal,
}) => {
  const { transactions, settings, assignTransactionToTrip } = useTripBirrStore();

  const isDark = settings.theme === 'dark';
  const currency = settings.currency_display;

  // Slide-up entrance animation + drag-down to dismiss
  const [isEntered, setIsEntered] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number | null>(null);
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const triggerSlideDownClose = () => {
    setIsEntered(false);
    setTimeout(() => {
      onClose();
    }, 240);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = e.clientY;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || dragStartYRef.current === null) return;
    const delta = e.clientY - dragStartYRef.current;
    if (delta > 0) {
      setDragOffsetY(delta);
    } else {
      setDragOffsetY(0);
    }
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    dragStartYRef.current = null;
    if (dragOffsetY > 90) {
      triggerSlideDownClose();
    } else {
      setDragOffsetY(0);
    }
  };

  const summary = calculateTripTotalMinorUnits(trip.id, transactions);
  const isActive = trip.status === TripStatus.ACTIVE;
  const startShort = trip.start_location_name.replace(', Addis Ababa', '');
  const endShort = trip.end_location_name
    ? trip.end_location_name.replace(', Addis Ababa', '')
    : 'In progress';

  const unassignedPayments = transactions.filter(
    (tx) =>
      tx.iso_date === CURRENT_DEMO_ISO_DATE &&
      isPositiveIncomingTransaction(tx) &&
      tx.transaction_status === TransactionStatus.VALID &&
      tx.trip_id === null
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-end">
      {/* Backdrop — tapping pushes the sheet back down */}
      <div
        onClick={triggerSlideDownClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-250 ${
          isEntered ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Slide-Up Bottom Sheet Container */}
      <div
        style={{
          transform: isEntered
            ? `translateY(${dragOffsetY}px)`
            : 'translateY(100%)',
          transition: isDragging
            ? 'none'
            : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className={`relative z-10 w-full max-w-[430px] h-[90vh] rounded-t-[30px] overflow-hidden flex flex-col shadow-2xl border-t ${
          isDark
            ? 'bg-[#0B0F1A] border-white/15 text-white'
            : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
        }`}
      >
        {/* Top Pull-Down Handle Bar (Drag down or tap to push sheet to the bottom) */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={() => {
            if (dragOffsetY < 5) triggerSlideDownClose();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') triggerSlideDownClose();
          }}
          aria-label="Push down to close trip section"
          title="Drag down or tap to push section to the bottom"
          className={`w-full py-2.5 flex flex-col items-center justify-center shrink-0 cursor-grab active:cursor-grabbing select-none touch-none ${
            isDark ? 'bg-[#141B2D]' : 'bg-white'
          }`}
        >
          <div className="w-12 h-1.5 rounded-full bg-[#8E9BAE]/50" />
          <span className="text-[10px] font-semibold text-[#8E9BAE] flex items-center gap-0.5 mt-1">
            <ChevronDown className="w-3 h-3" />
            <span>Push down to close</span>
          </span>
        </div>

        {/* Scrollable Sheet Body: 1) Edge-to-Edge Map First, 2) Specific Trip Transactions Below */}
        <div className="flex-1 overflow-y-auto pb-10">
          {/* 1. FIRST ELEMENT: Edge-to-Edge Live Trip Map with End Trip on Top Right & Start/Current/Distance Bar */}
          <LiveTripMap
            trip={trip}
            associatedTransactions={summary.transactions}
            currency={currency}
            edgeToEdge
            onEndTrip={() => onOpenTripModal('END')}
          />

          {/* 2. BELOW THE MAP: Specific Trip Earnings & Transactions Section */}
          <div className="px-4 pt-4 space-y-4">
            {/* Compact Trip Earnings Summary Bar */}
            <div
              className={`rounded-[22px] p-4 border flex items-center justify-between gap-3 ${
                isDark
                  ? 'bg-[#141B2D] border-white/10'
                  : 'bg-white border-slate-200/80 shadow-xs'
              }`}
            >
              <div>
                <p className="text-xs font-medium text-[#8E9BAE]">
                  Started {formatClock12Hour(trip.start_time)} · {summary.paymentCount}{' '}
                  {summary.paymentCount === 1 ? 'payment' : 'payments'}
                </p>
                <div className="flex items-center gap-3 text-xs font-bold mt-1">
                  <span className="text-[#5CA4F8]">
                    Telebirr {formatMinorUnits(summary.telebirrMinorUnits, currency)}
                  </span>
                  <span className="text-[#8E9BAE]">·</span>
                  <span className="text-[#F5BA36]">
                    Cash {formatMinorUnits(summary.cashMinorUnits, currency)}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-[11px] font-medium text-[#8E9BAE]">Trip Total</p>
                <p className="text-xl font-extrabold tabular-nums text-[#2CD48D]">
                  {formatMinorUnits(summary.totalMinorUnits, currency)}
                </p>
              </div>
            </div>

            {/* Specific Trip Transactions Header + Add Cash Button */}
            <div className="flex items-center justify-between pt-1">
              <div>
                <h2
                  className={`text-lg font-extrabold tracking-tight ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  Trip transactions ({summary.transactions.length})
                </h2>
                <p className="text-xs text-[#8E9BAE]">
                  {startShort} → {endShort}
                </p>
              </div>

              {isActive && (
                <button
                  type="button"
                  onClick={() => onOpenCashModal(trip.id)}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-[#F5BA36]/15 text-[#F5BA36] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>+ Cash</span>
                </button>
              )}
            </div>

            {/* Specific Trip Transactions List */}
            {summary.transactions.length === 0 ? (
              <div
                className={`rounded-[22px] p-6 text-center border ${
                  isDark
                    ? 'bg-[#141B2D] border-white/5 text-[#8E9BAE]'
                    : 'bg-white border-slate-200/80 text-slate-500'
                }`}
              >
                <p className="text-sm font-bold">No payments linked to this trip yet</p>
                <p className="text-xs mt-1">
                  Incoming Telebirr 127 SMS or manual cash entries will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {summary.transactions.map((tx) => {
                  const isCash = tx.payment_method === PaymentMethod.CASH;
                  const amountMajor = (tx.amount_minor_units / 100).toFixed(2);
                  const time12 = formatClock12Hour(tx.transaction_time);

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedTx(tx);
                        }
                      }}
                      className={`rounded-[22px] p-4 border flex items-center justify-between gap-3 cursor-pointer transition-transform active:scale-[0.99] ${
                        isDark
                          ? 'bg-[#141B2D] border-white/5'
                          : 'bg-white border-slate-200/80 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                            isCash
                              ? isDark
                                ? 'bg-[#1D2436] text-[#F5BA36]'
                                : 'bg-[#FEF7E6] text-[#B45309]'
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
                              ? 'Cash payment'
                              : formatPayerName(
                                  tx.sender_name,
                                  settings.privacy_mask_sender_names
                                )}
                          </p>
                          <p className="text-xs text-[#8E9BAE] truncate mt-0.5">
                            {isCash ? 'Manual cash' : 'Telebirr 127'} · {time12}
                            {tx.transaction_id ? ` · ${tx.transaction_id}` : ''}
                          </p>
                        </div>
                      </div>

                      <span className="text-base font-extrabold tabular-nums text-[#2CD48D] shrink-0">
                        +{currency} {amountMajor}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Link Unassigned Payments to This Trip — Only for Active Trips */}
            {isActive && unassignedPayments.length > 0 && (
              <div
                className={`rounded-[22px] p-4 border-[1.5px] space-y-2.5 ${
                  isDark
                    ? 'bg-[#272118] border-[#8B6520]'
                    : 'bg-[#FEF7E6] border-[#F3D078]'
                }`}
              >
                <p
                  className={`text-xs font-extrabold flex items-center gap-1.5 ${
                    isDark ? 'text-[#F5BA36]' : 'text-[#9A6700]'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>
                    Unassigned payments available to link ({unassignedPayments.length})
                  </span>
                </p>
                <div className="space-y-2">
                  {unassignedPayments.map((utx) => (
                    <div
                      key={utx.id}
                      className={`p-3 rounded-xl flex items-center justify-between gap-2 text-xs ${
                        isDark ? 'bg-[#141B2D]' : 'bg-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <p
                          className={`font-bold truncate ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {formatPayerName(
                            utx.sender_name,
                            settings.privacy_mask_sender_names
                          )}{' '}
                          ·{' '}
                          <span className="text-[#2CD48D] font-mono">
                            {formatMinorUnits(utx.amount_minor_units, currency)}
                          </span>
                        </p>
                        <p className="text-[11px] text-[#8E9BAE] mt-0.5">
                          {formatClock12Hour(utx.transaction_time)}
                          {utx.transaction_id ? ` · ${utx.transaction_id}` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => assignTransactionToTrip(utx.id, trip.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#2CD48D] text-[#052115] text-xs font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Link</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Focused Transaction Pop-Up Bottom Sheet (Only Person + Specific Trip Info) */}
        {selectedTx && (
          <div
            onClick={() => setSelectedTx(null)}
            className="absolute inset-0 z-40 flex flex-col justify-end bg-black/55 backdrop-blur-xs"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full rounded-t-[28px] border-t p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-200 ${
                isDark
                  ? 'bg-[#141B2D] border-white/10 text-white'
                  : 'bg-white border-slate-200 text-[#0F172A]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
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
                  <div>
                    <h3 className="text-base font-extrabold">
                      {selectedTx.payment_method === PaymentMethod.CASH
                        ? 'Cash payment'
                        : formatPayerName(
                            selectedTx.sender_name,
                            settings.privacy_mask_sender_names
                          )}
                    </h3>
                    <p className="text-xs text-[#8E9BAE]">
                      {selectedTx.payment_method === PaymentMethod.CASH
                        ? 'Manual cash'
                        : `Telebirr${
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

                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold tabular-nums text-[#2CD48D]">
                    +{currency} {(selectedTx.amount_minor_units / 100).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTx(null)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#8E9BAE] hover:bg-white/10 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                className={`rounded-2xl p-3.5 grid grid-cols-2 gap-3 text-xs ${
                  isDark
                    ? 'bg-[#0B0F1A] border border-white/5'
                    : 'bg-[#F7F9FC] border border-slate-200/70'
                }`}
              >
                <div>
                  <p className="text-[#8E9BAE] font-medium">Payment Time</p>
                  <p className="font-bold mt-0.5">
                    {formatClock12Hour(selectedTx.transaction_time)}
                  </p>
                </div>
                <div>
                  <p className="text-[#8E9BAE] font-medium">
                    {selectedTx.payment_method === PaymentMethod.CASH
                      ? 'Note'
                      : 'Transaction ID'}
                  </p>
                  <p className="font-mono font-bold mt-0.5 truncate">
                    {selectedTx.payment_method === PaymentMethod.CASH
                      ? (selectedTx.description || 'Cash fare').replace('Note: ', '')
                      : selectedTx.transaction_id || '—'}
                  </p>
                </div>
              </div>

              <div
                className={`rounded-2xl p-3.5 border ${
                  isDark
                    ? 'bg-[#0B0F1A] border-white/10'
                    : 'bg-[#F7F9FC] border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5CA4F8] flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5" />
                    <span>Trip</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#5CA4F8] text-[#09152B]">
                    {trip.status === TripStatus.ACTIVE ? '● Active' : 'Completed'}
                  </span>
                </div>
                <p className="text-sm font-extrabold mt-1.5">
                  {startShort} → {endShort}
                </p>
                <p className="text-xs text-[#8E9BAE] mt-0.5">
                  Started {formatClock12Hour(trip.start_time)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
