import React, { useRef, useState, useEffect } from 'react';

interface SwipeableNotificationCardProps {
  children: React.ReactNode;
  onDismiss: () => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * SwipeableNotificationCard
 * Provides smooth horizontal wipe-to-dismiss (swipe left or right)
 * with proportional opacity fade, tilt, and spring/snap-back animation.
 * Ample padding, top margin, and non-interfering button click support.
 */
export const SwipeableNotificationCard: React.FC<SwipeableNotificationCardProps> = ({
  children,
  onDismiss,
  className = '',
  ariaLabel,
}) => {
  const [dragX, setDragX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const currentXRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const startTimeRef = useRef<number>(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDismissing || e.touches.length !== 1) return;
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    currentXRef.current = touch.clientX;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || startXRef.current === null || startYRef.current === null || isDismissing) {
      return;
    }
    const touch = e.touches[0];
    currentXRef.current = touch.clientX;
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    // Determine gesture direction on first noticeable movement
    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (isHorizontalSwipeRef.current) {
      setDragX(deltaX);
    }
  };

  const finishGesture = () => {
    if (!isDragging || startXRef.current === null || isDismissing) {
      setIsDragging(false);
      return;
    }

    const deltaX = currentXRef.current - startXRef.current;
    const duration = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = Math.abs(deltaX) / duration;

    // Dismiss if swiped left or right past 55px or fast flick (> 0.35 px/ms)
    const isSwipeDismiss =
      isHorizontalSwipeRef.current &&
      (Math.abs(deltaX) > 55 || (Math.abs(deltaX) > 25 && velocity > 0.35));

    if (isSwipeDismiss) {
      setIsDismissing(true);
      const targetX = deltaX > 0 ? 400 : -400;
      setDragX(targetX);
      dismissTimerRef.current = setTimeout(() => {
        onDismiss();
      }, 190);
    } else {
      setDragX(0);
    }

    startXRef.current = null;
    startYRef.current = null;
    isHorizontalSwipeRef.current = null;
    setIsDragging(false);
  };

  // Support mouse drag on desktop preview as well
  const handlePointerDown = (e: React.PointerEvent) => {
    if (isDismissing || e.button !== 0) return;
    // Don't drag if initiating on interactive elements
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentXRef.current = e.clientX;
    startTimeRef.current = Date.now();
    isHorizontalSwipeRef.current = null;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || startXRef.current === null || startYRef.current === null || isDismissing) {
      return;
    }
    currentXRef.current = e.clientX;
    const deltaX = e.clientX - startXRef.current;
    const deltaY = e.clientY - startYRef.current;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (isHorizontalSwipeRef.current) {
      setDragX(deltaX);
    }
  };

  const opacity = isDismissing ? 0 : Math.max(0.12, 1 - Math.abs(dragX) / 220);
  const rotation = dragX * 0.035;

  return (
    <div
      role="alert"
      aria-label={ariaLabel || 'Notification banner'}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishGesture}
      onTouchCancel={finishGesture}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
      style={{
        transform: `translate3d(${dragX}px, 0, 0) rotate(${rotation}deg)`,
        opacity,
        transition: isDragging
          ? 'none'
          : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease',
        touchAction: 'pan-y',
        willChange: 'transform, opacity',
      }}
      className={`pointer-events-auto select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${className}`}
    >
      {/* Subtle swipe affordance handle */}
      <div className="w-8 h-1 rounded-full bg-white/20 mx-auto -mt-0.5 mb-2.5 shrink-0 pointer-events-none" />
      {children}
    </div>
  );
};
