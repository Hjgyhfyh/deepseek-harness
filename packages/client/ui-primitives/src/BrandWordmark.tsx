// Mako Harness brand wordmark: shark-fin glyph + "mako" lettering +
// "harness" badge plate in one inline piece. Ink rides currentColor so the
// mark stays legible in both themes. Sized for the sidebar's 60px logo row
// (the New Session bar below is 38px tall): the wordmark renders ~26px tall
// so the lettering reads clearly next to it.

import type { IconProps } from './icons/props.ts'

/**
 * Render the full brand wordmark.
 * @param props.size - cap height in px (default 26); width follows naturally.
 * @param props.className - extra class for layout placement.
 * @returns the wordmark (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 26, className }: IconProps) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.32),
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M11.2 3.4c1.7 5.4 5.4 8.6 9.9 9.6-3.1 1.3-6.8 1.6-9.9.9L3.4 19.6c.9-6.4 3.1-11.8 7.8-16.2z"
          fill="currentColor"
        />
        <path
          d="M4 21.2c2.2-.9 4.4-.9 6.6 0s4.4.9 6.6 0"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span
        style={{
          fontWeight: 700,
          fontSize: Math.round(size * 0.82),
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}
      >
        mako
      </span>
      <span
        style={{
          fontSize: Math.round(size * 0.46),
          lineHeight: 1,
          letterSpacing: '0.08em',
          border: '1px solid currentColor',
          borderRadius: Math.max(3, size * 0.12),
          padding: `${Math.round(size * 0.11)}px ${Math.round(size * 0.2)}px ${Math.round(size * 0.13)}px`,
        }}
      >
        harness
      </span>
    </span>
  )
}
