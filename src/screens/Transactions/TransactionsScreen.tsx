import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Link2,
  MessageSquarePlus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { useTripBirrStore } from '../../store/useTripBirrStore';
import {
  PaymentMethod,
  TransactionRecord,
  TransactionStatus,
  TripStatus,
} from '../../database/schema';
import {
  isOutgoingTransaction,
  isPositiveIncomingTransaction,
  isReversalOrRefundTransaction,
} from '../../services/reports/reportService';
import { formatMinorUnits } from '../../utils/formatters';

type TxFilterTab =
  | 'ALL'
  | 'INCOMING'
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'OUTGOING'
  | 'REVERSALS'
  | 'SMS_AUDIT';

interface TransactionsScreenProps {
  onOpenSmsSimulator: () => void;
  onOpenCashModal: () => void;
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  onOpenSmsSimulator,
  onOpenCashModal,
}) => {
  const {
    transactions,
    trips,
    smsProcessingRecords,
    settings,
    assignTransactionToTrip,
    deleteTransactionRecord,
  } = useTripBirrStore();

  const currency = settings.currency_display;
  const [activeFilter, setActiveFilter] = useState<TxFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedTxId, setSelectedTxId] = useState<string>(
    transactions[0]?.id || ''
  );

  const filteredTransactions = transactions.filter((tx) => {
    if (activeFilter === 'INCOMING' && !isPositiveIncomingTransaction(tx)) {
      return false;
    }
    if (
      activeFilter === 'UNASSIGNED' &&
      (!isPositiveIncomingTransaction(tx) || tx.trip_id !== null)
    ) {
      return false;
    }
    if (
      activeFilter === 'ASSIGNED' &&
      (!isPositiveIncomingTransaction(tx) || tx.trip_id === null)
    ) {
      return false;
    }
    if (activeFilter === 'OUTGOING' && !isOutgoingTransaction(tx)) {
      return false;
    }
    if (activeFilter === 'REVERSALS' && !isReversalOrRefundTransaction(tx)) {
      return false;
    }

    if (dateFilter && tx.iso_date !== dateFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSender = (tx.sender_name || '').toLowerCase().includes(q);
      const matchTxId = (tx.transaction_id || '').toLowerCase().includes(q);
      const matchPhone = (tx.sender_phone || '').toLowerCase().includes(q);
      const matchAmt = (tx.amount_minor_units / 100).toFixed(2).includes(q);
      return matchSender || matchTxId || matchPhone || matchAmt;
    }

    return true;
  });

  const selectedTx: TransactionRecord | null =
    filteredTransactions.find((tx) => tx.id === selectedTxId) ||
    filteredTransactions[0] ||
    null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#172B25] dark:text-[#EDF6F0]">
            Transaction Ledger & SMS Audit
          </h1>
          <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
            Every Telebirr 127 notification and manual cash record stored in integer minor units
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenCashModal}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] text-xs font-semibold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-2 hover:border-[#16866A]"
          >
            <Banknote className="w-4 h-4 text-[#16866A] dark:text-[#43C99A]" />
            Record Cash
          </button>
          <button
            type="button"
            onClick={onOpenSmsSimulator}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#16866A] dark:bg-[#43C99A] text-white dark:text-[#101A17] text-xs font-bold flex items-center gap-2"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Test 127 SMS
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] rounded-xl">
          {(
            [
              { id: 'ALL', label: 'All' },
              { id: 'INCOMING', label: 'Incoming' },
              { id: 'UNASSIGNED', label: 'Unassigned' },
              { id: 'ASSIGNED', label: 'Assigned' },
              { id: 'OUTGOING', label: 'Outgoing' },
              { id: 'REVERSALS', label: 'Refunds & Reversals' },
              { id: 'SMS_AUDIT', label: `SMS Processing Log (${smsProcessingRecords.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeFilter === tab.id
                  ? 'bg-[#123C35] text-white dark:bg-[#43C99A] dark:text-[#101A17]'
                  : 'text-[#75847D] dark:text-[#94A8A0] hover:text-[#172B25] dark:hover:text-[#EDF6F0]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#75847D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sender, TX ID, amount..."
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] text-xs text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
            />
          </div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-10 px-3 rounded-xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] text-xs font-mono text-[#172B25] dark:text-[#EDF6F0]"
            aria-label="Filter by date"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="text-xs font-semibold text-[#16866A] dark:text-[#43C99A] underline px-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* SMS Audit Log View vs Financial Transactions View */}
      {activeFilter === 'SMS_AUDIT' ? (
        <div className="rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] overflow-hidden">
          <div className="p-5 border-b border-[#E3EAE5] dark:border-[#253831]">
            <h2 className="text-sm font-bold text-[#172B25] dark:text-[#EDF6F0]">
              SMS Processing & Classification Records (sms_processing_records table)
            </h2>
            <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
              Tracks processed fingerprints, ignored promotional broadcasts, and unknown formats
              flagged for review without storing raw personal SMS bodies.
            </p>
          </div>
          <div className="divide-y divide-[#E3EAE5] dark:divide-[#253831]">
            {smsProcessingRecords.map((rec) => (
              <div
                key={rec.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                    <span className="font-mono text-[#16866A] dark:text-[#43C99A]">
                      {rec.classification}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{rec.summary_note}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#75847D] dark:text-[#94A8A0] font-mono mt-1">
                    <span>Sender: {rec.sender_id}</span>
                    <span aria-hidden="true">·</span>
                    <span>Fingerprint: {rec.message_fingerprint}</span>
                  </div>
                  {rec.error_message && (
                    <p className="text-[#D9534F] mt-1">{rec.error_message}</p>
                  )}
                </div>
                <span className="font-mono font-semibold text-[#75847D] dark:text-[#94A8A0] shrink-0">
                  {rec.processing_status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Transaction List (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] divide-y divide-[#E3EAE5] dark:divide-[#253831]">
            {filteredTransactions.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                  No transactions match your current filter
                </p>
                <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-1">
                  Try clearing search terms or simulate an incoming Telebirr 127 SMS.
                </p>
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const isIncoming = isPositiveIncomingTransaction(tx);
                const isOutgoing = isOutgoingTransaction(tx);
                const isSelected = selectedTx?.id === tx.id;
                const trip = tx.trip_id
                  ? trips.find((t) => t.id === tx.trip_id)
                  : null;

                return (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setSelectedTxId(tx.id)}
                    className={`w-full text-left p-4 flex items-center justify-between gap-4 transition-colors ${
                      isSelected
                        ? 'bg-[#DDF5E9]/40 dark:bg-[#1D352D]/50'
                        : 'hover:bg-[#F5F7F5]/60 dark:hover:bg-[#101A17]/50'
                    }`}
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
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#172B25] dark:text-[#EDF6F0] truncate">
                            {tx.sender_name || 'Unknown'}
                          </p>
                          {tx.transaction_status !== TransactionStatus.VALID && (
                            <span className="text-xs font-mono font-semibold text-[#D9534F]">
                              · {tx.transaction_status}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5">
                          <span className="font-mono">
                            {tx.transaction_id || tx.payment_method}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {tx.transaction_date} {tx.transaction_time.slice(0, 5)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">
                            {trip
                              ? `${trip.start_location_name.replace(', Addis Ababa', '')} → ${(trip.end_location_name || 'Active').replace(', Addis Ababa', '')}`
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
                            ? 'text-[#75847D]'
                            : 'text-[#D9534F]'
                        }`}
                      >
                        {isIncoming ? '+' : '-'}
                        {formatMinorUnits(tx.amount_minor_units, currency)}
                      </p>
                      <p className="text-[11px] font-mono text-[#75847D] dark:text-[#94A8A0]">
                        {tx.amount_minor_units} cents
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Transaction Details Inspector (5 cols, Section 10) */}
          <div className="lg:col-span-5">
            {selectedTx ? (
              <div className="rounded-2xl bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] p-6 space-y-5">
                <div className="flex items-start justify-between pb-4 border-b border-[#E3EAE5] dark:border-[#253831]">
                  <div>
                    <p className="text-xs font-mono text-[#16866A] dark:text-[#43C99A]">
                      {selectedTx.transaction_type}
                    </p>
                    <h2 className="text-2xl font-bold font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0] mt-1">
                      {formatMinorUnits(selectedTx.amount_minor_units, currency)}
                    </h2>
                    <p className="text-xs text-[#75847D] dark:text-[#94A8A0] mt-0.5 font-mono">
                      Stored as {selectedTx.amount_minor_units} integer minor units
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteTransactionRecord(selectedTx.id)}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-[#E3EAE5] dark:border-[#253831] text-[#75847D] hover:text-[#D9534F] hover:border-[#D9534F]"
                    title="Delete transaction record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[#E3EAE5] dark:border-[#253831]">
                    <span className="text-[#75847D] dark:text-[#94A8A0]">Sender / Counterparty</span>
                    <span className="font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                      {selectedTx.sender_name || '—'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-[#E3EAE5] dark:border-[#253831]">
                    <span className="text-[#75847D] dark:text-[#94A8A0]">Sender Phone Number</span>
                    <span className="font-mono text-[#172B25] dark:text-[#EDF6F0]">
                      {selectedTx.sender_phone || 'Not provided'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-[#E3EAE5] dark:border-[#253831]">
                    <span className="text-[#75847D] dark:text-[#94A8A0]">Recipient</span>
                    <span className="font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                      {selectedTx.recipient_name || '—'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-[#E3EAE5] dark:border-[#253831]">
                    <span className="text-[#75847D] dark:text-[#94A8A0]">Transaction ID</span>
                    <span className="font-mono font-bold text-[#172B25] dark:text-[#EDF6F0]">
                      {selectedTx.transaction_id || 'Manual / No TX ID'}
                    </span>
                  </div>

                  {selectedTx.original_transaction_id && (
                    <div className="flex justify-between py-1.5 border-b border-[#E3EAE5] dark:border-[#253831]">
                      <span className="text-[#75847D] dark:text-[#94A8A0]">
                        Original Reversed TX ID
                      </span>
                      <span className="font-mono font-semibold text-[#E9A23B]">
                        {selectedTx.original_transaction_id}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-1.5 border-b border-[#E3EAE5] dark:border-[#253831]">
                    <span className="text-[#75847D] dark:text-[#94A8A0]">Date & Time</span>
                    <span className="font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0]">
                      {selectedTx.transaction_date} · {selectedTx.transaction_time}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-[#E3EAE5] dark:border-[#253831]">
                    <span className="text-[#75847D] dark:text-[#94A8A0]">E-Money Balance After</span>
                    <span className="font-mono tabular-nums text-[#172B25] dark:text-[#EDF6F0]">
                      {selectedTx.account_balance_minor_units !== null
                        ? formatMinorUnits(selectedTx.account_balance_minor_units, currency)
                        : '—'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-[#E3EAE5] dark:border-[#253831]">
                    <span className="text-[#75847D] dark:text-[#94A8A0]">SMS Sender / Method</span>
                    <span className="font-mono text-[#172B25] dark:text-[#EDF6F0]">
                      {selectedTx.payment_method === PaymentMethod.TELEBIRR
                        ? `Sender ID ${selectedTx.sms_sender} (Telebirr)`
                        : 'MANUAL_CASH'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1.5 border-b border-[#E3EAE5] dark:border-[#253831]">
                    <span className="text-[#75847D] dark:text-[#94A8A0]">Record Status</span>
                    <span className="font-mono font-semibold text-[#172B25] dark:text-[#EDF6F0]">
                      {selectedTx.transaction_status}
                    </span>
                  </div>
                </div>

                {/* Manual Trip Association Editor (Section 8 & 10) */}
                {isPositiveIncomingTransaction(selectedTx) && (
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-[#172B25] dark:text-[#EDF6F0] mb-2 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-[#16866A] dark:text-[#43C99A]" />
                      Associated Trip (Change or Remove Without Altering SMS Data)
                    </label>
                    <select
                      value={selectedTx.trip_id || ''}
                      onChange={(e) =>
                        assignTransactionToTrip(selectedTx.id, e.target.value || null)
                      }
                      className="w-full h-11 px-3 rounded-xl bg-[#F5F7F5] dark:bg-[#101A17] border border-[#E3EAE5] dark:border-[#253831] text-xs font-medium text-[#172B25] dark:text-[#EDF6F0] focus:outline-none focus:border-[#16866A]"
                    >
                      <option value="">Unassigned (No Trip Linked)</option>
                      {trips
                        .filter((t) => t.status !== TripStatus.CANCELLED)
                        .map((trip) => (
                          <option key={trip.id} value={trip.id}>
                            {trip.status === TripStatus.ACTIVE ? '[ACTIVE] ' : ''}
                            {trip.start_location_name.replace(', Addis Ababa', '')} →{' '}
                            {(trip.end_location_name || 'In Progress').replace(
                              ', Addis Ababa',
                              ''
                            )}{' '}
                            ({trip.start_time.slice(0, 10)})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <p className="text-[11px] text-[#75847D] dark:text-[#94A8A0] pt-2">
                  Note: {settings.app_name} records SMS notifications from sender 127 locally and does
                  not independently verify transactions against Telebirr&apos;s central ledger.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
