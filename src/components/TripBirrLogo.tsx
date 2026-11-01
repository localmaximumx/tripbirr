import React, { useId } from 'react';

interface TripBirrLogoProps {
  size?: number;
  className?: string;
  shape?: 'squircle' | 'circle' | 'rounded-square';
}

/**
 * Official TripBirr App Icon (Vector Adaptive Icon).
 * Combines an Addis Ababa route ribbon, a luminous mint GPS endpoint pin,
 * a gold compass needle, and Telebirr 127 wireless payment waves.
 */
export const TripBirrLogo: React.FC<TripBirrLogoProps> = ({
  size = 36,
  className = '',
  shape = 'squircle',
}) => {
  const uid = useId().replace(/:/g, '');
  const rx = shape === 'circle' ? 256 : shape === 'rounded-square' ? 88 : 118;

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
        <linearGradient
          id={`tbBg_${uid}`}
          x1="0"
          y1="0"
          x2="512"
          y2="512"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#195247" />
          <stop offset="55%" stopColor="#123C35" />
          <stop offset="100%" stopColor="#09201B" />
        </linearGradient>
        <linearGradient
          id={`tbMint_${uid}`}
          x1="120"
          y1="96"
          x2="392"
          y2="416"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#72F5C7" />
          <stop offset="50%" stopColor="#43C99A" />
          <stop offset="100%" stopColor="#16866A" />
        </linearGradient>
        <linearGradient
          id={`tbGold_${uid}`}
          x1="180"
          y1="100"
          x2="360"
          y2="340"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFE58F" />
          <stop offset="100%" stopColor="#F4B740" />
        </linearGradient>
        <radialGradient
          id={`tbGlow_${uid}`}
          cx="256"
          cy="210"
          r="210"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#43C99A" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#43C99A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Adaptive Launcher Base */}
      <rect x="12" y="12" width="488" height="488" rx={rx} fill={`url(#tbBg_${uid})`} />
      <rect
        x="18"
        y="18"
        width="476"
        height="476"
        rx={Math.max(40, rx - 6)}
        stroke="#43C99A"
        strokeOpacity="0.32"
        strokeWidth="6"
      />

      {/* Ambient Mint Glow */}
      <circle cx="256" cy="210" r="210" fill={`url(#tbGlow_${uid})`} />

      {/* Subtle Addis Corridor Contours */}
      <path
        d="M56 360 C150 320, 360 400, 456 330"
        stroke="#43C99A"
        strokeOpacity="0.16"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="12 16"
      />

      {/* Wireless Telebirr 127 Payment Signal Arcs */}
      <path
        d="M336 122 A 76 76 0 0 1 394 180"
        stroke={`url(#tbGold_${uid})`}
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M352 90 A 114 114 0 0 1 426 164"
        stroke={`url(#tbGold_${uid})`}
        strokeOpacity="0.7"
        strokeWidth="12"
        strokeLinecap="round"
      />

      {/* Dynamic Highway Ribbon */}
      <path
        d="M116 404 C138 334, 198 316, 256 290 C314 264, 356 232, 356 184 C356 128.77, 311.23 84, 256 84 C200.77 84, 156 128.77, 156 184 C156 238, 206 276, 256 336 C284 370, 306 394, 392 404"
        stroke={`url(#tbMint_${uid})`}
        strokeWidth="38"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Center GPS Route Pin Shield */}
      <path
        d="M256 92 C205.2 92, 164 133.2, 164 184 C164 242.5, 256 332, 256 332 C256 332, 348 242.5, 348 184 C348 133.2, 306.8 92, 256 92 Z"
        fill={`url(#tbMint_${uid})`}
      />

      {/* Inner Deep Emerald Cutout */}
      <circle cx="256" cy="184" r="58" fill="#0D2C26" />
      <circle
        cx="256"
        cy="184"
        r="53"
        stroke={`url(#tbGold_${uid})`}
        strokeOpacity="0.45"
        strokeWidth="3"
      />

      {/* Gold Navigation Compass Arrow Inside Pin */}
      <path d="M232 208 L256 142 L280 208 L256 194 Z" fill={`url(#tbGold_${uid})`} />

      {/* Bottom Route Waypoint Dots */}
      <circle cx="156" cy="396" r="12" fill="#FFE58F" />
      <circle cx="256" cy="412" r="9" fill="#43C99A" />
      <circle cx="356" cy="396" r="12" fill="#43C99A" />
    </svg>
  );
};
