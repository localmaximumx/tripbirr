import React, { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import { TripStatus } from '../../database/schema';
import { CURRENT_DEMO_ISO_DATE } from '../../database/database';
import { calculateTripTotalMinorUnits } from '../../services/reports/reportService';
import { calculateDistanceMeters } from '../../services/location/locationService';
import { ThemeToggleButton } from '../../components/ThemeToggleButton';
import { getTranslation, Language } from '../../utils/i18n';

interface TripsScreenProps {
  onOpenTripDetail: (tripId: string) => void;
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
  onOpenTripDetail,
}) => {
  const { trips, transactions, settings } = useTripBirrStore();

  const isDark = settings.theme === 'dark';
  const currency = settings.currency_display;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TripStatus>('ALL');

  const visibleTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return trips.filter((t) => {
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

  const filterOptions: { id: 'ALL' | TripStatus; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: TripStatus.ACTIVE, label: 'Active' },
    { id: TripStatus.COMPLETED, label: 'Completed' },
    { id: TripStatus.CANCELLED, label: 'Cancelled' },
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
          {getTranslation('trips_title', (settings.language || 'en') as Language)}
        </h1>
        <ThemeToggleButton />
      </div>

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

      {/* Trip Cards List (Matches Page 2; clicking opens dedicated Trip Detail Section with Map at top & Transactions below) */}
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
          </div>
        ) : (
          visibleTrips.map((trip) => {
            const summary = calculateTripTotalMinorUnits(trip.id, transactions);
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
                onClick={() => onOpenTripDetail(trip.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onOpenTripDetail(trip.id);
                  }
                }}
                className={`rounded-[24px] p-5 transition-transform active:scale-[0.99] cursor-pointer ${
                  isActive
                    ? isDark
                      ? 'bg-[#141B2D] border-[1.5px] border-[#5CA4F8]/80'
                      : 'bg-white border-[1.5px] border-[#5CA4F8] shadow-sm'
                    : isDark
                    ? 'bg-[#141B2D] border border-white/5'
                    : 'bg-white border border-slate-200/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {isActive ? (
                    <span className="px-3 py-1 rounded-full bg-[#5CA4F8] text-[#09152B] text-xs font-extrabold tracking-wide">
                      ● Active
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

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[#8E9BAE]">
                    {durationDisplay} · {summary.paymentCount}{' '}
                    {summary.paymentCount === 1 ? 'payment' : 'payments'}
                    {distKm ? ` · ${distKm} km` : ''}
                  </span>

                  <div className="flex items-center gap-1.5">
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
                    <ChevronRight className="w-4 h-4 text-[#8E9BAE]" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
