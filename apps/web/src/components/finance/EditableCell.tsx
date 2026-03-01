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

  const evaluate = (input: string): number => {
    const cleaned = input.replace(/\s/g, '').replace(',', '.');
    // Support math expressions: only allow digits, dots, and math operators
    if (/[+\-*/]/.test(cleaned) && /\d/.test(cleaned)) {
      if (!/^[\d.+\-*/()]+$/.test(cleaned)) return parseFloat(cleaned) || 0;
      try {
        // Safe: input is validated to only contain [0-9.+\-*/()]
        const result = new Function(`return (${cleaned})`)() as number; // eslint-disable-line no-new-func
        return isFinite(result) ? result : 0;
      } catch {
        return parseFloat(cleaned) || 0;
      }
    }
    return parseFloat(cleaned) || 0;
  };

  const commit = () => {
    setEditing(false);
    const newValue = evaluate(text);
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
