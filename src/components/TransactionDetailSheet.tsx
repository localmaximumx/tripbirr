import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Route, User, X } from 'lucide-react';
import { useTripBirrStore } from '../store/useTripBirrStore';
import { PaymentMethod, TransactionRecord, TripStatus } from '../database/schema';
import { formatPayerName, formatPhonePrivacy } from '../utils/formatters';
import { getTranslation, Language } from '../utils/i18n';

interface TransactionDetailSheetProps {
  transaction: TransactionRecord | null;
  onClose: () => void;
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

export const TransactionDetailSheet: React.FC<TransactionDetailSheetProps> = ({
  transaction,
  onClose,
}) => {
  const { trips, settings, assignTransactionToTrip } = useTripBirrStore();

  const isDark = settings.theme === 'dark';
  const currency = settings.currency_display;
  const lang = (settings.language || 'en') as Language;

  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const dragStartYRef = useRef<number | null>(null);

  // Close smoothly with slide-down animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setDragOffsetY(0);
      onClose();
    }, 200);
  };

  // Intercept Android hardware back press when sheet is open
  useEffect(() => {
    if (!transaction) return;
    const prevHandler = (window as any).handleHardwareBackPress;
    (window as any).handleHardwareBackPress = () => {
      handleClose();
      return true;
    };
    return () => {
      (window as any).handleHardwareBackPress = prevHandler;
    };
  }, [transaction]);

  // Touch gesture handlers for pull-down dismissal
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartYRef.current === null) return;
    const deltaY = e.touches[0].clientY - dragStartYRef.current;
    if (deltaY > 0) {
      setDragOffsetY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 65) {
      handleClose();
    } else {
      setDragOffsetY(0);
    }
    dragStartYRef.current = null;
  };

  const selectedTxTrip = useMemo(() => {
    if (!transaction || !transaction.trip_id) return null;
    return trips.find((t) => t.id === transaction.trip_id) || null;
  }, [transaction, trips]);

  const assignableTrips = useMemo(
    () => trips.filter((t) => t.status === TripStatus.ACTIVE),
    [trips]
  );

  if (!transaction) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto"
      style={{ isolation: 'isolate' }}
    >
      {/* Dimmed Backdrop (tapping pushes sheet down to close) */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Pop-Up Bottom Sheet — Compact height, never full screen */}
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
        className={`relative z-10 w-full max-w-[430px] max-h-[72vh] flex flex-col rounded-t-[28px] border-t shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-250 ${
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
          onClick={handleClose}
          className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none"
          title="Swipe down or tap to close"
        >
          <div className="w-11 h-1.5 rounded-full bg-[#8E9BAE]/40" />
        </div>

        {/* Scrollable Sheet Content (constrained within max-h-[72vh]) */}
        <div className="flex-1 overflow-y-auto px-6 pb-7 pt-1 space-y-4">
          {/* 1. Person & Payment Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  transaction.payment_method === PaymentMethod.CASH
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
                  {transaction.payment_method === PaymentMethod.CASH
                    ? getTranslation('cash_payment', lang)
                    : formatPayerName(
                        transaction.sender_name,
                        settings.privacy_mask_sender_names
                      )}
                </h3>
                <p className="text-xs text-[#8E9BAE] mt-0.5">
                  {transaction.payment_method === PaymentMethod.CASH
                    ? getTranslation('manual', lang)
                    : `${getTranslation('telebirr', lang)}${
                        transaction.sender_phone
                          ? ` · ${formatPhonePrivacy(
                              transaction.sender_phone,
                              settings.privacy_mask_phones
                            )}`
                          : ''
                      }`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-2xl font-extrabold tabular-nums text-[#2CD48D]">
                +{currency} {(transaction.amount_minor_units / 100).toFixed(2)}
              </span>
              <button
                type="button"
                onClick={handleClose}
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
                {transaction.transaction_date} ·{' '}
                {formatTime12Hour(transaction.transaction_time)}
              </p>
            </div>
            <div>
              <p className="text-[#8E9BAE] font-medium">
                {transaction.payment_method === PaymentMethod.CASH
                  ? (lang === 'am' ? 'ማስታወሻ' : 'Note')
                  : (lang === 'am' ? 'የግብይት ቁጥር (ID)' : 'Transaction ID')}
              </p>
              <p className="font-mono font-bold mt-0.5 truncate">
                {transaction.payment_method === PaymentMethod.CASH
                  ? (transaction.description || 'Cash fare').replace('Note: ', '')
                  : transaction.transaction_id || '—'}
              </p>
            </div>
          </div>

          {/* 2. Specific Trip Info */}
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
                        assignTransactionToTrip(transaction.id, tr.id);
                        handleClose();
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
    </div>,
    document.body
  );
};
