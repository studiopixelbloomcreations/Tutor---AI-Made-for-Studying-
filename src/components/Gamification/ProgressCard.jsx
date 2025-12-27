import React from 'react';
import LiquidGlass from 'liquid-glass-react';
import { liquidGlassConfig } from '../../theme/liquidGlassConfig.js';

export default function ProgressCard({ title, value, progress }) {
  const pct = typeof progress === 'number' && Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : null;

  return (
    <LiquidGlass {...liquidGlassConfig} className="g9-glass-margin">
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div className="g9-fw-700">{title}</div>
          <div className="g9-fw-800">{value}</div>
        </div>

        {pct !== null ? (
          <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
            <div
              style={{
                width: Math.round(pct * 100) + '%',
                height: '100%',
                background: 'linear-gradient(90deg, #00c6ff, #0072ff)'
              }}
            />
          </div>
        ) : null}
      </div>
    </LiquidGlass>
  );
}
