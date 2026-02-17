import { useState, useRef, type ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    timeoutRef.current = setTimeout(() => {
      setPos({ x: e.clientX, y: e.clientY - 10 });
      setVisible(true);
    }, 400);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {visible && (
        <div
          className="fixed z-50 px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg pointer-events-none"
          style={{
            left: pos.x,
            top: pos.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
