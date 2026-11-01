/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Check,
  Home,
  ListOrdered,
  MessageSquarePlus,
  Moon,
  Navigation,
  Route,
  Settings,
  Sun,
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
  const [tripModalMode, setTripModalMode] = useState<'START' | 'END' | null>(null);
  const [cashModalTripId, setCashModalTripId] = useState<string | null | undefined>(
    undefined
  );
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isSmsSimulatorOpen, setIsSmsSimulatorOpen] = useState(false);

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

  const navItems: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'trips', label: 'Trips', icon: Route },
    { id: 'transactions', label: 'Transactions', icon: ListOrdered },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7F5] dark:bg-[#101A17] text-[#172B25] dark:text-[#EDF6F0] pb-20 md:pb-12">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#192722]/95 backdrop-blur-md border-b border-[#E3EAE5] dark:border-[#253831]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-4 sm:px-6 h-16">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="text-lg font-bold tracking-tight text-[#123C35] dark:text-[#43C99A] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {settings.app_name}
          </button>

          {/* Zone 2: 5 clean single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#75847D] dark:text-[#94A8A0]">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    isActive
                      ? 'text-[#172B25] dark:text-[#EDF6F0] font-semibold border-[#16866A] dark:border-[#43C99A]'
                      : 'border-transparent hover:text-[#172B25] dark:hover:text-[#EDF6F0]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setTripModalMode(activeTrip ? 'END' : 'START')}
              className={`min-h-[40px] px-4 py-2 text-xs font-semibold rounded-xl transition-opacity hover:opacity-95 whitespace-nowrap shrink-0 ${
                activeTrip
                  ? 'bg-[#123C35] text-white dark:bg-[#43C99A] dark:text-[#101A17]'
                  : 'bg-[#16866A] text-white dark:bg-[#43C99A] dark:text-[#101A17]'
              }`}
            >
              {activeTrip ? 'End Active Trip' : 'Start Trip'}
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Utility Bar (Below Top Bar) */}
      <div className="bg-[#F5F7F5] dark:bg-[#101A17] border-b border-[#E3EAE5] dark:border-[#253831]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#75847D] dark:text-[#94A8A0]">
            <span>Ethiopian Driver Companion</span>
            <span aria-hidden="true">·</span>
            <span>Telebirr Sender 127 Offline Parser</span>
            {activeTrip && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[#16866A] dark:text-[#43C99A] flex items-center gap-1">
                  <Navigation className="w-3 h-3" />
                  Active: {activeTrip.start_location_name.replace(', Addis Ababa', '')}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSmsSimulatorOpen(true)}
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] font-semibold text-[#172B25] dark:text-[#EDF6F0] flex items-center gap-1.5 hover:border-[#16866A] transition-colors whitespace-nowrap shrink-0"
            >
              <MessageSquarePlus className="w-3.5 h-3.5 text-[#16866A] dark:text-[#43C99A]" />
              SMS 127 Testbench
            </button>

            <button
              type="button"
              onClick={() =>
                updateSettings({
                  theme: settings.theme === 'dark' ? 'light' : 'dark',
                })
              }
              className="min-h-[34px] px-3 py-1 rounded-lg bg-white dark:bg-[#192722] border border-[#E3EAE5] dark:border-[#253831] font-medium text-[#75847D] dark:text-[#94A8A0] hover:text-[#172B25] dark:hover:text-[#EDF6F0] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              aria-label="Toggle color theme"
            >
              {settings.theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#43C99A]" />
                  Light
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#123C35]" />
                  Dark
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Non-Intrusive Payment Notification & Active Trip Association Suggestion Banner (Section 6 & 8) */}
      {(latestAlert || pendingAssociationPrompt) && settings.notification_preview && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="rounded-2xl bg-[#123C35] text-white p-4 sm:p-5 border border-[#43C99A]/40 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-[#43C99A] font-semibold">
                <span>Payment received</span>
                {latestAlert && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">Time: {latestAlert.timeFormatted}</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xl font-bold font-mono tabular-nums text-white">
                  {pendingAssociationPrompt
                    ? formatMinorUnits(
                        pendingAssociationPrompt.amountMinorUnits,
                        settings.currency_display
                      )
                    : latestAlert?.amountFormatted}
                </span>
                <span className="text-sm text-[#DDF5E9]">
                  From:{' '}
                  <strong className="text-white">
                    {pendingAssociationPrompt?.senderName || latestAlert?.senderName}
                  </strong>
                </span>
              </div>

              {pendingAssociationPrompt && (
                <p className="text-xs text-[#DDF5E9]">
                  Suggested Association: Link this payment to your active trip from{' '}
                  <span className="font-semibold text-white">
                    {pendingAssociationPrompt.activeTripStartLocation}
                  </span>
                  ?
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {pendingAssociationPrompt ? (
                <>
                  <button
                    type="button"
                    onClick={() => confirmPendingTripAssociation(false)}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                  >
                    Keep Unassigned
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmPendingTripAssociation(true)}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#43C99A] text-[#101A17] text-xs font-bold flex items-center gap-1.5 hover:opacity-95 transition-opacity"
                  >
                    <Check className="w-4 h-4" />
                    Associate with Active Trip
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={dismissAlert}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'home' && (
          <HomeScreen
            onNavigate={setActiveTab}
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
          />
        )}
        {activeTab === 'reports' && <ReportsScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>

      {/* Mobile Bottom 5-Section Navigation Bar (Section 15) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#192722]/95 backdrop-blur-md border-t border-[#E3EAE5] dark:border-[#253831] grid grid-cols-5 items-center h-16">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
                isActive
                  ? 'text-[#16866A] dark:text-[#43C99A] font-bold'
                  : 'text-[#75847D] dark:text-[#94A8A0]'
              }`}
            >
              <IconComponent className="w-5 h-5" />
              <span className="text-[10px] tracking-tight mt-1 whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

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
    </div>
  );
}
