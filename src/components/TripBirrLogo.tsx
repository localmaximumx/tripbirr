import React, { useId } from 'react';

interface TripBirrLogoProps {
  size?: number;
  className?: string;
  shape?: 'squircle' | 'circle' | 'rounded-square';
}

/**
 * Official TripBirr App Icon.
 * Features:
 * - Obsidian Navy squircle base (#0B0F1A / #141B2D)
 * - Brand Emerald green GPS location pin (#2CD48D / #10B981)
 * - Warm Cash Gold sun circle (#F5BA36 / #FBBF24) with bold 'B' emblem
 * - 4 Telebirr Sky Blue navigation waypoint trail dots (#5CA4F8)
 */
export const TripBirrLogo: React.FC<TripBirrLogoProps> = ({
  size = 36,
  className = '',
  shape = 'squircle',
}) => {
  const uid = useId().replace(/:/g, '');
  const rx = shape === 'circle' ? 256 : shape === 'rounded-square' ? 96 : 118;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="TripBirr App Icon"
    >
      <defs>
        {/* Background dark obsidian navy gradient */}
        <linearGradient
          id={`tbBg_${uid}`}
          x1="0"
          y1="0"
          x2="512"
          y2="512"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#141B2D" />
          <stop offset="60%" stopColor="#0B0F1A" />
          <stop offset="100%" stopColor="#060911" />
        </linearGradient>

        {/* Pin emerald gradient matching app interface */}
        <linearGradient
          id={`tbPin_${uid}`}
          x1="160"
          y1="80"
          x2="352"
          y2="380"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2CD48D" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>

        {/* Gold inner emblem matching app cash gold */}
        <linearGradient
          id={`tbGold_${uid}`}
          x1="200"
          y1="140"
          x2="312"
          y2="260"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#F5BA36" />
        </linearGradient>

        {/* Subtle drop glow for pin */}
        <filter id={`tbShadow_${uid}`} x="100" y="80" width="312" height="340" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#10B981" floodOpacity="0.32" />
        </filter>
      </defs>

      {/* Launcher Base Squircle */}
      <rect x="16" y="16" width="480" height="480" rx={rx} fill={`url(#tbBg_${uid})`} />
      <rect
        x="20"
        y="20"
        width="472"
        height="472"
        rx={Math.max(40, rx - 4)}
        stroke="#1E293B"
        strokeWidth="4"
      />

      {/* 4 Navigation Waypoint Trail Dots Under the Pin Tip in Telebirr Sky Blue */}
      <circle cx="170" cy="426" r="16" fill="#5CA4F8" />
      <circle cx="218" cy="410" r="16" fill="#5CA4F8" />
      <circle cx="294" cy="410" r="16" fill="#5CA4F8" />
      <circle cx="342" cy="426" r="16" fill="#5CA4F8" />

      {/* Green Location Pin */}
      <g filter={`url(#tbShadow_${uid})`}>
        <path
          d="M256 100 C188 100, 134 154, 134 222 C134 300, 256 414, 256 414 C256 414, 378 300, 378 222 C378 154, 324 100, 256 100 Z"
          fill={`url(#tbPin_${uid})`}
        />
      </g>

      {/* Golden Sun Circle inside Pin Head */}
      <circle cx="256" cy="216" r="62" fill={`url(#tbGold_${uid})`} />

      {/* Bold Black 'B' Character */}
      <text
        x="256"
        y="241"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, 'Plus Jakarta Sans', Inter, sans-serif"
        fontWeight="900"
        fontSize="76"
        fill="#052115"
      >
        B
      </text>
    </svg>
  );
};
