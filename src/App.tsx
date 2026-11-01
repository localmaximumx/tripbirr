/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  Home,
  MessageSquarePlus,
  Moon,
  Play,
  Route,
  Sun,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useTripBirrStore } from './store/useTripBirrStore';
import { TripStatus } from './database/schema';
import { HomeScreen } from './screens/Home/HomeScreen';
import { TripsScreen } from './screens/Trips/TripsScreen';
import { TransactionsScreen } from './screens/Transactions/TransactionsScreen';
import { ReportsScreen } from './screens/Reports/ReportsScreen';
import { SettingsScreen } from './screens/Settings/SettingsScreen';
import { TripActionModal } from './components/TripActionModal';
import { ManualCashModal } from './components/ManualCashModal';
import { SmsSimulatorDrawer } from './components/SmsSimulatorDrawer';
import { DriverProfileModal } from './components/DriverProfileModal';
import { formatMinorUnits } from './utils/formatters';

type NavSection = 'home' | 'trips' | 'transactions' | 'reports' | 'settings';

export default function App() {
  const {
    trips,
    settings,
    latestAlert,
    pendingAssociationPrompt,
    startTrip,
    endTrip,
    addManualCashPayment,
    updateSettings,
    dismissAlert,
    confirmPendingTripAssociation,
  } = useTripBirrStore();

  const [activeTab, setActiveTab] = useState<NavSection>('home');
  const [txFilterHint, setTxFilterHint] = useState<string | null>(null);
  const [tripModalMode, setTripModalMode] = useState<'START' | 'END' | null>(null);
  const [cashModalTripId, setCashModalTripId] = useState<string | null | undefined>(
    undefined
  );
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isSmsSimulatorOpen, setIsSmsSimulatorOpen] = useState(false);
  const [isDriverProfileOpen, setIsDriverProfileOpen] = useState(false);

  const activeTrip = trips.find((t) => t.status === TripStatus.ACTIVE) || null;

  // Keep <html class="dark"> synchronized with settings.theme
  useEffect(() => {
    const rootEl = document.documentElement;
    if (settings.theme === 'dark') {
      rootEl.classList.add('dark');
    } else {
      rootEl.classList.remove('dark');
    }
  }, [settings.theme]);

  const handleOpenCashModal = (tripId?: string | null) => {
    setCashModalTripId(tripId);
    setIsCashModalOpen(true);
  };

  const handleNavigate = (tab: NavSection, filterHint?: string) => {
    setActiveTab(tab);
    setTxFilterHint(filterHint || null);
  };

  const navItems: {
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'trips', label: 'Trips', icon: Route },
    { id: 'transactions', label: 'Transactions', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#EEF2F7] dark:bg-[#060911] text-[#0F172A] dark:text-[#F8FAFC] flex justify-center">
      {/* Mobile App Frame Container */}
      <div className="w-full max-w-[430px] min-h-screen bg-[#F7F9FC] dark:bg-[#0B0F1A] relative flex flex-col shadow-2xl border-x border-[#E2E8F0]/70 dark:border-[#1E2638]/60">
        {/* Subtle Mobile Status / Quick Test Bar */}
        <div className="px-5 pt-3 pb-1 flex items-center justify-between text-[11px] font-semibold text-[#64748B] dark:text-[#8E9BAE]">
          <span className="font-mono tracking-tight">9:41 · Offline SQLite</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSmsSimulatorOpen(true)}
              className="px-2.5 py-1 rounded-full bg-white dark:bg-[#131926] border border-[#E2E8F0] dark:border-[#232D42] text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1 hover:border-[#2CD48D] transition-colors cursor-pointer"
              title="Simulate incoming Telebirr SMS from sender 127"
            >
              <MessageSquarePlus className="w-3 h-3 text-[#159960] dark:text-[#2CD48D]" />
              <span>SMS 127</span>
            </button>
            <button
              type="button"
              onClick={() =>
                updateSettings({
                  theme: settings.theme === 'dark' ? 'light' : 'dark',
                })
              }
              className="p-1.5 rounded-full bg-white dark:bg-[#131926] border border-[#E2E8F0] dark:border-[#232D42] text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#2CD48D] transition-colors cursor-pointer"
              aria-label="Toggle color theme"
            >
              {settings.theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-[#2CD48D]" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-[#0F172A]" />
              )}
            </button>
          </div>
        </div>

        {/* Non-Intrusive Payment Notification & Active Trip Association Suggestion Banner */}
        {(latestAlert || pendingAssociationPrompt) && settings.notification_preview && (
          <div className="px-4 pt-2">
            <div className="rounded-2xl bg-[#131926] text-white p-4 border border-[#2CD48D]/40 shadow-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#2CD48D] font-bold">
                  <span>Telebirr 127 received</span>
                  {latestAlert && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{latestAlert.timeFormatted}</span>
                    </>
                  )}
                </div>
                {!pendingAssociationPrompt && (
                  <button
                    type="button"
                    onClick={dismissAlert}
                    className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-lg font-extrabold font-mono tabular-nums text-white">
                  {pendingAssociationPrompt
                    ? formatMinorUnits(
                        pendingAssociationPrompt.amountMinorUnits,
                        settings.currency_display
                      )
                    : latestAlert?.amountFormatted}
                </span>
                <span className="text-xs text-[#94A3B8]">
                  From{' '}
                  <strong className="text-white">
                    {pendingAssociationPrompt?.senderName || latestAlert?.senderName}
                  </strong>
                </span>
              </div>

              {pendingAssociationPrompt && (
                <>
                  <p className="text-xs text-[#CBD5E1]">
                    Link this payment to active trip from{' '}
                    <span className="font-bold text-white">
                      {pendingAssociationPrompt.activeTripStartLocation}
                    </span>
                    ?
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => confirmPendingTripAssociation(false)}
                      className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                    >
                      Keep Unassigned
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmPendingTripAssociation(true)}
                      className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl bg-[#2CD48D] text-[#052115] text-xs font-extrabold flex items-center justify-center gap-1 hover:opacity-95 transition-opacity"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Link to Trip
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Main Mobile Scrollable Content */}
        <main className="flex-1 px-4 pt-3 pb-36">
          {activeTab === 'home' && (
            <HomeScreen
              onNavigate={handleNavigate}
              onOpenTripModal={(mode) => setTripModalMode(mode)}
              onOpenCashModal={handleOpenCashModal}
              onOpenSmsSimulator={() => setIsSmsSimulatorOpen(true)}
            />
          )}
          {activeTab === 'trips' && (
            <TripsScreen
              onOpenTripModal={(mode) => setTripModalMode(mode)}
              onOpenCashModal={handleOpenCashModal}
            />
          )}
          {activeTab === 'transactions' && (
            <TransactionsScreen
              onOpenSmsSimulator={() => setIsSmsSimulatorOpen(true)}
              onOpenCashModal={() => handleOpenCashModal(null)}
              initialFilterHint={txFilterHint}
            />
          )}
          {activeTab === 'reports' && <ReportsScreen />}
          {activeTab === 'settings' && (
            <SettingsScreen
              onOpenDriverProfile={() => setIsDriverProfileOpen(true)}
              onOpenSmsSimulator={() => setIsSmsSimulatorOpen(true)}
            />
          )}
        </main>

        {/* Floating "▶ Start trip" Button (Matches PDF Pages 1–6) */}
        <div className="fixed bottom-[82px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pointer-events-none z-30 flex justify-end">
          <button
            type="button"
            onClick={() => setTripModalMode('START')}
            className="pointer-events-auto min-h-[50px] px-6 py-3 rounded-full bg-[#2CD48D] hover:bg-[#25be7d] active:scale-[0.98] text-[#052115] font-extrabold text-[15px] shadow-[0_10px_28px_rgba(44,212,141,0.38)] flex items-center gap-2.5 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-[#052115] text-[#052115]" />
            <span>Start trip</span>
          </button>
        </div>

        {/* Fixed 5-Tab Bottom Navigation Bar (Matches PDF Pages 1–6) */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40 bg-white/95 dark:bg-[#0D121F]/95 backdrop-blur-md border-t border-[#E2E8F0] dark:border-[#1E2638] grid grid-cols-5 items-center h-[68px] px-1">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#159960] dark:text-[#2CD48D] font-bold'
                    : 'text-[#64748B] dark:text-[#8E9BAE] font-medium hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                }`}
              >
                <IconComponent className="w-5 h-5 stroke-[2.2]" />
                <span className="text-[11px] tracking-tight mt-1 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Modals & Drawers */}
      {tripModalMode && (
        <TripActionModal
          mode={tripModalMode}
          activeTrip={activeTrip}
          isOpen={Boolean(tripModalMode)}
          onClose={() => setTripModalMode(null)}
          onConfirmStart={(params) => startTrip(params)}
          onConfirmEnd={(tripId, params) => endTrip(tripId, params)}
        />
      )}

      <ManualCashModal
        isOpen={isCashModalOpen}
        onClose={() => setIsCashModalOpen(false)}
        trips={trips}
        defaultTripId={cashModalTripId}
        onSaveCash={(params) => addManualCashPayment(params)}
      />

      <SmsSimulatorDrawer
        isOpen={isSmsSimulatorOpen}
        onClose={() => setIsSmsSimulatorOpen(false)}
      />

      <DriverProfileModal
        isOpen={isDriverProfileOpen}
        onClose={() => setIsDriverProfileOpen(false)}
      />
    </div>
  );
}
