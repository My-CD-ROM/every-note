import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function EditableText({ value, onSave, className, placeholder }: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setText(value);
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
          if (e.key === 'Escape') { setText(value); setEditing(false); }
        }}
        className={cn(
          'bg-transparent text-sm px-1 py-0.5 outline-none border border-primary/30 rounded w-full',
          className
        )}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={cn(
        'text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 truncate',
        className
      )}
    >
      {value || <span className="text-muted-foreground">{placeholder || 'Click to edit'}</span>}
    </span>
  );
}
