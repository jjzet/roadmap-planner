interface Props {
  completed: number;
  total: number;
  size?: number;
}

export function ProgressRing({ completed, total, size = 20 }: Props) {
  if (total === 0) return null;

  const percentage = total > 0 ? completed / total : 0;
  const isComplete = completed === total;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - percentage * circumference;

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <svg
        width={size}
        height={size}
        className={`-rotate-90 transition-all duration-500 ${isComplete ? 'scale-110' : ''}`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`transition-all duration-500 ease-out ${
            isComplete
              ? 'text-emerald-500'
              : percentage >= 0.5
                ? 'text-cyan-600'
                : 'text-cyan-500'
          }`}
        />
        {/* Checkmark for 100% */}
        {isComplete && (
          <g className="animate-in fade-in zoom-in duration-300" transform={`rotate(90 ${size / 2} ${size / 2})`}>
            <path
              d={`M${size * 0.3} ${size * 0.5} L${size * 0.45} ${size * 0.65} L${size * 0.7} ${size * 0.35}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-500"
            />
          </g>
        )}
      </svg>
      <span className={`text-xs font-mono tabular-nums ${isComplete ? 'text-emerald-500 font-medium' : 'text-gray-400'}`}>
        {completed}/{total}
      </span>
    </div>
  );
}
