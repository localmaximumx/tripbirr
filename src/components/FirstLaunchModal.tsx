import React, { useState } from 'react';
import {
  Bell,
  Check,
  CheckSquare,
  FileText,
  MapPin,
  MessageSquare,
  Shield,
  Square,
  X,
} from 'lucide-react';
import { TripBirrLogo } from './TripBirrLogo';
import { useTripBirrStore } from '../store/useTripBirrStore';

interface FirstLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export const FirstLaunchModal: React.FC<FirstLaunchModalProps> = ({
  isOpen,
  onClose,
  onAccept,
}) => {
  const { settings, updateSettings } = useTripBirrStore();
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [activeLegalModal, setActiveLegalModal] = useState<'terms' | 'privacy' | null>(null);

  if (!isOpen) return null;

  const isAmharic = settings.language === 'am';

  const handleLanguageToggle = (lang: 'en' | 'am') => {
    updateSettings({ language: lang });
  };

  const handleAccept = () => {
    if (!acceptedTerms) return;
    updateSettings({
      sms_permission_status: 'GRANTED',
      location_permission_status: 'GRANTED',
      first_launch_completed: true,
    });
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full h-full sm:h-auto max-w-[430px] sm:rounded-3xl bg-[#090E17] text-white flex flex-col justify-between p-6 overflow-y-auto border border-[#1A2333] shadow-2xl relative">
        
        {/* Top Header: App Icon & Language Switcher */}
        <div>
          <div className="flex items-center justify-between pt-2">
            <div className="w-14 h-14 rounded-2xl bg-[#111827] border border-[#1E293B] flex items-center justify-center shadow-lg p-1.5">
              <TripBirrLogo size={42} shape="squircle" />
            </div>

            {/* Language Switcher Pill */}
            <div className="flex items-center bg-[#111827] border border-[#1E293B] rounded-full p-1 shadow-inner">
              <button
                type="button"
                onClick={() => handleLanguageToggle('en')}
                className={`px-3.5 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                  !isAmharic
                    ? 'bg-[#10B981] text-[#052115] shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => handleLanguageToggle('am')}
                className={`px-3 py-1 text-xs font-black rounded-full transition-all cursor-pointer ${
                  isAmharic
                    ? 'bg-[#10B981] text-[#052115] shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                አማ
              </button>
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="mt-7">
            <h1 className="text-[28px] font-black tracking-tight text-white leading-tight">
              {isAmharic ? 'እንኳን ወደ ትሪፕብር በደህና መጡ' : 'Welcome to TripBirr'}
            </h1>
            <p className="text-slate-300 text-[13.5px] mt-2.5 leading-relaxed font-normal">
              {isAmharic
                ? 'እያንዳንዱን ጉዞ እና እያንዳንዱን ብር ይከታተሉ። ከመጀመርዎ በፊት እባክዎ መተግበሪያው የሚፈልጋቸውን ፈቃዶች ይከልሱ።'
                : 'Track every trip and every birr. Before you start, please review what the app needs.'}
            </p>
          </div>

          {/* Three Transparency & Permission Cards */}
          <div className="space-y-3.5 mt-6">
            
            {/* Card 1: Read Telebirr SMS */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#131B2A] border border-[#1E293B]/80 hover:border-[#2CD48D]/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#1C273C] flex items-center justify-center shrink-0 border border-[#2A374F]">
                <MessageSquare className="w-6 h-6 text-[#60A5FA]" />
              </div>
              <div>
                <h3 className="text-white font-bold text-[15px] leading-tight">
                  {isAmharic ? 'የቴሌብር መልዕክቶችን ማንበብ' : 'Read Telebirr SMS'}
                </h3>
                <p className="text-slate-400 text-xs mt-1 leading-snug">
                  {isAmharic
                    ? 'ከአጭር ኮድ 127 የሚላኩ መልዕክቶች ብቻ። ሌሎች የግል መልዕክቶች በፍጹም አይነበቡም።'
                    : 'Only messages from sender 127. Other messages are never read.'}
                </p>
              </div>
            </div>

            {/* Card 2: Location at Trip Start & End */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#131B2A] border border-[#1E293B]/80 hover:border-[#2CD48D]/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#1C273C] flex items-center justify-center shrink-0 border border-[#2A374F]">
                <MapPin className="w-6 h-6 text-[#2CD48D]" />
              </div>
              <div>
                <h3 className="text-white font-bold text-[15px] leading-tight">
                  {isAmharic ? 'የጉዞ መጀመሪያ እና መጨረሻ አካባቢ' : 'Location at trip start and end'}
                </h3>
                <p className="text-slate-400 text-xs mt-1 leading-snug">
                  {isAmharic
                    ? 'የሚመዘገበው ጉዞ ሲጀምሩ ወይም ሲጨርሱ ብቻ ነው። የማያቋርጥ ክትትል የለም።'
                    : 'Saved only when you start or end a trip. No continuous tracking.'}
                </p>
              </div>
            </div>

            {/* Card 3: Notifications */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-[#131B2A] border border-[#1E293B]/80 hover:border-[#2CD48D]/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#1C273C] flex items-center justify-center shrink-0 border border-[#2A374F]">
                <Bell className="w-6 h-6 text-[#F5BA36]" />
              </div>
              <div>
                <h3 className="text-white font-bold text-[15px] leading-tight">
                  {isAmharic ? 'ማሳወቂያዎች' : 'Notifications'}
                </h3>
                <p className="text-slate-400 text-xs mt-1 leading-snug">
                  {isAmharic
                    ? 'ክፍያ ሲደርስ ወይም ጉዞ ማያያዝ ሲያስፈልግ ፈጣን ማሳወቂያ ያግኙ።'
                    : 'Get alerted when a payment arrives or needs a trip.'}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Acceptance Section */}
        <div className="mt-8 pt-4">
          
          {/* Checkbox */}
          <div
            onClick={() => setAcceptedTerms(!acceptedTerms)}
            className="flex items-start gap-3 cursor-pointer select-none group"
          >
            <div
              className={`w-5 h-5 rounded-md mt-0.5 flex items-center justify-center transition-all ${
                acceptedTerms
                  ? 'bg-[#10B981] text-[#052115]'
                  : 'border-2 border-slate-500 bg-transparent group-hover:border-slate-300'
              }`}
            >
              {acceptedTerms && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
            </div>

            <p className="text-slate-300 text-[13px] leading-snug">
              {isAmharic ? (
                <>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLegalModal('terms');
                    }}
                    className="text-[#38BDF8] hover:underline font-medium"
                  >
                    የአጠቃቀም ደንቦችን
                  </span>{' '}
                  እና{' '}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLegalModal('privacy');
                    }}
                    className="text-[#38BDF8] hover:underline font-medium"
                  >
                    የግላዊነት ፖሊሲውን
                  </span>{' '}
                  እስማማለሁ። መረጃዬ በስልኬ ላይ ብቻ ይቀመጣል።
                </>
              ) : (
                <>
                  I accept the{' '}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLegalModal('terms');
                    }}
                    className="text-[#38BDF8] hover:underline font-medium"
                  >
                    Terms of Use
                  </span>{' '}
                  and{' '}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLegalModal('privacy');
                    }}
                    className="text-[#38BDF8] hover:underline font-medium"
                  >
                    Privacy Policy
                  </span>
                  . My data stays on my phone.
                </>
              )}
            </p>
          </div>

          {/* Primary Button */}
          <button
            type="button"
            onClick={handleAccept}
            disabled={!acceptedTerms}
            className={`w-full mt-5 py-4 rounded-2xl font-black text-base flex items-center justify-center transition-all cursor-pointer ${
              acceptedTerms
                ? 'bg-[#10B981] hover:bg-[#0EA271] text-[#052115] shadow-[0_10px_28px_rgba(16,185,129,0.35)] active:scale-[0.99]'
                : 'bg-[#1A2535] text-slate-500 cursor-not-allowed'
            }`}
          >
            {isAmharic ? 'ተቀብለው ይቀጥሉ' : 'Accept & continue'}
          </button>

          {/* Secondary "Not now" Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-3 py-2 text-slate-400 hover:text-slate-200 text-sm font-semibold text-center transition-colors cursor-pointer"
          >
            {isAmharic ? 'አሁን አይደለም' : 'Not now'}
          </button>
        </div>

        {/* In-Modal Legal Sheet Dialog */}
        {activeLegalModal && (
          <div className="absolute inset-0 z-50 bg-[#0B101B] p-6 rounded-3xl flex flex-col justify-between animate-in fade-in duration-150">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#1E293B]">
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <Shield className="w-5 h-5 text-[#2CD48D]" />
                  <span>
                    {activeLegalModal === 'terms'
                      ? isAmharic ? 'የአጠቃቀም ደንቦች' : 'Terms of Use'
                      : isAmharic ? 'የግላዊነት ፖሊሲ' : 'Privacy Policy'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 text-slate-300 text-xs leading-relaxed space-y-3 overflow-y-auto max-h-[400px] pr-1">
                {activeLegalModal === 'terms' ? (
                  <>
                    <p>
                      <strong>1. Local Companion:</strong> TripBirr is an offline utility intended for drivers to parse official Telebirr payment notifications (Sender ID 127).
                    </p>
                    <p>
                      <strong>2. No Financial Custody:</strong> TripBirr does not initiate bank transfers, hold customer funds, or operate as a financial institution. All payments are executed within Telebirr by Ethio Telecom.
                    </p>
                    <p>
                      <strong>3. Driver Responsibility:</strong> Drivers remain solely responsible for verifying the authenticity of passengers and verifying physical trips.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <strong>1. 100% Offline Storage:</strong> All passenger trip logs, payment amounts, and transaction records remain strictly stored on your device's local database.
                    </p>
                    <p>
                      <strong>2. Zero Inbox Scanning:</strong> The app only listens to incoming broadcast notifications from Telebirr short-code 127. Your personal SMS inbox is never uploaded or read.
                    </p>
                    <p>
                      <strong>3. Location Privacy:</strong> GPS coordinates are captured only at the discrete moment a trip is started or ended. There is no background route tracing when idle.
                    </p>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveLegalModal(null)}
              className="w-full py-3 mt-4 rounded-xl bg-[#1C273C] hover:bg-[#25334E] text-white font-bold text-sm cursor-pointer"
            >
              {isAmharic ? 'ተመለስ' : 'Close'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
