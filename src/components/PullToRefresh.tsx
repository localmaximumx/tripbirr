import React, { useState, useRef, useEffect } from 'react';
import { ArrowDown, CheckCircle2, RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<any>;
  children: React.ReactNode;
  disabled?: boolean;
  pullText?: string;
  releaseText?: string;
  refreshingText?: string;
  completedText?: string;
}

const PULL_THRESHOLD = 60;
const MAX_PULL = 90;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  pullText = 'Pull down to sync',
  releaseText = 'Release to sync',
  refreshingText = 'Syncing data to cloud...',
  completedText = 'Synced successfully',
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollY <= 2) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    } else {
      startYRef.current = null;
      isPullingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || startYRef.current === null || disabled || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;

    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    if (deltaY > 0 && scrollY <= 2) {
      // Apply logarithmic dampening
      const distance = Math.min(MAX_PULL, deltaY * 0.45);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current || disabled) return;
    isPullingRef.current = false;
    startYRef.current = null;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(52); // Keep indicator visible during sync

      try {
        await onRefresh();
        setIsCompleted(true);
        setTimeout(() => {
          setIsCompleted(false);
          setIsRefreshing(false);
          setPullDistance(0);
        }, 700);
      } catch (_err) {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative flex-1 flex flex-col"
    >
      {/* Pull To Refresh Top Banner */}
      <div
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 8 ? 1 : 0,
        }}
        className="w-full overflow-hidden transition-[height,opacity] duration-200 ease-out flex items-center justify-center text-xs font-semibold"
      >
        <div className="flex items-center gap-2 py-2 px-4 rounded-full bg-white/90 dark:bg-[#131926]/95 border border-[#2CD48D]/40 text-[#0F172A] dark:text-white shadow-lg backdrop-blur-md">
          {isRefreshing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-[#2CD48D] animate-spin shrink-0" />
              <span className="text-[#2CD48D] font-bold text-[11px]">{refreshingText}</span>
            </>
          ) : isCompleted ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2CD48D] shrink-0" />
              <span className="text-[#2CD48D] font-bold text-[11px]">{completedText}</span>
            </>
          ) : (
            <>
              <ArrowDown
                style={{ transform: `rotate(${progress * 180}deg)` }}
                className="w-3.5 h-3.5 text-[#2CD48D] transition-transform duration-150 shrink-0"
              />
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                {pullDistance >= PULL_THRESHOLD ? releaseText : pullText}
              </span>
            </>
          )}
        </div>
      </div>

      {children}
    </div>
  );
};
