import React from 'react';
import LiquidGlass from 'liquid-glass-react';
import { liquidGlassConfig } from '../../theme/liquidGlassConfig.js';

export default function SidebarPanel({ children, activeTab, onTabChange }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'chats', label: 'Chats' },
          { key: 'gamification', label: 'Gamification' },
          { key: 'settings', label: 'Settings' }
        ].map((t) => (
          <LiquidGlass
            key={t.key}
            {...liquidGlassConfig}
            padding="0.5rem 0.75rem"
            cornerRadius={14}
            className={(activeTab === t.key ? 'g9-glow-active' : '') + ' g9-glass-margin'}
            onClick={() => onTabChange(t.key)}
          >
            <button
              type="button"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontWeight: 'inherit'
              }}
              className="g9-fw-700"
            >
              {t.label}
            </button>
          </LiquidGlass>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
    </div>
  );
}
