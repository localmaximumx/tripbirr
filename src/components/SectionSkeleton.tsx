import React from 'react';
import { useTripBirrStore } from '../store/useTripBirrStore';

interface SectionSkeletonProps {
  section: 'home' | 'trips' | 'transactions' | 'reports' | 'settings';
}

export const SectionSkeleton: React.FC<SectionSkeletonProps> = ({ section }) => {
  const { settings } = useTripBirrStore();
  const isDark = settings.theme === 'dark';

  const cardBg = isDark ? 'bg-[#141B2D]' : 'bg-white border border-slate-200/80';
  const blockBg = isDark ? 'bg-white/5' : 'bg-slate-200/70';
  const shimmerClass = 'animate-tb-shimmer';

  if (section === 'home') {
    return (
      <div className="space-y-4 pt-3 animate-page-enter">
        {/* Top Header Skeleton */}
        <div className="flex items-center justify-between pt-1">
          <div className="space-y-1.5">
            <div className={`h-3 w-28 rounded-md ${blockBg} ${shimmerClass}`} />
            <div className={`h-7 w-44 rounded-lg ${blockBg} ${shimmerClass}`} />
          </div>
          <div className={`w-9 h-9 rounded-full ${blockBg} ${shimmerClass}`} />
        </div>

        {/* Hero Card Skeleton */}
        <div className={`rounded-[28px] p-6 space-y-4 ${cardBg}`}>
          <div className="flex justify-between items-center">
            <div className={`h-3.5 w-24 rounded ${blockBg} ${shimmerClass}`} />
            <div className={`h-6 w-16 rounded-full ${blockBg} ${shimmerClass}`} />
          </div>
          <div className={`h-11 w-48 rounded-xl ${blockBg} ${shimmerClass}`} />
          <div className="pt-2 flex gap-3">
            <div className={`h-10 flex-1 rounded-xl ${blockBg} ${shimmerClass}`} />
            <div className={`h-10 flex-1 rounded-xl ${blockBg} ${shimmerClass}`} />
          </div>
        </div>

        {/* Active Trip Banner Skeleton */}
        <div className={`rounded-[24px] p-5 space-y-3 ${cardBg}`}>
          <div className="flex justify-between">
            <div className={`h-4 w-32 rounded ${blockBg} ${shimmerClass}`} />
            <div className={`h-4 w-12 rounded ${blockBg} ${shimmerClass}`} />
          </div>
          <div className={`h-5 w-60 rounded ${blockBg} ${shimmerClass}`} />
        </div>

        {/* Recent Transactions List Skeleton */}
        <div className="space-y-2.5 pt-2">
          <div className={`h-4 w-36 rounded ${blockBg} ${shimmerClass}`} />
          {[1, 2, 3].map((i) => (
            <div key={i} className={`rounded-[20px] p-4 flex items-center justify-between ${cardBg}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${blockBg} ${shimmerClass}`} />
                <div className="space-y-1.5">
                  <div className={`h-4 w-32 rounded ${blockBg} ${shimmerClass}`} />
                  <div className={`h-3 w-20 rounded ${blockBg} ${shimmerClass}`} />
                </div>
              </div>
              <div className={`h-5 w-16 rounded ${blockBg} ${shimmerClass}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'trips') {
    return (
      <div className="space-y-4 pt-3 animate-page-enter">
        <div className="flex items-center justify-between pt-1">
          <div className={`h-8 w-36 rounded-lg ${blockBg} ${shimmerClass}`} />
          <div className={`w-9 h-9 rounded-full ${blockBg} ${shimmerClass}`} />
        </div>

        {/* Start Trip CTA Skeleton */}
        <div className={`h-16 rounded-[22px] ${blockBg} ${shimmerClass}`} />

        {/* Trip Cards Skeleton */}
        <div className="space-y-3 pt-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`rounded-[24px] p-5 space-y-3 ${cardBg}`}>
              <div className="flex justify-between items-center">
                <div className={`h-4 w-28 rounded ${blockBg} ${shimmerClass}`} />
                <div className={`h-5 w-20 rounded-full ${blockBg} ${shimmerClass}`} />
              </div>
              <div className={`h-6 w-52 rounded-lg ${blockBg} ${shimmerClass}`} />
              <div className="flex justify-between items-center pt-2">
                <div className={`h-3.5 w-32 rounded ${blockBg} ${shimmerClass}`} />
                <div className={`h-6 w-24 rounded-lg ${blockBg} ${shimmerClass}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'transactions') {
    return (
      <div className="space-y-4 pt-3 animate-page-enter">
        <div className="flex items-center justify-between pt-1">
          <div className={`h-8 w-44 rounded-lg ${blockBg} ${shimmerClass}`} />
          <div className={`w-9 h-9 rounded-full ${blockBg} ${shimmerClass}`} />
        </div>

        {/* Filter Pills Skeleton */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-8 w-20 rounded-full ${blockBg} ${shimmerClass}`} />
          ))}
        </div>

        {/* Transaction Items Skeleton */}
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`rounded-[20px] p-4 flex items-center justify-between ${cardBg}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${blockBg} ${shimmerClass}`} />
                <div className="space-y-1.5">
                  <div className={`h-4 w-36 rounded ${blockBg} ${shimmerClass}`} />
                  <div className={`h-3 w-24 rounded ${blockBg} ${shimmerClass}`} />
                </div>
              </div>
              <div className={`h-5 w-20 rounded ${blockBg} ${shimmerClass}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section === 'reports') {
    return (
      <div className="space-y-4 pt-3 animate-page-enter">
        <div className="flex items-center justify-between pt-1">
          <div className={`h-8 w-40 rounded-lg ${blockBg} ${shimmerClass}`} />
          <div className={`w-9 h-9 rounded-full ${blockBg} ${shimmerClass}`} />
        </div>

        {/* Date Filter Pills */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-8 w-18 rounded-full ${blockBg} ${shimmerClass}`} />
          ))}
        </div>

        {/* Big Earnings Card Skeleton */}
        <div className={`rounded-[28px] p-6 space-y-3 ${cardBg}`}>
          <div className={`h-3 w-28 rounded ${blockBg} ${shimmerClass}`} />
          <div className={`h-11 w-52 rounded-xl ${blockBg} ${shimmerClass}`} />
          <div className={`h-4 w-36 rounded ${blockBg} ${shimmerClass}`} />
        </div>

        {/* 7-Day Chart Skeleton */}
        <div className={`rounded-[24px] p-5 space-y-4 ${cardBg}`}>
          <div className="flex justify-between items-center">
            <div className={`h-4 w-32 rounded ${blockBg} ${shimmerClass}`} />
            <div className={`h-4 w-20 rounded ${blockBg} ${shimmerClass}`} />
          </div>
          <div className="h-28 flex items-end justify-between gap-2 pt-4">
            {[40, 75, 30, 90, 60, 85, 50].map((h, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={`w-full rounded-t-lg ${blockBg} ${shimmerClass}`}
                  style={{ height: `${h}%` }}
                />
                <div className={`h-2.5 w-4 rounded ${blockBg} ${shimmerClass}`} />
              </div>
            ))}
          </div>
        </div>

        {/* 2-Column Summary Cards */}
        <div className="grid grid-cols-2 gap-3.5">
          <div className={`rounded-[24px] p-5 space-y-2 ${cardBg}`}>
            <div className={`h-3 w-24 rounded ${blockBg} ${shimmerClass}`} />
            <div className={`h-8 w-16 rounded-lg ${blockBg} ${shimmerClass}`} />
          </div>
          <div className={`rounded-[24px] p-5 space-y-2 ${cardBg}`}>
            <div className={`h-3 w-24 rounded ${blockBg} ${shimmerClass}`} />
            <div className={`h-8 w-24 rounded-lg ${blockBg} ${shimmerClass}`} />
          </div>
        </div>
      </div>
    );
  }

  // Settings skeleton
  return (
    <div className="space-y-4 pt-3 animate-page-enter">
      <div className="flex items-center justify-between pt-1">
        <div className={`h-8 w-32 rounded-lg ${blockBg} ${shimmerClass}`} />
        <div className={`w-9 h-9 rounded-full ${blockBg} ${shimmerClass}`} />
      </div>

      {/* Driver Card Skeleton */}
      <div className={`rounded-[24px] p-5 flex items-center gap-4 ${cardBg}`}>
        <div className={`w-14 h-14 rounded-full ${blockBg} ${shimmerClass}`} />
        <div className="space-y-2 flex-1">
          <div className={`h-5 w-36 rounded ${blockBg} ${shimmerClass}`} />
          <div className={`h-3.5 w-24 rounded ${blockBg} ${shimmerClass}`} />
        </div>
      </div>

      {/* Settings Rows Skeleton */}
      <div className={`rounded-[24px] p-5 space-y-4 ${cardBg}`}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between py-1">
            <div className="space-y-1">
              <div className={`h-4 w-32 rounded ${blockBg} ${shimmerClass}`} />
              <div className={`h-3 w-48 rounded ${blockBg} ${shimmerClass}`} />
            </div>
            <div className={`h-6 w-11 rounded-full ${blockBg} ${shimmerClass}`} />
          </div>
        ))}
      </div>
    </div>
  );
};
