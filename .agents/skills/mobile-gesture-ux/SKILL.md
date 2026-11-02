---
name: mobile-gesture-ux
description: >-
  Build mobile-optimized gesture interfaces, swipe-to-dismiss notifications, safe-area adaptation,
  non-intrusive overlays, and bilingual typography for high-stress, mobile, or driver-centric environments.
  Use when designing mobile-first UI components, adding touch/wipe gestures, styling floating notifications,
  or implementing multi-language (English/Amharic) layouts.
---

# Mobile-First Gesture UX & Notification Engineering

This skill provides patterns for building responsive, gesture-driven mobile web interfaces that feel like 60fps native apps. It focuses on touch interactions, swipe-to-dismiss cards, safe-area viewport adaptation, and bilingual layouts.

---

## 1. Unified Touch & Pointer Swipe-to-Dismiss Engine

To enable wiping left or right to dismiss cards without breaking standard button taps inside the card:

```typescript
// src/components/SwipeableNotificationCard.tsx
import React, { useRef, useState, useEffect } from 'react';

interface SwipeableNotificationProps {
  children: React.ReactNode;
  onDismiss: () => void;
  className?: string;
}

export const SwipeableNotificationCard: React.FC<SwipeableNotificationProps> = ({
  children,
  onDismiss,
  className = '',
}) => {
  const [dragX, setDragX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const currentXRef = useRef<number>(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const startTimeRef = useRef<number>(0);

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
    if (!isDragging || startXRef.current === null || startYRef.current === null || isDismissing) return;
    const touch = e.touches[0];
    currentXRef.current = touch.clientX;
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    // Detect gesture axis: only lock horizontal if horizontal delta exceeds vertical delta
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
    const velocity = Math.abs(deltaX) / duration; // px per ms

    // Threshold: swipe > 55px or fast flick > 0.35 px/ms
    const isSwipeDismiss =
      isHorizontalSwipeRef.current &&
      (Math.abs(deltaX) > 55 || (Math.abs(deltaX) > 25 && velocity > 0.35));

    if (isSwipeDismiss) {
      setIsDismissing(true);
      const targetX = deltaX > 0 ? 400 : -400; // Slide off in swipe direction
      setDragX(targetX);
      setTimeout(onDismiss, 190);
    } else {
      setDragX(0); // Snap back to center
    }

    startXRef.current = null;
    startYRef.current = null;
    isHorizontalSwipeRef.current = null;
    setIsDragging(false);
  };

  const opacity = isDismissing ? 0 : Math.max(0.12, 1 - Math.abs(dragX) / 220);
  const rotation = dragX * 0.035;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishGesture}
      onTouchCancel={finishGesture}
      style={{
        transform: `translate3d(${dragX}px, 0, 0) rotate(${rotation}deg)`,
        opacity,
        transition: isDragging
          ? 'none'
          : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease',
        touchAction: 'pan-y', // CRITICAL: Allows vertical scroll while capturing horizontal swipe
        willChange: 'transform, opacity',
      }}
      className={`pointer-events-auto select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${className}`}
    >
      {/* Visual drag handle pill affordance */}
      <div className="w-8 h-1 rounded-full bg-white/20 mx-auto -mt-0.5 mb-2.5 shrink-0 pointer-events-none" />
      {children}
    </div>
  );
};
```

---

## 2. Notch & Safe-Area Adaptation for Mobile Overlays

Never hardcode notification banners with `top: 0` or small static margins like `top: 1rem` (`top-4`). Mobile hardware notches, camera punch-holes, and system status bars will overlap the banner.

### Standard Safe Container Pattern

```tsx
<div
  style={{ top: 'max(1.75rem, env(safe-area-inset-top, 1.75rem))' }}
  className="fixed left-1/2 -translate-x-1/2 w-full max-w-[416px] px-4 z-[70] pointer-events-none space-y-3"
>
  {/* Notification cards rendered with pointer-events-auto */}
</div>
```

**Why this works**:
1. `max(1.75rem, ...)` guarantees at least 28px top clearance in desktop preview or standard displays.
2. `env(safe-area-inset-top, 1.75rem)` expands dynamically on phones with notches or camera islands.
3. `pointer-events-none` on the container ensures taps on empty space pass through to the screen beneath.
4. `px-4` ensures cards never touch the left/right screen bevels.

---

## 3. High-Contrast Driver Dark Mode & Typography

In high-glare environments (e.g. driving during midday sun or dark nighttime rides):
- **Contrast**: Use deep midnight blue/blacks (`#0B0F1A`, `#131926`) rather than pure gray.
- **Accents**: High-visibility emerald green (`#2CD48D`) for incoming funds and amber/gold (`#F5BA36`) for unassigned or pending states.
- **Touch Targets**: Minimum 44px × 44px for primary actionable elements.
- **Bilingual Localization**: Always support simultaneous English and Amharic with legible font weights and tabular numbers:
  ```tsx
  <span className="font-mono tabular-nums text-lg font-extrabold">
    {formatMinorUnits(tx.amount_minor_units, currency)}
  </span>
  ```
