// src/components/dashboard/AnimatedBackground.tsx
// Nền gradient + lưới mờ chuyển động rất nhẹ

import { useReducedMotion } from '../../hooks/useReducedMotion';

export function AnimatedBackground() {
  const reduced = useReducedMotion();

  return (
    <div className={`anim-bg ${reduced ? 'anim-bg--reduced' : ''}`} aria-hidden="true">
      {/* Orbs chuyển động */}
      <div className="anim-orb anim-orb--gold" />
      <div className="anim-orb anim-orb--teal" />
      <div className="anim-orb anim-orb--violet" />

      {/* Grid lines mờ */}
      <svg
        className="anim-grid"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id="bg-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(255,255,255,0.028)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg-grid)" />
      </svg>
    </div>
  );
}
