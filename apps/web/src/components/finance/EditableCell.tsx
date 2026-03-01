import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface EditableCellProps {
  value: number;
  onSave: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

function formatNumber(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

export function EditableCell({ value, onSave, disabled, className }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    if (disabled) return;
    setText(value === 0 ? '' : String(value));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(text.replace(/\s/g, '').replace(',', '.'));
    const newValue = isNaN(parsed) ? 0 : parsed;
    if (newValue !== value) {
      onSave(newValue);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className={cn(
          'w-full h-full bg-transparent text-right text-sm px-2 py-1 outline-none border border-primary/30 rounded',
          className
        )}
      />
    );
  }

  return (
    <div
      onClick={startEdit}
      className={cn(
        'w-full h-full text-right text-sm px-2 py-1 tabular-nums',
        !disabled && 'cursor-pointer hover:bg-muted/50',
        disabled && 'text-muted-foreground',
        className
      )}
    >
      {formatNumber(value)}
    </div>
  );
}
