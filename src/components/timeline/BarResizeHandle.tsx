import { useCallback, useRef } from 'react';

interface BarResizeHandleProps {
  side: 'left' | 'right';
  onResizeStart: () => void;
  onResize: (deltaX: number) => void;
  onResizeEnd: (finalDelta: number) => void;
}

export function BarResizeHandle({ side, onResizeStart, onResize, onResizeEnd }: BarResizeHandleProps) {
  const startX = useRef(0);
  const latestDelta = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      startX.current = e.clientX;
      latestDelta.current = 0;
      onResizeStart();

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX.current;
        latestDelta.current = delta;
        onResize(delta);
      };

      const handleMouseUp = () => {
        onResizeEnd(latestDelta.current);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [onResizeStart, onResize, onResizeEnd]
  );

  return (
    <div
      className={`absolute top-0 bottom-0 w-3 cursor-col-resize z-10 hover:bg-white/30 ${
        side === 'left' ? '-left-1' : '-right-1'
      }`}
      onMouseDown={handleMouseDown}
    />
  );
}
