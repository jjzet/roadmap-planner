import { DEFAULT_STREAM_COLORS } from '../../lib/constants';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {DEFAULT_STREAM_COLORS.map((color) => (
        <button
          key={color}
          className="w-6 h-6 rounded border-2 cursor-pointer p-0"
          style={{
            backgroundColor: color,
            borderColor: value === color ? '#1a1a2e' : 'transparent',
          }}
          onClick={() => onChange(color)}
          title={color}
        />
      ))}
    </div>
  );
}
