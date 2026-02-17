import { computeArrowPath } from '../../utils/arrowPath';

interface DependencyArrowProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color?: string;
}

export function DependencyArrow({ fromX, fromY, toX, toY, color = '#94A3B8' }: DependencyArrowProps) {
  const path = computeArrowPath(fromX, fromY, toX, toY);

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="none"
        markerEnd="url(#arrowhead)"
      />
    </g>
  );
}
