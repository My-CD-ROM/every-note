import { createPortal } from 'react-dom';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Strikethrough,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { MarkdownEditorHandle } from './MarkdownEditor';

interface FormatToolbarProps {
  editorRef: React.RefObject<MarkdownEditorHandle | null>;
  coords: { top: number; left: number; bottom: number; right: number };
}

export function FormatToolbar({ editorRef, coords }: FormatToolbarProps) {
  const wrap = (before: string, after: string) => {
    editorRef.current?.wrapSelection(before, after);
  };

  const insert = (text: string) => {
    editorRef.current?.insertAtCursor(text);
  };

  const btn = 'h-7 w-7 shrink-0';

  const top = coords.top - 44;
  const centerX = coords.left + (coords.right - coords.left) / 2;
  const finalTop = top < 8 ? coords.bottom + 8 : top;

  return createPortal(
    <div
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
      style={{
        top: finalTop,
        left: Math.max(220, Math.min(centerX, window.innerWidth - 220)),
        transform: 'translateX(-50%)',
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <Button variant="ghost" size="icon" className={btn} title="Bold (Ctrl+B)" onClick={() => wrap('**', '**')}>
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} title="Italic (Ctrl+I)" onClick={() => wrap('*', '*')}>
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} title="Strikethrough" onClick={() => wrap('~~', '~~')}>
        <Strikethrough className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} title="Inline code" onClick={() => wrap('`', '`')}>
        <Code className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      <Button variant="ghost" size="icon" className={btn} title="Heading 1" onClick={() => insert('\n# ')}>
        <Heading1 className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} title="Heading 2" onClick={() => insert('\n## ')}>
        <Heading2 className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} title="Heading 3" onClick={() => insert('\n### ')}>
        <Heading3 className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      <Button variant="ghost" size="icon" className={btn} title="Bullet list" onClick={() => insert('\n- ')}>
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} title="Numbered list" onClick={() => insert('\n1. ')}>
        <ListOrdered className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} title="Checklist" onClick={() => insert('\n- [ ] ')}>
        <ListChecks className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      <Button variant="ghost" size="icon" className={btn} title="Blockquote" onClick={() => insert('\n> ')}>
        <Quote className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} title="Horizontal rule" onClick={() => insert('\n---\n')}>
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className={btn} title="Link" onClick={() => wrap('[', '](url)')}>
        <Link className="h-3.5 w-3.5" />
      </Button>
    </div>,
    document.body
  );
}
