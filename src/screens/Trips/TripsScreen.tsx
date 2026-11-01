import React, { useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Edit3,
  Link2,
  MapPin,
  Navigation,
  Plus,
  StopCircle,
  Trash2,
  Unlink,
} from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import { TransactionStatus, TripRecord, TripStatus } from '../../database/schema';
import {
  calculateTripTotalMinorUnits,
  isPositiveIncomingTransaction,
} from '../../services/reports/reportService';
import {
  formatDurationSeconds,
  formatIsoToDateAndTime,
  formatIsoToShortTime,
  formatMinorUnits,
} from '../../utils/formatters';
import { LiveTripMap } from '../../components/LiveTripMap';

interface TripsScreenProps {
  onOpenTripModal: (mode: 'START' | 'END') => void;
  onOpenCashModal: (tripId?: string | null) => void;
}

export const TripsScreen: React.FC<TripsScreenProps> = ({
  onOpenTripModal,
  onOpenCashModal,
}) => {
  const {
    trips,
    transactions,
    settings,
    assignTransactionToTrip,
    updateTripDetails,
    deleteTrip,
    cancelTrip,
  } = useTripBirrStore();

  const currency = settings.currency_display;
  const [selectedTripId, setSelectedTripId] = useState<string>(
    trips[0]?.id || ''
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | TripStatus>('ALL');
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [editStartName, setEditStartName] = useState('');
  const [editEndName, setEditEndName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredTrips = trips.filter((t) =>
    statusFilter === 'ALL' ? true : t.status === statusFilter
  );

  const selectedTrip: TripRecord | null =
    trips.find((t) => t.id === selectedTripId) || filteredTrips[0] || null;

  const selectedSummary = selectedTrip
    ? calculateTripTotalMinorUnits(selectedTrip.id, transactions)
    : null;

  const unassignedPayments = transactions.filter(
    (tx) =>
      isPositiveIncomingTransaction(tx) &&
      tx.transaction_status === TransactionStatus.VALID &&
      tx.trip_id === null
  );

  const handleBeginEdit = (trip: TripRecord) => {
    setEditStartName(trip.start_location_name);
    setEditEndName(trip.end_location_name || '');
    setEditNotes(trip.notes || '');
    setIsEditingTrip(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;
    updateTripDetails(selectedTrip.id, {
      start_location_name: editStartName.trim() || selectedTrip.start_location_name,
      end_location_name: editEndName.trim() || selectedTrip.end_location_name,
      notes: editNotes.trim() || null,
    });
    setIsEditingTrip(false);
  };

  const activeTrip = trips.find((t) => t.status === TripStatus.ACTIVE);

  return (
    <div className="space-y-6">
      {/* Header & Primary Trip Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#172B25] dark:text-[#EDF6F0]">
            Trips & Payment Associations
          </h1>
          <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
            Record start and destination points and manage multi-passenger Telebirr collections per trip
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTrip ? (
            <button
              type="button"
              onClick={() => onOpenTripModal('END')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#123C35] dark:bg-[#43C99A] text-white dark:text-[#101A17] text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <StopCircle className="w-4 h-4" />
              End Active Trip
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenTripModal('START')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#16866A] dark:bg-[#43C99A] text-white dark:text-[#101A17] text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Navigation className="w-4 h-4" />
              Start New Trip
            </button>
          )}
        </div>
      </div>

      {/* Interactive Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] rounded-xl w-fit">
        {(['ALL', TripStatus.ACTIVE, TripStatus.COMPLETED, TripStatus.CANCELLED] as const).map(
          (st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-[#123C35] text-white dark:bg-[#43C99A] dark:text-[#101A17]'
                  : 'text-[#75847D] dark:text-[#94A8A0] hover:text-[#172B25] dark:hover:text-[#EDF6F0]'
              }`}
            >
              {st === 'ALL' ? `All Trips (${trips.length})` : st}
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Trip History Cards (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          {filteredTrips.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] text-center">
              <p className="text-sm font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                No trips match this filter
              </p>
              <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-1">
                Tap Start New Trip to record your starting location.
              </p>
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const summary = calculateTripTotalMinorUnits(trip.id, transactions);
              const isSelected = selectedTrip?.id === trip.id;

              return (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => {
                    setSelectedTripId(trip.id);
                    setIsEditingTrip(false);
                    setConfirmDeleteId(null);
                  }}
                  className={`w-full text-left p-5 rounded-2xl transition-colors border ${
                    isSelected
                      ? 'bg-white dark:bg-[#192722] border-[#16866A] dark:border-[#43C99A] shadow-xs'
                      : 'bg-white/80 dark:bg-[#192722]/70 border-[#E3EAE5] dark:border-[#253831] hover:border-[#16866A]/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0]">
                        <span className="font-semibold text-[#16866A] dark:text-[#43C99A]">
                          {trip.status}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatIsoToDateAndTime(trip.start_time)}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-[#172B25] dark:text-[#EDF6F0] mt-1">
                        {trip.start_location_name.replace(', Addis Ababa', '')} →{' '}
                        {(trip.end_location_name || 'In Progress').replace(', Addis Ababa', '')}
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0]">
                        {formatMinorUnits(summary.totalMinorUnits, currency)}
                      </p>
                      <p className="text-xs font-mono text-[#75847D] dark:text-[#94A8A0]">
                        {summary.paymentCount}{' '}
                        {summary.paymentCount === 1 ? 'payment' : 'payments'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0] mt-3 pt-3 border-t border-[#E3EAE5] dark:border-[#253831]">
                    <span className="font-mono tabular-nums">
                      Duration: {formatDurationSeconds(trip.duration)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Source: {trip.start_location_source}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Column: Trip Details Inspector & Endpoint Map (7 cols) */}
        <div className="lg:col-span-7">
          {selectedTrip && selectedSummary ? (
            <div className="rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] p-6 space-y-6">
              {/* Trip Details Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#E3EAE5] dark:border-[#253831]">
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0]">
                    <span className="font-bold text-[#16866A] dark:text-[#43C99A]">
                      {selectedTrip.status}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">ID: {selectedTrip.id}</span>
                  </div>
                  <h2 className="text-xl font-bold text-[#172B25] dark:text-[#EDF6F0] mt-1">
                    {selectedTrip.start_location_name} →{' '}
                    {selectedTrip.end_location_name || 'In Progress'}
                  </h2>
                  {selectedTrip.notes && (
                    <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-1">
                      {selectedTrip.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleBeginEdit(selectedTrip)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E3EAE5] dark:border-[#253831] text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-1.5 hover:border-[#16866A]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  {selectedTrip.status === TripStatus.ACTIVE && (
                    <button
                      type="button"
                      onClick={() => cancelTrip(selectedTrip.id)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E9A23B] text-xs font-semibold text-[#E9A23B]"
                    >
                      Cancel Trip
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(selectedTrip.id)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#E3EAE5] dark:border-[#253831] text-xs font-semibold text-[#D9534F] flex items-center gap-1.5 hover:border-[#D9534F]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Delete Confirmation Notice */}
              {confirmDeleteId === selectedTrip.id && (
                <div className="p-4 rounded-xl bg-[#D9534F]/10 border border-[#D9534F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-[#172B25] dark:text-[#EDF6F0]">
                    Delete this trip? Associated Telebirr payments will NOT be deleted—they will become{' '}
                    <span className="font-semibold">Unassigned</span> so your financial totals remain accurate.
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#192722] text-xs font-semibold"
                    >
                      Keep Trip
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteTrip(selectedTrip.id);
                        setConfirmDeleteId(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#D9534F] text-white text-xs font-semibold"
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Edit Trip Form */}
              {isEditingTrip && (
                <form
                  onSubmit={handleSaveEdit}
                  className="p-4 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] space-y-3"
                >
                  <p className="text-xs font-bold text-[#172B25] dark:text-[#EDF6F0]">
                    Edit Trip Locations & Notes
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[#75847D] mb-1">
                        Starting Location
                      </label>
                      <input
                        type="text"
                        value={editStartName}
                        onChange={(e) => setEditStartName(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#75847D] mb-1">
                        Ending Location
                      </label>
                      <input
                        type="text"
                        value={editEndName}
                        onChange={(e) => setEditEndName(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#75847D] mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingTrip(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-[#75847D]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-[#16866A] text-white text-xs font-semibold"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              )}

              {/* Trip Summary KPI Strip */}
              <div className="grid grid-cols-3 gap-4 py-3 px-4 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17]">
                <div>
                  <p className="text-xs text-[#75847D] dark:text-[#94A8A0]">Total Collected</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-[#16866A] dark:text-[#43C99A] mt-0.5">
                    {formatMinorUnits(selectedSummary.totalMinorUnits, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#75847D] dark:text-[#94A8A0]">Number of Payments</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-0.5">
                    {selectedSummary.paymentCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#75847D] dark:text-[#94A8A0]">Trip Duration</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-0.5">
                    {formatDurationSeconds(selectedTrip.duration)}
                  </p>
                </div>
              </div>

              {/* Interactive Live / Endpoint Map */}
              <LiveTripMap
                trip={selectedTrip}
                associatedTransactions={selectedSummary.transactions}
                currency={currency}
                compact
              />

              {/* Start & End Point Coordinate Plot (Section 7 & 11: Displays Start and End Points without fabricating a route) */}
              <div className="rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#16866A] dark:text-[#43C99A]" />
                    Recorded Start & End Endpoints (Addis Ababa Coordinate Grid)
                  </span>
                  <span className="text-[11px] text-[#75847D] dark:text-[#94A8A0]">
                    Point-only capture · No fabricated route
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
                    <p className="text-[11px] font-semibold text-[#16866A] dark:text-[#43C99A]">
                      START POINT ({selectedTrip.start_location_source})
                    </p>
                    <p className="font-semibold text-[#172B25] dark:text-[#EDF6F0] mt-0.5">
                      {selectedTrip.start_location_name}
                    </p>
                    <p className="font-mono text-[11px] text-[#75847D] dark:text-[#94A8A0] mt-1">
                      Time: {formatIsoToShortTime(selectedTrip.start_time)}
                      {selectedTrip.start_latitude && selectedTrip.start_longitude
                        ? ` · ${selectedTrip.start_latitude.toFixed(4)}°N, ${selectedTrip.start_longitude.toFixed(4)}°E (±${selectedTrip.start_location_accuracy || 12}m)`
                        : ' · Manual Entry'}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831]">
                    <p className="text-[11px] font-semibold text-[#123C35] dark:text-[#43C99A]">
                      END POINT ({selectedTrip.end_location_source || 'PENDING'})
                    </p>
                    <p className="font-semibold text-[#172B25] dark:text-[#EDF6F0] mt-0.5">
                      {selectedTrip.end_location_name || 'Trip currently active'}
                    </p>
                    <p className="font-mono text-[11px] text-[#75847D] dark:text-[#94A8A0] mt-1">
                      {selectedTrip.end_time
                        ? `Time: ${formatIsoToShortTime(selectedTrip.end_time)}`
                        : 'Awaiting arrival'}
                      {selectedTrip.end_latitude && selectedTrip.end_longitude
                        ? ` · ${selectedTrip.end_latitude.toFixed(4)}°N, ${selectedTrip.end_longitude.toFixed(4)}°E (±${selectedTrip.end_location_accuracy || 14}m)`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Associated Transactions List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#172B25] dark:text-[#EDF6F0]">
                    Associated Payments ({selectedSummary.transactions.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => onOpenCashModal(selectedTrip.id)}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#DDF5E9] dark:bg-[#1D352D] text-[#123C35] dark:text-[#43C99A] text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    Add Cash to Trip
                  </button>
                </div>

                {selectedSummary.transactions.length === 0 ? (
                  <div className="p-5 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] text-center text-xs text-[#75847D] dark:text-[#94A8A0]">
                    No payments currently associated with this trip. Attach an unassigned Telebirr
                    payment below or receive a new 127 SMS.
                  </div>
                ) : (
                  <div className="divide-y divide-[#E3EAE5] dark:divide-[#253831] border-t border-b border-[#E3EAE5] dark:border-[#253831]">
                    {selectedSummary.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                            <CheckCircle2 className="w-4 h-4 text-[#22A06B] dark:text-[#43C99A]" />
                            <span>{tx.sender_name || 'Passenger'}</span>
                            <span aria-hidden="true" className="text-[#75847D]">
                              ·
                            </span>
                            <span className="font-mono font-bold text-[#16866A] dark:text-[#43C99A]">
                              {formatMinorUnits(tx.amount_minor_units, currency)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#75847D] dark:text-[#94A8A0] font-mono mt-0.5">
                            <span>{tx.transaction_id || tx.payment_method}</span>
                            {tx.sender_phone && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{tx.sender_phone}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{tx.transaction_time}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => assignTransactionToTrip(tx.id, null)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E3EAE5] dark:border-[#253831] text-xs font-medium text-[#75847D] hover:text-[#D9534F] hover:border-[#D9534F] flex items-center gap-1 transition-colors"
                          title="Remove payment from this trip (marks payment as Unassigned)"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          Detach
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attach Unassigned Payments Section */}
              {unassignedPayments.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-bold text-[#75847D] dark:text-[#94A8A0] mb-2 flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5" />
                    Available Unassigned Payments ({unassignedPayments.length})
                  </h4>
                  <div className="space-y-2">
                    {unassignedPayments.map((utx) => (
                      <div
                        key={utx.id}
                        className="p-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] flex items-center justify-between gap-3"
                      >
                        <div className="text-xs">
                          <span className="font-mono font-bold text-[#172B25] dark:text-[#EDF6F0]">
                            {formatMinorUnits(utx.amount_minor_units, currency)}
                          </span>
                          <span className="mx-1.5 text-[#75847D]">·</span>
                          <span className="font-medium text-[#172B25] dark:text-[#EDF6F0]">
                            {utx.sender_name}
                          </span>
                          <span className="mx-1.5 text-[#75847D]">·</span>
                          <span className="font-mono text-[#75847D]">
                            {utx.transaction_id || 'CASH'} ({utx.transaction_time.slice(0, 5)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => assignTransactionToTrip(utx.id, selectedTrip.id)}
                          className="min-h-[36px] px-3 py-1 rounded-lg bg-[#16866A] text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Attach to Trip
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
