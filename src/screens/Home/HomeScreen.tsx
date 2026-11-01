import React from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Link2,
  MapPin,
  MessageSquarePlus,
  Navigation,
  RotateCcw,
  ShieldCheck,
  StopCircle,
} from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import {
  PaymentMethod,
  TransactionStatus,
  TripStatus,
} from '../../database/schema';
import {
  calculateTripTotalMinorUnits,
  computeFinancialReport,
  isOutgoingTransaction,
  isPositiveIncomingTransaction,
} from '../../services/reports/reportService';
import {
  formatDurationSeconds,
  formatIsoToShortTime,
  formatMinorUnits,
} from '../../utils/formatters';
import { LiveTripMap } from '../../components/LiveTripMap';

interface HomeScreenProps {
  onNavigate: (tab: 'home' | 'trips' | 'transactions' | 'reports' | 'settings') => void;
  onOpenTripModal: (mode: 'START' | 'END') => void;
  onOpenCashModal: (tripId?: string | null) => void;
  onOpenSmsSimulator: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onOpenTripModal,
  onOpenCashModal,
  onOpenSmsSimulator,
}) => {
  const {
    trips,
    transactions,
    settings,
    setSmsPermissionStatus,
    assignTransactionToTrip,
  } = useTripBirrStore();

  const currency = settings.currency_display;
  const activeTrip = trips.find((t) => t.status === TripStatus.ACTIVE) || null;
  const activeTripSummary = activeTrip
    ? calculateTripTotalMinorUnits(activeTrip.id, transactions)
    : null;

  const todayReport = computeFinancialReport(
    trips,
    transactions,
    'TODAY',
    '2026-10-21'
  );

  const unassignedIncomingTransactions = transactions.filter(
    (tx) =>
      isPositiveIncomingTransaction(tx) &&
      tx.transaction_status === TransactionStatus.VALID &&
      tx.trip_id === null
  );

  const recentTransactions = transactions.slice(0, 6);
  const recentCompletedTrips = trips
    .filter((t) => t.status === TripStatus.COMPLETED)
    .slice(0, 4);

  return (
    <div className="space-y-8">
      {/* SMS Permission Warning Banner (Section 4) */}
      {settings.sms_permission_status !== 'GRANTED' && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E9A23B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#E9A23B] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-[#172B25] dark:text-[#EDF6F0]">
                Android SMS Permission Required for Automatic Telebirr 127 Detection
              </h2>
              <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-1 max-w-2xl">
                {settings.app_name} only inspects incoming messages from Telebirr sender ID{' '}
                <span className="font-mono font-semibold">127</span> to extract payment amounts and
                sender names while you drive. Your personal inbox is never read or uploaded.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSmsPermissionStatus('GRANTED')}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#16866A] text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            Grant RECEIVE_SMS Permission
          </button>
        </div>
      )}

      {/* Dominant Focal Anchor: Active Trip Card OR Start Trip Command Center */}
      {activeTrip && activeTripSummary ? (
        <section className="rounded-2xl bg-[#123C35] text-white p-6 sm:p-7 border border-[#16866A]/40 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#DDF5E9] font-medium">
                <Navigation className="w-3.5 h-3.5 text-[#43C99A]" />
                <span>Active Trip in Progress</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Started {formatIsoToShortTime(activeTrip.start_time)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{activeTrip.start_location_source}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
                From {activeTrip.start_location_name}
              </h1>

              {activeTrip.notes && (
                <p className="text-xs text-[#DDF5E9]/80">{activeTrip.notes}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onOpenSmsSimulator}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <MessageSquarePlus className="w-4 h-4 text-[#43C99A]" />
                Simulate 127 SMS
              </button>
              <button
                type="button"
                onClick={() => onOpenCashModal(activeTrip.id)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <Banknote className="w-4 h-4 text-[#43C99A]" />
                Add Cash Fare
              </button>
              <button
                type="button"
                onClick={() => onOpenTripModal('END')}
                className="min-h-[48px] px-6 py-2.5 rounded-xl bg-[#43C99A] text-[#101A17] text-sm font-bold flex items-center gap-2 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
              >
                <StopCircle className="w-4 h-4" />
                End Trip
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-xs text-[#DDF5E9]/80">Total Collected So Far</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-[#43C99A] mt-1">
                {formatMinorUnits(activeTripSummary.totalMinorUnits, currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#DDF5E9]/80">Associated Payments</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                {activeTripSummary.paymentCount}{' '}
                <span className="text-xs font-normal text-[#DDF5E9]/80">
                  ({formatMinorUnits(activeTripSummary.telebirrMinorUnits, currency)} Telebirr)
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-[#DDF5E9]/80">Start Coordinates</p>
              <p className="text-sm font-mono tabular-nums text-white mt-2">
                {activeTrip.start_latitude && activeTrip.start_longitude
                  ? `${activeTrip.start_latitude.toFixed(4)}° N, ${activeTrip.start_longitude.toFixed(4)}° E`
                  : 'Manual Entry'}
              </p>
            </div>
          </div>

          {/* Live Interactive Map for the Active Trip */}
          <div className="mt-6">
            <LiveTripMap
              trip={activeTrip}
              associatedTransactions={activeTripSummary.transactions}
              currency={currency}
            />
          </div>

          {activeTripSummary.transactions.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/15">
              <p className="text-xs font-semibold text-[#DDF5E9] mb-2.5">
                Payments Linked to This Active Trip
              </p>
              <div className="divide-y divide-white/10">
                {activeTripSummary.transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="py-2 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#43C99A]" />
                      <span className="font-semibold text-white">
                        {tx.sender_name || 'Passenger'}
                      </span>
                      <span aria-hidden="true" className="text-white/40">
                        ·
                      </span>
                      <span className="font-mono text-[#DDF5E9]/80">
                        {tx.transaction_id || tx.payment_method}
                      </span>
                      <span aria-hidden="true" className="text-white/40">
                        ·
                      </span>
                      <span className="font-mono text-[#DDF5E9]/80">
                        {tx.transaction_time.slice(0, 5)}
                      </span>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-[#43C99A]">
                      +{formatMinorUnits(tx.amount_minor_units, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] p-6 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-[#16866A] dark:text-[#43C99A] font-semibold">
                <MapPin className="w-3.5 h-3.5" />
                <span>Ready for Next Passenger Trip</span>
                <span aria-hidden="true">·</span>
                <span>Sender 127 Listener Active</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172B25] dark:text-[#EDF6F0] text-balance">
                Start a Trip to Track Incoming Telebirr Fares
              </h1>
              <p className="text-sm text-[#75847D] dark:text-[#94A8A0] max-w-2xl">
                Record your starting location (such as 4 Kilo or Bole) and automatically link incoming
                Telebirr 127 SMS notifications to calculate exact earnings per trip.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onOpenSmsSimulator}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-2 hover:border-[#16866A] transition-colors whitespace-nowrap shrink-0"
              >
                <MessageSquarePlus className="w-4 h-4 text-[#16866A] dark:text-[#43C99A]" />
                Test Incoming 127 SMS
              </button>
              <button
                type="button"
                onClick={() => onOpenCashModal(null)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-2 hover:border-[#16866A] transition-colors whitespace-nowrap shrink-0"
              >
                <Banknote className="w-4 h-4 text-[#16866A] dark:text-[#43C99A]" />
                Record Cash
              </button>
              <button
                type="button"
                onClick={() => onOpenTripModal('START')}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-[#16866A] dark:bg-[#43C99A] text-white dark:text-[#101A17] text-sm font-bold flex items-center gap-2 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
              >
                <Navigation className="w-4 h-4" />
                Start Trip
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 6 Core Dashboard Metrics (Section 9) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#172B25] dark:text-[#EDF6F0]">
            Today&apos;s Earnings & Trip Summary
          </h2>
          <span className="text-xs text-[#75847D] dark:text-[#94A8A0] font-mono tabular-nums">
            21/10/2026 · Offline SQLite Ledger
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Today's Total Collections */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
            <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
              01. Today&apos;s Net Collections
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-2">
              {formatMinorUnits(todayReport.combinedNetIncomeMinorUnits, currency)}
            </p>
            <div className="flex items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0] mt-2">
              <span>
                Telebirr: {formatMinorUnits(todayReport.netTelebirrIncomingMinorUnits, currency)}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Cash: {formatMinorUnits(todayReport.manualCashIncomingMinorUnits, currency)}
              </span>
            </div>
          </div>

          {/* 2. Number of Incoming Payments */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
            <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
              02. Incoming Payments Today
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-2">
              {todayReport.incomingPaymentCount} payments
            </p>
            <div className="flex items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0] mt-2">
              <span>Verified Sender 127</span>
              <span aria-hidden="true">·</span>
              <span>Excludes outgoing & promos</span>
            </div>
          </div>

          {/* 3. Completed Trips */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
            <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
              03. Completed Trips Today
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-2">
              {todayReport.completedTripsCount} trips
            </p>
            <div className="flex items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0] mt-2">
              <span>{activeTrip ? '1 trip currently active' : 'No trip currently active'}</span>
            </div>
          </div>

          {/* 4. Total Payments Associated With Trips */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
            <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
              04. Trip-Associated Payments
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#22A06B] dark:text-[#43C99A] mt-2">
              {formatMinorUnits(todayReport.assignedPaymentsMinorUnits, currency)}
            </p>
            <div className="flex items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0] mt-2">
              <span>Linked to active or completed trips</span>
            </div>
          </div>

          {/* 5. Unassigned Payment Total */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
                05. Unassigned Payment Total
              </p>
              {todayReport.unassignedPaymentCount > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate('transactions')}
                  className="text-xs font-semibold text-[#16866A] dark:text-[#43C99A] hover:underline"
                >
                  Assign ({todayReport.unassignedPaymentCount})
                </button>
              )}
            </div>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#E9A23B] mt-2">
              {formatMinorUnits(todayReport.unassignedPaymentsMinorUnits, currency)}
            </p>
            <div className="flex items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0] mt-2">
              <span>Received outside active trips · Never discarded</span>
            </div>
          </div>

          {/* 6. Average Income per Completed Trip */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
            <p className="text-xs font-medium text-[#75847D] dark:text-[#94A8A0]">
              06. Average Income per Trip
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-2">
              {formatMinorUnits(
                todayReport.averageIncomePerCompletedTripMinorUnits,
                currency
              )}
            </p>
            <div className="flex items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0] mt-2">
              <span>Across {todayReport.completedTripsCount} completed trips today</span>
            </div>
          </div>
        </div>
      </section>

      {/* Unassigned Payments Quick Assignment Bar (if any exist) */}
      {unassignedIncomingTransactions.length > 0 && (
        <section className="rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E3EAE5] dark:border-[#253831]">
            <div>
              <h3 className="text-sm font-bold text-[#172B25] dark:text-[#EDF6F0]">
                Unassigned Telebirr Payments Awaiting Trip Link ({unassignedIncomingTransactions.length})
              </h3>
              <p className="text-xs text-[#75847D] dark:text-[#94A8A0]">
                Payments received between trips are preserved safely. Link them to a trip below:
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#E3EAE5] dark:divide-[#253831] mt-2">
            {unassignedIncomingTransactions.slice(0, 3).map((tx) => (
              <div
                key={tx.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                    <span className="font-mono font-bold text-[#16866A] dark:text-[#43C99A]">
                      {formatMinorUnits(tx.amount_minor_units, currency)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{tx.sender_name || 'Unknown Sender'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5 font-mono">
                    <span>TX: {tx.transaction_id || 'NO_ID'}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {tx.transaction_date} {tx.transaction_time.slice(0, 5)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#75847D] shrink-0" />
                  <select
                    value={tx.trip_id || ''}
                    onChange={(e) =>
                      assignTransactionToTrip(tx.id, e.target.value || null)
                    }
                    className="h-9 px-3 rounded-lg bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-xs text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
                  >
                    <option value="">Select trip to assign...</option>
                    {trips
                      .filter((t) => t.status !== TripStatus.CANCELLED)
                      .map((trip) => (
                        <option key={trip.id} value={trip.id}>
                          {trip.status === TripStatus.ACTIVE ? '[ACTIVE] ' : ''}
                          {trip.start_location_name.replace(', Addis Ababa', '')} →{' '}
                          {(trip.end_location_name || 'Active').replace(', Addis Ababa', '')}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2-Column Split: Recent Transactions & Recent Trips (Section 9) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Recent Transactions (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#E3EAE5] dark:border-[#253831]">
              <div>
                <h2 className="text-base font-bold text-[#172B25] dark:text-[#EDF6F0]">
                  Recent Telebirr & Cash Transactions
                </h2>
                <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
                  Automatically parsed from sender ID 127 and local cash records
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('transactions')}
                className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold text-[#16866A] dark:text-[#43C99A] hover:bg-[#F5F7F5] dark:hover:bg-[#101A17] flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
              >
                View All
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[#E3EAE5] dark:divide-[#253831]">
              {recentTransactions.map((tx) => {
                const isIncoming = isPositiveIncomingTransaction(tx);
                const isOutgoing = isOutgoingTransaction(tx);
                const linkedTrip = tx.trip_id
                  ? trips.find((t) => t.id === tx.trip_id)
                  : null;

                return (
                  <div
                    key={tx.id}
                    className="py-3.5 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isIncoming
                            ? 'bg-[#DDF5E9] dark:bg-[#1D352D] text-[#16866A] dark:text-[#43C99A]'
                            : isOutgoing
                            ? 'bg-[#F5F7F5] dark:bg-[#101A17] text-[#75847D]'
                            : 'bg-[#E9A23B]/15 text-[#E9A23B]'
                        }`}
                      >
                        {isIncoming ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : isOutgoing ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#172B25] dark:text-[#EDF6F0] truncate">
                          {tx.sender_name || 'Unknown Counterparty'}
                        </p>
                        {/* Clean unboxed metadata with typographic separators */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
                          <span className="font-mono">
                            {tx.transaction_id || tx.payment_method}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {tx.transaction_time.slice(0, 5)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">
                            {linkedTrip
                              ? `${linkedTrip.start_location_name.replace(', Addis Ababa', '')} → ${(linkedTrip.end_location_name || 'Active').replace(', Addis Ababa', '')}`
                              : isIncoming
                              ? 'Unassigned'
                              : tx.transaction_type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-bold font-mono tabular-nums ${
                          isIncoming && tx.transaction_status === TransactionStatus.VALID
                            ? 'text-[#22A06B] dark:text-[#43C99A]'
                            : isOutgoing
                            ? 'text-[#75847D] dark:text-[#94A8A0]'
                            : 'text-[#D9534F]'
                        }`}
                      >
                        {isIncoming ? '+' : '-'}
                        {formatMinorUnits(tx.amount_minor_units, currency)}
                      </p>
                      <p className="text-[11px] text-[#75847D] dark:text-[#94A8A0] mt-0.5">
                        {tx.payment_method === PaymentMethod.CASH
                          ? 'Manual Cash'
                          : `SMS ${tx.sms_sender}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Completed Trips (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#E3EAE5] dark:border-[#253831]">
              <div>
                <h2 className="text-base font-bold text-[#172B25] dark:text-[#EDF6F0]">
                  Recent Trips
                </h2>
                <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
                  Per-trip passenger collections and durations
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('trips')}
                className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold text-[#16866A] dark:text-[#43C99A] hover:bg-[#F5F7F5] dark:hover:bg-[#101A17] flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
              >
                All Trips
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[#E3EAE5] dark:divide-[#253831]">
              {recentCompletedTrips.map((trip) => {
                const summary = calculateTripTotalMinorUnits(trip.id, transactions);
                return (
                  <div key={trip.id} className="py-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                        {trip.start_location_name.replace(', Addis Ababa', '')} →{' '}
                        {(trip.end_location_name || 'Completed').replace(', Addis Ababa', '')}
                      </p>
                      <span className="text-sm font-bold font-mono tabular-nums text-[#16866A] dark:text-[#43C99A] shrink-0">
                        {formatMinorUnits(summary.totalMinorUnits, currency)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0]">
                      <span className="font-mono tabular-nums">
                        {summary.paymentCount} {summary.paymentCount === 1 ? 'payment' : 'payments'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Duration: {formatDurationSeconds(trip.duration)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatIsoToShortTime(trip.start_time)}–{formatIsoToShortTime(trip.end_time)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-[#E3EAE5] dark:border-[#253831] flex items-center justify-between text-xs text-[#75847D] dark:text-[#94A8A0]">
            <span>Example: 4 Kilo → Piassa (3 payments)</span>
            <span className="font-mono font-semibold text-[#172B25] dark:text-[#EDF6F0]">
              ETB 100.00
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
