import React, { useState } from 'react';
import { Banknote, X } from 'lucide-react';
import { TripRecord, TripStatus } from '../database/schema';
import { parseAmountToMinorUnits } from '../services/sms/smsParser';

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
  const activeTrip = trips.find((t) => t.status === TripStatus.ACTIVE);
  const [amountInput, setAmountInput] = useState('50.00');
  const [senderName, setSenderName] = useState('Cash Passenger');
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#E3EAE5] dark:border-[#253831]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#DDF5E9] dark:bg-[#1D352D] text-[#16866A] dark:text-[#43C99A] flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#172B25] dark:text-[#EDF6F0]">
                Record Manual Cash Fare
              </h2>
              <p className="text-xs text-[#75847D] dark:text-[#94A8A0]">
                Tracked separately from Telebirr 127 SMS income
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#75847D] hover:text-[#172B25] dark:hover:text-[#EDF6F0]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1.5">
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
                  className={`flex-1 h-9 rounded-lg text-xs font-mono font-semibold border transition-colors ${
                    amountInput === preset
                      ? 'bg-[#123C35] text-white border-[#123C35] dark:bg-[#43C99A] dark:text-[#101A17]'
                      : 'bg-[#F5F7F5] dark:bg-[#101A17] text-[#172B25] dark:text-[#EDF6F0] border-[#E3EAE5] dark:border-[#253831]'
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
              className="w-full h-11 px-3.5 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] font-mono text-sm text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
            />
            {error && <p className="text-xs text-[#D9534F] mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1.5">
              Associate With Trip
            </label>
            <select
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-xs text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
            >
              <option value="">Unassigned (No Trip)</option>
              {trips
                .filter((t) => t.status !== TripStatus.CANCELLED)
                .map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.status === TripStatus.ACTIVE ? '[ACTIVE] ' : ''}
                    {trip.start_location_name} → {trip.end_location_name || 'In Progress'}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] mb-1.5">
              Optional Note
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., 2 passengers cash payment"
              className="w-full h-11 px-3.5 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-sm text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E3EAE5] dark:border-[#253831] text-xs font-semibold text-[#75847D]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#16866A] dark:bg-[#43C99A] text-white dark:text-[#101A17] text-xs font-semibold hover:opacity-95 transition-opacity"
            >
              Save Cash Fare
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
