import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType, keymap } from '@codemirror/view';
import { useUIStore } from '@/stores/ui-store';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  onSelectionChange?: (coords: { top: number; left: number; bottom: number; right: number } | null) => void;
}

export interface MarkdownEditorHandle {
  focus: () => void;
  wrapSelection: (before: string, after: string) => void;
  insertAtCursor: (text: string) => void;
}

// --- Checkbox widget decoration ---

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly charPos: number) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('span');
    wrap.className = 'cm-checkbox-wrap';
    wrap.style.cssText = 'cursor:pointer; user-select:none;';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.style.cssText = 'cursor:pointer; vertical-align:middle; margin:0 4px 0 0; accent-color:#6366f1; width:14px; height:14px;';
    input.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const newChar = this.checked ? ' ' : 'x';
      view.dispatch({
        changes: { from: this.charPos, to: this.charPos + 1, insert: newChar },
      });
    });

    wrap.appendChild(input);
    return wrap;
  }

  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked && this.charPos === other.charPos;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function buildCheckboxDecos(view: EditorView): DecorationSet {
  const widgets: ReturnType<typeof Decoration.replace extends (...a: any[]) => infer R ? R extends { range: (...a: any[]) => infer RR } ? RR : never : never>[] = [];
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const match = line.text.match(/^(\s*-\s*)\[([ x])\]/);
    if (!match) continue;

    const checked = match[2] === 'x';
    const bracketStart = line.from + match[1].length;
    const bracketEnd = bracketStart + 3;
    const charPos = bracketStart + 1;

    (widgets as any[]).push(
      Decoration.replace({
        widget: new CheckboxWidget(checked, charPos),
      }).range(bracketStart, bracketEnd)
    );

    // Dim checked lines
    if (checked) {
      (widgets as any[]).push(
        Decoration.line({ class: 'cm-checked-line' }).range(line.from)
      );
    }
  }

  return Decoration.set(widgets as any, true);
}

const checkboxPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildCheckboxDecos(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildCheckboxDecos(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// --- Checklist auto-continuation ---

const checklistKeymap = keymap.of([
  {
    key: 'Enter',
    run(view) {
      const { from } = view.state.selection.main;
      const line = view.state.doc.lineAt(from);
      const match = line.text.match(/^(\s*-\s*)\[[ x]\]\s*(.*)/);
      if (!match) return false;

      // If current item text is empty, remove the prefix (exit checklist mode)
      if (!match[2].trim()) {
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: '' },
        });
        return true;
      }

      // Insert new unchecked item
      const newPrefix = match[1] + '[ ] ';
      view.dispatch({
        changes: { from, insert: '\n' + newPrefix },
        selection: { anchor: from + 1 + newPrefix.length },
      });
      return true;
    },
  },
]);

// --- Theme ---

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, monospace' },
  '.cm-content': { padding: '16px 0' },
  '.cm-line': { padding: '0 16px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-checked-line': { opacity: '0.45', textDecoration: 'line-through' },
  '.cm-checkbox-wrap': { display: 'inline' },
});

// --- Component ---

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, className, onSelectionChange }, ref) {
    const theme = useUIStore((s) => s.theme);
    const cmRef = useRef<ReactCodeMirrorRef>(null);

    const onSelChangeRef = useRef(onSelectionChange);
    onSelChangeRef.current = onSelectionChange;

    const selectionExtension = useMemo(() =>
      EditorView.updateListener.of((update) => {
        if (!update.selectionSet && !update.docChanged && !update.focusChanged) return;
        const { from, to } = update.view.state.selection.main;
        if (from !== to && update.view.hasFocus) {
          const start = update.view.coordsAtPos(from);
          const end = update.view.coordsAtPos(to);
          if (start && end) {
            onSelChangeRef.current?.({
              top: Math.min(start.top, end.top),
              left: Math.min(start.left, end.left),
              bottom: Math.max(start.bottom, end.bottom),
              right: Math.max(start.right, end.right),
            });
            return;
          }
        }
        onSelChangeRef.current?.(null);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

    useImperativeHandle(ref, () => ({
      focus() {
        cmRef.current?.view?.focus();
      },
      wrapSelection(before: string, after: string) {
        const view = cmRef.current?.view;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        const selected = view.state.sliceDoc(from, to);
        view.dispatch({
          changes: { from, to, insert: `${before}${selected}${after}` },
          selection: { anchor: from + before.length, head: to + before.length },
        });
        view.focus();
      },
      insertAtCursor(text: string) {
        const view = cmRef.current?.view;
        if (!view) return;
        const { from } = view.state.selection.main;
        view.dispatch({
          changes: { from, insert: text },
          selection: { anchor: from + text.length },
        });
        view.focus();
      },
    }));

    return (
      <CodeMirror
        ref={cmRef}
        value={value}
        onChange={onChange}
        theme={theme}
        extensions={[
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          EditorView.lineWrapping,
          editorTheme,
          checkboxPlugin,
          checklistKeymap,
          selectionExtension,
        ]}
        className={className}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
        }}
      />
    );
  }
);
