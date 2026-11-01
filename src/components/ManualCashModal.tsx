import React, { useState } from 'react';
import { Banknote, X } from 'lucide-react';
import { TripRecord, TripStatus } from '../database/schema';
import { parseAmountToMinorUnits } from '../services/sms/smsParser';
import { useTripBirrStore } from '../store/useTripBirrStore';

interface ManualCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  trips: TripRecord[];
  defaultTripId?: string | null;
  onSaveCash: (params: {
    amountMinorUnits: number;
    senderName?: string;
    description?: string;
    tripId: string | null;
  }) => void;
}

export const ManualCashModal: React.FC<ManualCashModalProps> = ({
  isOpen,
  onClose,
  trips,
  defaultTripId,
  onSaveCash,
}) => {
  const { settings } = useTripBirrStore();
  const isDark = settings.theme === 'dark';

  const activeTrip = trips.find((t) => t.status === TripStatus.ACTIVE);
  const [amountInput, setAmountInput] = useState('50.00');
  const [senderName] = useState('Cash Passenger');
  const [description, setDescription] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string>(
    defaultTripId !== undefined ? defaultTripId || '' : activeTrip?.id || ''
  );
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseAmountToMinorUnits(amountInput);
    if (!parsed || parsed.minor <= 0) {
      setError('Enter a valid positive amount in ETB (e.g., 30 or 50.00).');
      return;
    }
    onSaveCash({
      amountMinorUnits: parsed.minor,
      senderName: senderName.trim() || 'Cash Passenger',
      description: description.trim() || 'Manual cash fare entry',
      tripId: selectedTripId || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div
        className={`w-full max-w-[430px] rounded-t-3xl sm:rounded-3xl border p-6 shadow-2xl ${
          isDark
            ? 'bg-[#141B2D] border-white/10 text-white'
            : 'bg-white border-slate-200 text-[#0F172A]'
        }`}
      >
        <div
          className={`flex items-center justify-between pb-4 border-b ${
            isDark ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F5BA36]/15 text-[#F5BA36] flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold">
                Record Manual Cash Fare
              </h2>
              <p className="text-xs text-[#8E9BAE]">
                Tracked alongside Telebirr 127 SMS income
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#8E9BAE] hover:opacity-80 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1.5">
              Cash Amount (ETB)
            </label>
            <div className="flex gap-2 mb-2">
              {['20.00', '30.00', '50.00', '100.00'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmountInput(preset);
                    setError(null);
                  }}
                  className={`flex-1 h-9 rounded-xl text-xs font-mono font-bold border transition-colors cursor-pointer ${
                    amountInput === preset
                      ? 'bg-[#F5BA36] text-[#111827] border-[#F5BA36]'
                      : isDark
                      ? 'bg-[#0B0F1A] text-white border-white/10'
                      : 'bg-[#F7F9FC] text-[#0F172A] border-slate-200'
                  }`}
                >
                  ETB {preset.replace('.00', '')}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                setError(null);
              }}
              className={`w-full h-11 px-3.5 rounded-xl border font-mono text-sm focus:outline-none focus:border-[#2CD48D] ${
                isDark
                  ? 'bg-[#0B0F1A] border-white/10 text-white'
                  : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
              }`}
            />
            {error && <p className="text-xs text-[#F87171] mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">
              Associate With Trip
            </label>
            <select
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className={`w-full h-11 px-3 rounded-xl border text-xs focus:outline-none focus:border-[#2CD48D] ${
                isDark
                  ? 'bg-[#0B0F1A] border-white/10 text-white'
                  : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A]'
              }`}
            >
              <option value="">Unassigned (No Trip)</option>
              {trips
                .filter((t) => t.status === TripStatus.ACTIVE)
                .map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    [ACTIVE] {trip.start_location_name} → {trip.end_location_name || 'In Progress'}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1.5">
              Optional Note
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., 2 passengers cash payment"
              className={`w-full h-11 px-3.5 rounded-xl border text-sm focus:outline-none focus:border-[#2CD48D] ${
                isDark
                  ? 'bg-[#0B0F1A] border-white/10 text-white placeholder:text-[#8E9BAE]'
                  : 'bg-[#F7F9FC] border-slate-200 text-[#0F172A] placeholder:text-[#8E9BAE]'
              }`}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                isDark
                  ? 'border-white/10 text-[#8E9BAE] hover:text-white'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2CD48D] text-[#052115] text-xs font-extrabold hover:opacity-95 transition-opacity cursor-pointer"
            >
              Save Cash Fare
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
