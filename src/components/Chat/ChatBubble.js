import React, { useMemo } from 'react';
import LiquidGlass from 'liquid-glass-react';
import { liquidGlassConfig } from '../../theme/liquidGlassConfig.js';

export default function ChatBubble({ role, content }) {
  const isUser = role === 'user';
  const alignStyle = useMemo(() => {
    return {
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start'
    };
  }, [isUser]);

  return (
    <div style={alignStyle} className="g9-chat-bubble-enter">
      <LiquidGlass
        {...liquidGlassConfig}
        padding="1rem"
        cornerRadius={16}
        className="g9-glass-margin"
      >
        <div style={{ maxWidth: 720, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
          {content}
        </div>
      </LiquidGlass>
    </div>
  );
}
