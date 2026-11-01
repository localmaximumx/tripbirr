import React, { useState } from 'react';
import { Download, TrendingUp } from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import {
  computeFinancialReport,
  generateReportCsv,
  ReportDateRangePreset,
} from '../../services/reports/reportService';
import { formatMinorUnits } from '../../utils/formatters';

export const ReportsScreen: React.FC = () => {
  const { trips, transactions, settings } = useTripBirrStore();
  const currency = settings.currency_display;

  const [preset, setPreset] = useState<ReportDateRangePreset>('LAST_7_DAYS');
  const [customStart, setCustomStart] = useState('2026-10-15');
  const [customEnd, setCustomEnd] = useState('2026-10-21');

  const report = computeFinancialReport(
    trips,
    transactions,
    preset,
    '2026-10-21',
    customStart,
    customEnd
  );

  const handleExportCsv = () => {
    const csvContent = generateReportCsv(transactions, trips);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tripbirr_financial_report_${preset.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxTripMinor = Math.max(
    1000,
    ...report.tripBreakdowns.map((tb) => tb.totalMinorUnits)
  );

  const maxDailyMinor = Math.max(
    1000,
    ...report.dailySeries.map((d) => d.netMinorUnits)
  );

  return (
    <div className="space-y-6">
      {/* Header & CSV Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#172B25] dark:text-[#EDF6F0]">
            Earnings Reports & Financial Analytics
          </h1>
          <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
            Calculated strictly from validated SQLite minor-unit records (excludes failed, unknown, and outgoing SMS)
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#123C35] dark:bg-[#43C99A] text-white dark:text-[#101A17] text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          Download CSV Report
        </button>
      </div>

      {/* Time Filter Bar (Section 12) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] rounded-xl">
          {(
            [
              { id: 'TODAY', label: 'Today' },
              { id: 'YESTERDAY', label: 'Yesterday' },
              { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
              { id: 'LAST_30_DAYS', label: 'Last 30 Days' },
              { id: 'ALL_TIME', label: 'All Time' },
              { id: 'CUSTOM', label: 'Custom Range' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                preset === item.id
                  ? 'bg-[#16866A] text-white dark:bg-[#43C99A] dark:text-[#101A17]'
                  : 'text-[#75847D] dark:text-[#94A8A0] hover:text-[#172B25] dark:hover:text-[#EDF6F0]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {preset === 'CUSTOM' && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-10 px-3 rounded-xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]"
            />
            <span>to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-10 px-3 rounded-xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]"
            />
          </div>
        )}
      </div>

      {/* Primary Financial Statistics Grid (Section 12) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
          <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
            Net Telebirr Incoming
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#22A06B] dark:text-[#43C99A] mt-2">
            {formatMinorUnits(report.netTelebirrIncomingMinorUnits, currency)}
          </p>
          <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-1.5 font-mono">
            Gross: {formatMinorUnits(report.grossTelebirrIncomingMinorUnits, currency)} ·
            Reversals: -{formatMinorUnits(report.reversalsAndRefundsMinorUnits, currency)}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
          <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
            Manual Cash Income
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-2">
            {formatMinorUnits(report.manualCashIncomingMinorUnits, currency)}
          </p>
          <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-1.5">
            Combined Net: {formatMinorUnits(report.combinedNetIncomeMinorUnits, currency)}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
          <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
            Outgoing Telebirr (Separate)
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#75847D] dark:text-[#94A8A0] mt-2">
            {formatMinorUnits(report.outgoingTransactionsMinorUnits, currency)}
          </p>
          <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-1.5">
            Never counted toward driver earnings
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
          <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
            Average Daily Income
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-2">
            {formatMinorUnits(report.averageDailyIncomeMinorUnits, currency)}
          </p>
          <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-1.5">
            Unassigned: {formatMinorUnits(report.unassignedPaymentsMinorUnits, currency)}
          </p>
        </div>
      </div>

      {/* Trip Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
          <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
            Average Income per Completed Trip
          </p>
          <p className="text-xl font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-1.5">
            {formatMinorUnits(report.averageIncomePerCompletedTripMinorUnits, currency)}
          </p>
          <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-1">
            Across {report.completedTripsCount} completed trips
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
          <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
            Highest-Earning Trip
          </p>
          <p className="text-xl font-bold font-mono tabular-nums text-[#22A06B] dark:text-[#43C99A] mt-1.5">
            {report.highestEarningTrip
              ? formatMinorUnits(report.highestEarningTrip.totalMinorUnits, currency)
              : '—'}
          </p>
          <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-1 truncate">
            {report.highestEarningTrip
              ? `${report.highestEarningTrip.trip.start_location_name.replace(', Addis Ababa', '')} → ${(report.highestEarningTrip.trip.end_location_name || '').replace(', Addis Ababa', '')}`
              : 'No completed trips'}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
          <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
            Lowest-Earning Trip
          </p>
          <p className="text-xl font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-1.5">
            {report.lowestEarningTrip
              ? formatMinorUnits(report.lowestEarningTrip.totalMinorUnits, currency)
              : '—'}
          </p>
          <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-1 truncate">
            {report.lowestEarningTrip
              ? `${report.lowestEarningTrip.trip.start_location_name.replace(', Addis Ababa', '')} → ${(report.lowestEarningTrip.trip.end_location_name || '').replace(', Addis Ababa', '')}`
              : 'No completed trips'}
          </p>
        </div>
      </div>

      {/* Charts Section (Section 12) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Per Completed Trip Chart */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#16866A] dark:text-[#43C99A]" />
                Income per Completed Trip
              </h2>
              <p className="text-xs text-[#75847D] dark:text-[#94A8A0]">
                Comparing Telebirr SMS collections vs manual cash per trip
              </p>
            </div>
          </div>

          {report.tripBreakdowns.length === 0 ? (
            <p className="text-xs text-[#75847D] py-8 text-center">
              No completed trips in selected period.
            </p>
          ) : (
            <div className="space-y-4">
              {report.tripBreakdowns.map((tb) => {
                const widthPct = Math.max(
                  6,
                  Math.round((tb.totalMinorUnits / maxTripMinor) * 100)
                );
                return (
                  <div key={tb.trip.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#172B25] dark:text-[#EDF6F0] truncate">
                        {tb.trip.start_location_name.replace(', Addis Ababa', '')} →{' '}
                        {(tb.trip.end_location_name || '').replace(', Addis Ababa', '')}
                      </span>
                      <span className="font-mono font-bold tabular-nums text-[#172B25] dark:text-[#EDF6F0]">
                        {formatMinorUnits(tb.totalMinorUnits, currency)} ({tb.paymentCount} pmts)
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-[#F5F7F5] dark:bg-[#101A17] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#16866A] dark:bg-[#43C99A]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Daily Income Breakdown Chart */}
        <div className="p-6 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#172B25] dark:text-[#EDF6F0]">
              Daily Earnings Breakdown
            </h2>
            <p className="text-xs text-[#75847D] dark:text-[#94A8A0]">
              Daily incoming collections and payment counts
            </p>
          </div>

          {report.dailySeries.length === 0 ? (
            <p className="text-xs text-[#75847D] py-8 text-center">
              No incoming transactions recorded in this date window.
            </p>
          ) : (
            <div className="space-y-4">
              {report.dailySeries.map((day) => {
                const widthPct = Math.max(
                  6,
                  Math.round((day.netMinorUnits / maxDailyMinor) * 100)
                );
                return (
                  <div key={day.isoDate} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                        {day.isoDate} ({day.paymentCount} payments)
                      </span>
                      <span className="font-mono font-bold tabular-nums text-[#22A06B] dark:text-[#43C99A]">
                        {formatMinorUnits(day.netMinorUnits, currency)}
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-[#F5F7F5] dark:bg-[#101A17] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#123C35] dark:bg-[#43C99A]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
