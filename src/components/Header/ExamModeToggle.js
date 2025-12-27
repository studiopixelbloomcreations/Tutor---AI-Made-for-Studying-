import React from 'react';
import LiquidGlass from 'liquid-glass-react';
import { liquidGlassConfig } from '../../theme/liquidGlassConfig.js';

export default function ExamModeToggle({ enabled, onChange }) {
  return (
    <LiquidGlass
      {...liquidGlassConfig}
      padding="0.6rem 0.85rem"
      cornerRadius={16}
      className={(enabled ? 'g9-glow-active' : '') + ' g9-glass-margin'}
      onClick={() => onChange(!enabled)}
    >
      <button
        type="button"
        role="switch"
        aria-checked={enabled ? 'true' : 'false'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer'
        }}
      >
        <span className="g9-fw-700">Exam Mode</span>
        <span
          style={{
            width: 42,
            height: 24,
            borderRadius: 999,
            background: enabled ? 'linear-gradient(135deg, #00c6ff, #0072ff)' : 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.25)',
            position: 'relative',
            transition: 'all 200ms ease'
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: enabled ? 22 : 3,
              width: 18,
              height: 18,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.92)',
              transition: 'all 200ms ease'
            }}
          />
        </span>
      </button>
    </LiquidGlass>
  );
}
