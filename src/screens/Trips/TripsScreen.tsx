import React, { useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Edit3,
  Link2,
  MapPin,
  Plus,
  Search,
  StopCircle,
  Trash2,
  Unlink,
} from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import { TransactionStatus, TripRecord, TripStatus } from '../../database/schema';
import { CURRENT_DEMO_ISO_DATE } from '../../database/database';
import {
  calculateTripTotalMinorUnits,
  isPositiveIncomingTransaction,
} from '../../services/reports/reportService';
import { formatMinorUnits } from '../../utils/formatters';
import { LiveTripMap } from '../../components/LiveTripMap';
import { calculateDistanceMeters } from '../../services/location/locationService';

interface TripsScreenProps {
  onOpenTripModal: (mode: 'START' | 'END') => void;
  onOpenCashModal: (tripId?: string | null) => void;
}

function formatTripClockTime(iso: string): string {
  const timePart = iso.slice(11, 16);
  const parts = timePart.split(':');
  if (parts.length < 2) return timePart;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return timePart;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${suffix}`;
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

  const isDark = settings.theme === 'dark';
  const currency = settings.currency_display;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TripStatus>('ALL');
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [editStartName, setEditStartName] = useState('');
  const [editEndName, setEditEndName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Show today's trips first (matching Page 2), and allow searching across all trips
  const visibleTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return trips.filter((t) => {
      // Hide historical Oct test trips unless explicitly searched
      if (!q && t.start_time.slice(0, 10) !== CURRENT_DEMO_ISO_DATE) {
        return false;
      }
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        t.start_location_name.toLowerCase().includes(q) ||
        (t.end_location_name || '').toLowerCase().includes(q) ||
        t.start_time.toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      );
    });
  }, [trips, statusFilter, searchQuery]);

  const unassignedPayments = transactions.filter(
    (tx) =>
      tx.iso_date === CURRENT_DEMO_ISO_DATE &&
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

  const handleSaveEdit = (e: React.FormEvent, trip: TripRecord) => {
    e.preventDefault();
    updateTripDetails(trip.id, {
      start_location_name: editStartName.trim() || trip.start_location_name,
      end_location_name: editEndName.trim() || trip.end_location_name,
      notes: editNotes.trim() || null,
    });
    setIsEditingTrip(false);
  };

  const filterOptions: { id: 'ALL' | TripStatus; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: TripStatus.ACTIVE, label: 'Active' },
    { id: TripStatus.COMPLETED, label: 'Completed' },
    { id: TripStatus.CANCELLED, label: 'Cancelled' },
  ];

  return (
    <div className="space-y-4">
      {/* Page Title (Matches Page 2) */}
      <h1
        className={`text-[32px] font-extrabold tracking-tight pt-1 ${
          isDark ? 'text-white' : 'text-[#0F172A]'
        }`}
      >
        Trips
      </h1>

      {/* Search Bar (Matches Page 2: "Search places or dates") */}
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
          placeholder="Search places or dates"
          className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8E9BAE]"
        />
      </div>

      {/* Filter Pills Row (All, Active, Completed, Cancelled) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {filterOptions.map((opt) => {
          const isSelected = statusFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#2CD48D] text-[#052115]'
                  : isDark
                  ? 'bg-[#141B2D] text-white hover:bg-[#1C253D]'
                  : 'bg-white text-[#0F172A] border border-slate-200/80'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Trip Cards List (Matches Page 2 verbatim, with expandable map & payment details) */}
      <div className="space-y-3.5">
        {visibleTrips.length === 0 ? (
          <div
            className={`rounded-[24px] p-8 text-center ${
              isDark
                ? 'bg-[#141B2D] text-[#8E9BAE]'
                : 'bg-white border border-slate-200 text-slate-500'
            }`}
          >
            <p className="text-sm font-bold">No trips match this filter</p>
            <p className="text-xs mt-1">Tap Start trip below to begin a new trip.</p>
          </div>
        ) : (
          visibleTrips.map((trip) => {
            const summary = calculateTripTotalMinorUnits(trip.id, transactions);
            const isExpanded = expandedTripId === trip.id;
            const isActive = trip.status === TripStatus.ACTIVE;
            const isCancelled = trip.status === TripStatus.CANCELLED;

            const startShort = trip.start_location_name.replace(', Addis Ababa', '');
            const endShort = trip.end_location_name
              ? trip.end_location_name.replace(', Addis Ababa', '')
              : 'In progress';

            const durationMinutes = trip.duration
              ? Math.max(1, Math.round(trip.duration / 60))
              : 18;
            const durationDisplay = isActive
              ? `00:${String(durationMinutes).padStart(2, '0')}`
              : `${durationMinutes} min`;

            const amountMajorWhole = Math.round(
              summary.totalMinorUnits / 100
            ).toLocaleString('en-US');

            const hasBothCoords =
              typeof trip.start_latitude === 'number' &&
              typeof trip.start_longitude === 'number' &&
              typeof trip.end_latitude === 'number' &&
              typeof trip.end_longitude === 'number';

            const distKm = hasBothCoords
              ? (
                  calculateDistanceMeters(
                    trip.start_latitude!,
                    trip.start_longitude!,
                    trip.end_latitude!,
                    trip.end_longitude!
                  ) / 1000
                ).toFixed(2)
              : null;

            return (
              <div
                key={trip.id}
                className={`rounded-[24px] transition-all overflow-hidden ${
                  isActive
                    ? isDark
                      ? 'bg-[#141B2D] border-[1.5px] border-[#5CA4F8]/80'
                      : 'bg-white border-[1.5px] border-[#5CA4F8] shadow-sm'
                    : isDark
                    ? 'bg-[#141B2D] border border-white/5'
                    : 'bg-white border border-slate-200/80 shadow-xs'
                }`}
              >
                {/* Card Summary Area (Matches Page 2) */}
                <div
                  onClick={() => {
                    setExpandedTripId(isExpanded ? null : trip.id);
                    setIsEditingTrip(false);
                    setConfirmDeleteId(null);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setExpandedTripId(isExpanded ? null : trip.id);
                    }
                  }}
                  className="p-5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    {isActive ? (
                      <span className="px-3 py-1 rounded-full bg-[#5CA4F8] text-[#09152B] text-xs font-extrabold tracking-wide">
                        ● ACTIVE
                      </span>
                    ) : isCancelled ? (
                      <span className="px-3 py-1 rounded-full bg-[#3A1D28] text-[#F87171] text-xs font-bold">
                        Cancelled
                      </span>
                    ) : (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          isDark
                            ? 'bg-[#1B2D54] text-[#5CA4F8]'
                            : 'bg-[#E8F1FF] text-[#2563EB]'
                        }`}
                      >
                        Completed
                      </span>
                    )}

                    <span className="text-xs font-medium text-[#8E9BAE]">
                      {isActive
                        ? `Started ${formatTripClockTime(trip.start_time)}`
                        : `Today · ${formatTripClockTime(trip.start_time)}`}
                    </span>
                  </div>

                  <h3
                    className={`text-xl font-extrabold tracking-tight mt-3 ${
                      isCancelled
                        ? isDark
                          ? 'text-[#CBD5E1]'
                          : 'text-slate-600'
                        : isDark
                        ? 'text-white'
                        : 'text-[#0F172A]'
                    }`}
                  >
                    {startShort} → {endShort}
                  </h3>

                  <div className="mt-2.5 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-[#8E9BAE]">
                      {durationDisplay} · {summary.paymentCount}{' '}
                      {summary.paymentCount === 1 ? 'payment' : 'payments'}
                      {distKm ? ` · ${distKm} km` : ''}
                    </span>

                    <span
                      className={`text-xl font-extrabold tabular-nums ${
                        isActive
                          ? 'text-[#5CA4F8]'
                          : isDark
                          ? 'text-white'
                          : 'text-[#0F172A]'
                      }`}
                    >
                      {currency} {amountMajorWhole}
                    </span>
                  </div>
                </div>

                {/* Expanded Trip Map & Payment Details Inspector */}
                {isExpanded && (
                  <div
                    className={`px-5 pb-5 pt-3 border-t space-y-4 ${
                      isDark ? 'border-white/10' : 'border-slate-100'
                    }`}
                  >
                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <button
                            type="button"
                            onClick={() => onOpenTripModal('END')}
                            className="px-3.5 py-1.5 rounded-xl bg-[#2CD48D] text-[#052115] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                          >
                            <StopCircle className="w-3.5 h-3.5" />
                            Complete Trip
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenCashModal(trip.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#F5BA36]/15 text-[#F5BA36] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          +Cash Fare
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleBeginEdit(trip)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                            isDark
                              ? 'bg-white/5 text-white hover:bg-white/10'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        {isActive && (
                          <button
                            type="button"
                            onClick={() => cancelTrip(trip.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#F5BA36]/15 text-[#F5BA36] text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(trip.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-[#F87171]/15 text-[#F87171] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Delete Confirmation */}
                    {confirmDeleteId === trip.id && (
                      <div className="p-3.5 rounded-xl bg-[#F87171]/15 border border-[#F87171]/40 space-y-2">
                        <p className="text-xs text-white">
                          Delete this trip? Linked Telebirr payments will be preserved as Unassigned.
                        </p>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1 rounded-lg bg-white/10 text-xs font-semibold text-white"
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteTrip(trip.id);
                              setConfirmDeleteId(null);
                              setExpandedTripId(null);
                            }}
                            className="px-3 py-1 rounded-lg bg-[#F87171] text-xs font-bold text-[#09152B]"
                          >
                            Confirm Delete
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Edit Form */}
                    {isEditingTrip && (
                      <form
                        onSubmit={(e) => handleSaveEdit(e, trip)}
                        className={`p-3.5 rounded-xl space-y-2.5 ${
                          isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'
                        }`}
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-[#8E9BAE] mb-1">
                              Start Location
                            </label>
                            <input
                              type="text"
                              value={editStartName}
                              onChange={(e) => setEditStartName(e.target.value)}
                              className={`w-full h-9 px-2.5 rounded-lg text-xs border ${
                                isDark
                                  ? 'bg-[#141B2D] border-white/10 text-white'
                                  : 'bg-white border-slate-200 text-slate-900'
                              }`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#8E9BAE] mb-1">
                              Destination
                            </label>
                            <input
                              type="text"
                              value={editEndName}
                              onChange={(e) => setEditEndName(e.target.value)}
                              className={`w-full h-9 px-2.5 rounded-lg text-xs border ${
                                isDark
                                  ? 'bg-[#141B2D] border-white/10 text-white'
                                  : 'bg-white border-slate-200 text-slate-900'
                              }`}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingTrip(false)}
                            className="px-3 py-1 text-xs text-[#8E9BAE]"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1 rounded-lg bg-[#2CD48D] text-[#052115] text-xs font-bold"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    )}

                    {/* react-native-maps Start & End Coordinate Visualization */}
                    <LiveTripMap
                      trip={trip}
                      associatedTransactions={summary.transactions}
                      currency={currency}
                      compact
                    />

                    {/* Recorded GPS Endpoints */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div
                        className={`p-2.5 rounded-xl ${
                          isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'
                        }`}
                      >
                        <p className="text-[10px] font-bold text-[#2CD48D] flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          START ({trip.start_location_source})
                        </p>
                        <p
                          className={`font-semibold truncate mt-0.5 ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {trip.start_location_name}
                        </p>
                        <p className="font-mono text-[10px] text-[#8E9BAE] mt-0.5">
                          {trip.start_latitude && trip.start_longitude
                            ? `${trip.start_latitude.toFixed(4)}°N, ${trip.start_longitude.toFixed(4)}°E`
                            : 'Manual'}
                        </p>
                      </div>

                      <div
                        className={`p-2.5 rounded-xl ${
                          isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'
                        }`}
                      >
                        <p className="text-[10px] font-bold text-[#5CA4F8] flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          END ({trip.end_location_source || 'PENDING'})
                        </p>
                        <p
                          className={`font-semibold truncate mt-0.5 ${
                            isDark ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {trip.end_location_name || 'In progress'}
                        </p>
                        <p className="font-mono text-[10px] text-[#8E9BAE] mt-0.5">
                          {trip.end_latitude && trip.end_longitude
                            ? `${trip.end_latitude.toFixed(4)}°N, ${trip.end_longitude.toFixed(4)}°E`
                            : 'Awaiting arrival'}
                        </p>
                      </div>
                    </div>

                    {/* Linked Payments */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#8E9BAE]">
                        Linked Payments ({summary.transactions.length})
                      </p>
                      {summary.transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className={`p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs ${
                            isDark ? 'bg-[#0B0F1A]' : 'bg-slate-50'
                          }`}
                        >
                          <div>
                            <p
                              className={`font-bold flex items-center gap-1.5 ${
                                isDark ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#2CD48D]" />
                              {tx.sender_name} ·{' '}
                              <span className="text-[#2CD48D] font-mono">
                                {formatMinorUnits(tx.amount_minor_units, currency)}
                              </span>
                            </p>
                            <p className="text-[10px] text-[#8E9BAE] font-mono mt-0.5">
                              {tx.transaction_id || 'CASH'} · {tx.transaction_time.slice(0, 5)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => assignTransactionToTrip(tx.id, null)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#F87171]/20 text-[#8E9BAE] hover:text-[#F87171] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Unlink className="w-3 h-3" />
                            Detach
                          </button>
                        </div>
                      ))}

                      {unassignedPayments.length > 0 && (
                        <div className="pt-1 space-y-1.5">
                          <p className="text-[11px] font-bold text-[#F5BA36] flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            Attach Unassigned Payment ({unassignedPayments.length})
                          </p>
                          {unassignedPayments.map((utx) => (
                            <div
                              key={utx.id}
                              className={`p-2 rounded-xl flex items-center justify-between text-xs ${
                                isDark ? 'bg-[#272118]' : 'bg-[#FEF7E6]'
                              }`}
                            >
                              <span
                                className={`font-semibold ${
                                  isDark ? 'text-white' : 'text-slate-900'
                                }`}
                              >
                                {utx.sender_name} ·{' '}
                                {formatMinorUnits(utx.amount_minor_units, currency)}
                              </span>
                              <button
                                type="button"
                                onClick={() => assignTransactionToTrip(utx.id, trip.id)}
                                className="px-2.5 py-1 rounded-lg bg-[#2CD48D] text-[#052115] text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                Attach
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
