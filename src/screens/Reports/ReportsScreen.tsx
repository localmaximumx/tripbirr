import { getTranslation, Language } from '../../utils/i18n';
import React, { useMemo, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import { TripStatus } from '../../database/schema';
import { CURRENT_DEMO_ISO_DATE } from '../../database/database';
import {
  calculateTripTotalMinorUnits,
  computeFinancialReport,
  DailyEarningsPoint,
  generateDailySummaryCsv,
  generateTransactionsCsv,
  generateTripsCsv,
  ReportDateRangePreset,
  resolveDateRangeBounds,
  triggerCsvDownload,
} from '../../services/reports/reportService';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';

function formatWholeNumberWithCommas(minorUnits: number): string {
  const major = Math.round(minorUnits / 100);
  return major.toLocaleString('en-US');
}

const WEEKDAY_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_FULL_LABELS: Record<string, string> = {
  '2026-10-26': 'Monday, Oct 26',
  '2026-10-27': 'Tuesday, Oct 27',
  '2026-10-28': 'Wednesday, Oct 28',
  '2026-10-29': 'Thursday, Oct 29',
  '2026-10-30': 'Friday, Oct 30',
  '2026-10-31': 'Saturday, Oct 31',
  '2026-11-01': 'Sunday, Nov 1 (Today)',
};

export const ReportsScreen: React.FC = () => {
  const { trips, transactions, settings } = useTripBirrStore();
  const isDark = settings.theme === 'dark';
  const currency = settings.currency_display;

  // Default to LAST_7_DAYS ("Week")
  const [preset, setPreset] = useState<ReportDateRangePreset>('LAST_7_DAYS');
  const [customStart, setCustomStart] = useState('2026-10-26');
  const [customEnd, setCustomEnd] = useState(CURRENT_DEMO_ISO_DATE);

  // Interactive selected bar index (null = full period summary; 0..6 = specific day selected)
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  const report = computeFinancialReport(
    trips,
    transactions,
    preset,
    CURRENT_DEMO_ISO_DATE,
    customStart,
    customEnd
  );

  const yesterdayReport = computeFinancialReport(
    trips,
    transactions,
    'YESTERDAY',
    CURRENT_DEMO_ISO_DATE
  );

  // Build 7-day series purely from real recorded transactions in SQLite
  const chartPoints: DailyEarningsPoint[] = useMemo(() => {
    const sevenDaysReport = computeFinancialReport(
      trips,
      transactions,
      'LAST_7_DAYS',
      CURRENT_DEMO_ISO_DATE
    );
    const seriesByIso = new Map<string, DailyEarningsPoint>();
    for (const pt of sevenDaysReport.dailySeries) {
      seriesByIso.set(pt.isoDate, pt);
    }

    const weekIsoDates = [
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ];

    return weekIsoDates.map((iso) => {
      const existing = seriesByIso.get(iso);
      if (existing) return existing;
      const [, month, day] = iso.split('-');
      return {
        isoDate: iso,
        label: `${day}/${month}`,
        telebirrMinorUnits: 0,
        cashMinorUnits: 0,
        netMinorUnits: 0,
        paymentCount: 0,
      };
    });
  }, [trips, transactions]);

  const activeDayPoint =
    selectedBarIndex !== null && chartPoints[selectedBarIndex]
      ? chartPoints[selectedBarIndex]
      : null;

  // Displayed values dynamically respond when a day bar is clicked
  const totalMinor = activeDayPoint
    ? activeDayPoint.netMinorUnits
    : report.combinedNetIncomeMinorUnits;
  const telebirrMinor = activeDayPoint
    ? activeDayPoint.telebirrMinorUnits
    : report.netTelebirrIncomingMinorUnits;
  const cashMinor = activeDayPoint
    ? activeDayPoint.cashMinorUnits
    : report.manualCashIncomingMinorUnits;

  const telebirrPct =
    totalMinor > 0 ? Math.round((telebirrMinor / totalMinor) * 100) : 0;
  const cashPct = totalMinor > 0 ? 100 - telebirrPct : 0;

  // Completed trips count strictly computed from real TripRecord entries
  const completedTripsDisplay = useMemo(() => {
    if (activeDayPoint) {
      return trips.filter(
        (t) =>
          t.start_time.slice(0, 10) === activeDayPoint.isoDate &&
          t.status === TripStatus.COMPLETED
      ).length;
    }
    return report.completedTripsCount;
  }, [activeDayPoint, report.completedTripsCount, trips]);

  // Average per completed trip computed from real recorded trip earnings
  const avgPerTripDisplay = useMemo(() => {
    if (activeDayPoint) {
      const dayCompletedTrips = trips.filter(
        (t) =>
          t.start_time.slice(0, 10) === activeDayPoint.isoDate &&
          t.status === TripStatus.COMPLETED
      );
      if (dayCompletedTrips.length === 0) return '0';
      const dayTripTotalMinor = dayCompletedTrips.reduce(
        (sum, tr) =>
          sum + calculateTripTotalMinorUnits(tr.id, transactions).totalMinorUnits,
        0
      );
      return Math.round(
        dayTripTotalMinor / 100 / dayCompletedTrips.length
      ).toLocaleString('en-US');
    }
    if (report.completedTripsCount === 0) return '0';
    return Math.round(
      report.averageIncomePerCompletedTripMinorUnits / 100
    ).toLocaleString('en-US');
  }, [
    activeDayPoint,
    report.completedTripsCount,
    report.averageIncomePerCompletedTripMinorUnits,
    trips,
    transactions,
  ]);

  // Compute Highest-earning trip strictly from real recorded trips and their linked payments (zero dummy data)
  const highestTripForSelection = useMemo(() => {
    const targetIsoBounds = activeDayPoint
      ? { startIso: activeDayPoint.isoDate, endIso: activeDayPoint.isoDate }
      : resolveDateRangeBounds(
          preset,
          CURRENT_DEMO_ISO_DATE,
          customStart,
          customEnd
        );

    const candidateTrips = trips.filter((t) => {
      if (t.status === TripStatus.CANCELLED) return false;
      const tripDate = t.start_time.slice(0, 10);
      return (
        tripDate >= targetIsoBounds.startIso &&
        tripDate <= targetIsoBounds.endIso
      );
    });

    let bestRoute = '';
    let bestMinor = 0;
    let bestPaymentCount = 0;
    let bestTripIso = activeDayPoint
      ? activeDayPoint.isoDate
      : CURRENT_DEMO_ISO_DATE;

    for (const tr of candidateTrips) {
      const summary = calculateTripTotalMinorUnits(tr.id, transactions);
      if (summary.totalMinorUnits > bestMinor) {
        bestMinor = summary.totalMinorUnits;
        bestPaymentCount = summary.paymentCount;
        bestTripIso = tr.start_time.slice(0, 10);
        const startShort = tr.start_location_name.replace(', Addis Ababa', '');
        const endShort = (tr.end_location_name || 'In progress').replace(
          ', Addis Ababa',
          ''
        );
        bestRoute = `${startShort} → ${endShort}`;
      }
    }

    const contextLabel = activeDayPoint
      ? (WEEKDAY_FULL_LABELS[activeDayPoint.isoDate] || activeDayPoint.isoDate).split(
          ','
        )[0]
      : preset === 'TODAY'
      ? 'Today'
      : (WEEKDAY_FULL_LABELS[bestTripIso] || bestTripIso).split(',')[0];

    if (bestMinor > 0 && bestRoute) {
      return {
        route: bestRoute,
        amountMinorUnits: bestMinor,
        paymentCount: bestPaymentCount,
        contextLabel,
      };
    }

    return {
      route: 'No recorded trip payments',
      amountMinorUnits: 0,
      paymentCount: 0,
      contextLabel,
    };
  }, [trips, transactions, activeDayPoint, preset, customStart, customEnd]);

  // Compute the highest-earning day across the 7-day chart from real transactions
  const highestEarningDay = useMemo(() => {
    if (chartPoints.length === 0) return null;
    const best = chartPoints.reduce(
      (maxPt, pt) => (pt.netMinorUnits > maxPt.netMinorUnits ? pt : maxPt),
      chartPoints[0]
    );
    return best.netMinorUnits > 0 ? best : null;
  }, [chartPoints]);

  const periodLabel = activeDayPoint
    ? WEEKDAY_FULL_LABELS[activeDayPoint.isoDate] || `Day (${activeDayPoint.label})`
    : preset === 'TODAY'
    ? 'Today'
    : preset === 'LAST_7_DAYS'
    ? 'This week'
    : preset === 'LAST_30_DAYS'
    ? 'This month'
    : 'Selected period';

  const maxVal = Math.max(...chartPoints.map((d) => d.netMinorUnits), 1);
  const MAX_BAR_HEIGHT_PX = 96;

  const filterChips: { id: ReportDateRangePreset; label: string }[] = [
    { id: 'TODAY', label: 'Today' },
    { id: 'LAST_7_DAYS', label: 'Week' },
    { id: 'LAST_30_DAYS', label: 'Month' },
    { id: 'CUSTOM', label: 'Custom' },
  ];

  const handleExportTransactionsCsv = () => {
    const csv = generateTransactionsCsv(transactions, trips);
    triggerCsvDownload(`tripbirr_payments_${CURRENT_DEMO_ISO_DATE}.csv`, csv);
  };

  const handleExportTripsCsv = () => {
    const csv = generateTripsCsv(trips, transactions);
    triggerCsvDownload(`tripbirr_trips_${CURRENT_DEMO_ISO_DATE}.csv`, csv);
  };

  const handleExportDailyCsv = () => {
    const csv = generateDailySummaryCsv(report.dailySeries);
    triggerCsvDownload(`tripbirr_daily_summary_${CURRENT_DEMO_ISO_DATE}.csv`, csv);
  };

  return (
    <div className="space-y-4 pt-3">
      {/* Page Title + Dark/Light Mode Toggle on the Same Horizontal Line */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <h1
          className={`text-[32px] font-extrabold tracking-tight ${
            isDark ? 'text-white' : 'text-[#0F172A]'
          }`}
        >
          {getTranslation('reports_title', (settings.language || 'en') as Language)}
        </h1>
        <ThemeToggleButton />
      </div>

      {/* Period Filter Chips (Today, Week, Month, Custom) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {filterChips.map((chip) => {
          const isSelected = preset === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setPreset(chip.id);
                setSelectedBarIndex(null);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#2CD48D] text-[#052115]'
                  : isDark
                  ? 'bg-[#141B2D] text-white'
                  : 'bg-white text-[#0F172A] border border-slate-200/80'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Range Inputs when Custom is selected */}
      {preset === 'CUSTOM' && (
        <div
          className={`rounded-2xl p-4 grid grid-cols-2 gap-3 ${
            isDark
              ? 'bg-[#141B2D]'
              : 'bg-white border border-slate-200/80 shadow-xs'
          }`}
        >
          <div>
            <label className="block text-[11px] font-bold text-[#8E9BAE] mb-1">
              From Date
            </label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => {
                setCustomStart(e.target.value);
                setSelectedBarIndex(null);
              }}
              className={`w-full h-9 px-2.5 rounded-xl text-xs border ${
                isDark
                  ? 'bg-[#0B0F1A] border-white/10 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#8E9BAE] mb-1">
              To Date
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => {
                setCustomEnd(e.target.value);
                setSelectedBarIndex(null);
              }}
              className={`w-full h-9 px-2.5 rounded-xl text-xs border ${
                isDark
                  ? 'bg-[#0B0F1A] border-white/10 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            />
          </div>
        </div>
      )}

      {/* Hero Blue Earnings Card with Proportional Interactive 7-Day Bar Chart */}
      <section className="rounded-[28px] bg-[#182E6F] p-6 text-white shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-[#B4C6EE]">{periodLabel}</p>

          {activeDayPoint ? (
            <button
              type="button"
              onClick={() => setSelectedBarIndex(null)}
              className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-[11px] font-bold text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Full week</span>
            </button>
          ) : (
            <span className="text-[11px] text-[#94A8D6]">Tap any day bar</span>
          )}
        </div>

        <p className="text-[40px] font-extrabold tracking-tight leading-none mt-1.5">
          {settings.privacy_hide_balance ? `${currency} ****` : `${currency} ${formatWholeNumberWithCommas(totalMinor)}`}
        </p>

        {activeDayPoint ? (
          <p className="text-xs font-semibold text-[#F5BA36] mt-2">
            {activeDayPoint.paymentCount}{' '}
            {activeDayPoint.paymentCount === 1 ? 'payment' : 'payments'} · Telebirr{' '}
            {currency} {formatWholeNumberWithCommas(activeDayPoint.telebirrMinorUnits)} ·
            Cash {currency} {formatWholeNumberWithCommas(activeDayPoint.cashMinorUnits)}
          </p>
        ) : (
          <p className="text-xs font-semibold text-[#5CA4F8] mt-2">
            {report.incomingPaymentCount} payments · Yesterday {currency}{' '}
            {formatWholeNumberWithCommas(yesterdayReport.combinedNetIncomeMinorUnits)}
          </p>
        )}

        {/* Interactive 7-Day Bar Chart (M T W T F S S) — Vertical length strictly proportional to money collected */}
        <div className="mt-5 grid grid-cols-7 gap-2.5 items-end pt-2">
          {chartPoints.map((pt, idx) => {
            const isClicked = selectedBarIndex === idx;
            const isHighlighted =
              selectedBarIndex !== null
                ? isClicked
                : idx === chartPoints.length - 1;
            const barHeightPx =
              pt.netMinorUnits > 0
                ? Math.max(
                    8,
                    Math.round((pt.netMinorUnits / maxVal) * MAX_BAR_HEIGHT_PX)
                  )
                : 4;
            const dayShort = WEEKDAY_SHORT[idx] || pt.label;
            const amtShort = formatWholeNumberWithCommas(pt.netMinorUnits);

            return (
              <button
                key={pt.isoDate}
                type="button"
                onClick={() =>
                  setSelectedBarIndex((prev) => (prev === idx ? null : idx))
                }
                aria-label={`Inspect ${WEEKDAY_FULL_LABELS[pt.isoDate] || pt.isoDate}: ${currency} ${amtShort}`}
                className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                {/* Only show the amount pill when this specific bar is clicked */}
                <div className="h-5 flex items-center justify-center">
                  {isClicked && (
                    <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded-md bg-[#F5BA36] text-[#09152B] shadow-sm whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                      {amtShort}
                    </span>
                  )}
                </div>

                {/* Fixed-Height Track so Bar Vertical Length is 100% Proportional to Money Collected */}
                <div className="w-full h-[96px] flex items-end justify-center">
                  <div
                    style={{ height: `${barHeightPx}px` }}
                    className={`w-full rounded-xl transition-all duration-300 ${
                      isHighlighted
                        ? 'bg-[#F5BA36] shadow-[0_4px_14px_rgba(245,186,54,0.45)]'
                        : 'bg-[#2B4692] group-hover:bg-[#3B5BB5] active:scale-95'
                    }`}
                  />
                </div>

                {/* Day Letter Pill */}
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold transition-colors ${
                    isHighlighted
                      ? 'bg-white/20 text-white'
                      : 'text-[#94A8D6] group-hover:text-white'
                  }`}
                >
                  {dayShort}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Telebirr vs Cash Split Card */}
      <section
        className={`rounded-[24px] p-5 ${
          isDark
            ? 'bg-[#141B2D]'
            : 'bg-white border border-slate-200/80 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2
            className={`text-base font-extrabold ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            Telebirr vs cash {activeDayPoint ? `(${activeDayPoint.label})` : ''}
          </h2>
          <span className="text-sm font-semibold text-[#8E9BAE]">
            {telebirrPct} / {cashPct}
          </span>
        </div>

        <div className="mt-3.5 flex items-center gap-1.5 h-2.5 w-full">
          <div
            style={{ width: `${telebirrPct}%` }}
            className="h-full bg-[#5CA4F8] rounded-full transition-all duration-300"
          />
          <div
            style={{ width: `${cashPct}%` }}
            className="h-full bg-[#F5BA36] rounded-full transition-all duration-300"
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between text-xs font-bold">
          <span className="text-[#5CA4F8]">
            Telebirr {formatWholeNumberWithCommas(telebirrMinor)}
          </span>
          <span className="text-[#F5BA36]">
            Cash {formatWholeNumberWithCommas(cashMinor)}
          </span>
        </div>
      </section>

      {/* 2-Column Summary Cards: Completed trips & Avg per trip */}
      <div className="grid grid-cols-2 gap-3.5">
        <div
          className={`rounded-[24px] p-5 ${
            isDark
              ? 'bg-[#141B2D]'
              : 'bg-white border border-slate-200/80 shadow-xs'
          }`}
        >
          <p className="text-xs font-medium text-[#8E9BAE]">Completed trips</p>
          <p
            className={`text-[32px] font-extrabold leading-tight mt-1 ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            {completedTripsDisplay}
          </p>
        </div>

        <div
          className={`rounded-[24px] p-5 ${
            isDark
              ? 'bg-[#141B2D]'
              : 'bg-white border border-slate-200/80 shadow-xs'
            }`}
        >
          <p className="text-xs font-medium text-[#8E9BAE]">Avg per trip</p>
          <p
            className={`text-[30px] font-extrabold leading-tight mt-1 ${
              isDark ? 'text-white' : 'text-[#0F172A]'
            }`}
          >
            {currency} {avgPerTripDisplay}
          </p>
        </div>
      </div>

      {/* Highest-Earning Trip Card (100% Real Recorded Trip Data — No Dummy Fallbacks) */}
      <section
        className={`rounded-[24px] p-5 space-y-2.5 ${
          isDark
            ? 'bg-[#141B2D]'
            : 'bg-white border border-slate-200/80 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#8E9BAE]">
              Highest-earning trip ({highestTripForSelection.contextLabel})
              {highestTripForSelection.paymentCount > 0
                ? ` · ${highestTripForSelection.paymentCount} ${
                    highestTripForSelection.paymentCount === 1
                      ? 'payment'
                      : 'payments'
                  }`
                : ''}
            </p>
            <p
              className={`text-lg font-extrabold mt-0.5 ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              {highestTripForSelection.route}
            </p>
          </div>

          <span className="text-2xl font-extrabold text-[#F5BA36] tabular-nums shrink-0">
            {currency}{' '}
            {formatWholeNumberWithCommas(
              highestTripForSelection.amountMinorUnits
            )}
          </span>
        </div>

        {highestEarningDay && (
          <div
            className={`pt-2.5 border-t flex items-center justify-between text-xs ${
              isDark
                ? 'border-white/5 text-[#8E9BAE]'
                : 'border-slate-100 text-slate-500'
            }`}
          >
            <span>Highest-earning day of week</span>
            <span className="font-bold text-[#2CD48D] tabular-nums">
              {(
                WEEKDAY_FULL_LABELS[highestEarningDay.isoDate] ||
                highestEarningDay.label
              ).replace(' (Today)', '')}{' '}
              · {currency}{' '}
              {formatWholeNumberWithCommas(highestEarningDay.netMinorUnits)}
            </span>
          </div>
        )}
      </section>

      {/* CSV Export Actions */}
      <div
        className={`rounded-[24px] p-4 space-y-2.5 ${
          isDark
            ? 'bg-[#141B2D]/70 border border-white/5'
            : 'bg-white border border-slate-200/80 shadow-xs'
        }`}
      >
        <p className="text-xs font-bold text-[#8E9BAE]">
          Export Offline CSV Reports
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleExportTransactionsCsv}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
              isDark
                ? 'bg-[#1E2B45] text-white hover:bg-[#263757]'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-[#2CD48D]" />
            Payments
          </button>
          <button
            type="button"
            onClick={handleExportTripsCsv}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
              isDark
                ? 'bg-[#1E2B45] text-white hover:bg-[#263757]'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-[#5CA4F8]" />
            Trips
          </button>
          <button
            type="button"
            onClick={handleExportDailyCsv}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
              isDark
                ? 'bg-[#1E2B45] text-white hover:bg-[#263757]'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-[#F5BA36]" />
            Daily CSV
          </button>
        </div>
      </div>
    </div>
  );
};
