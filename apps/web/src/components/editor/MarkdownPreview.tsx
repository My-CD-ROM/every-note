import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNotesStore } from '@/stores/notes-store';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  onCheckboxToggle?: (newContent: string) => void;
}

function processWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]]+)\]\]/g, '[[$1]](__wikilink__$1)');
}

function toggleNthCheckbox(content: string, n: number): string {
  let count = 0;
  return content.replace(/- \[([ x])\]/g, (match, char) => {
    if (count++ === n) {
      return char === ' ' ? '- [x]' : '- [ ]';
    }
    return match;
  });
}

export function MarkdownPreview({ content, className, onCheckboxToggle }: MarkdownPreviewProps) {
  const { notes, setActiveNote } = useNotesStore();

  const processed = processWikiLinks(content);
  let checkboxCount = -1;

  return (
    <div className={`prose prose-slate dark:prose-invert max-w-none p-4 ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          input({ type, checked, ...props }) {
            if (type === 'checkbox') {
              checkboxCount++;
              const idx = checkboxCount;
              return (
                <input
                  type="checkbox"
                  checked={!!checked}
                  onChange={() => {
                    if (onCheckboxToggle) {
                      onCheckboxToggle(toggleNthCheckbox(content, idx));
                    }
                  }}
                  className="cursor-pointer mr-1 accent-primary"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
          a({ href, children, ...props }) {
            if (href?.startsWith('__wikilink__')) {
              const title = href.replace('__wikilink__', '');
              const target = notes.find(
                (n) => n.title.toLowerCase() === title.toLowerCase()
              );
              return (
                <a
                  {...props}
                  className="cursor-pointer text-primary hover:text-primary/80 no-underline hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    if (target) setActiveNote(target.id);
                  }}
                  title={target ? `Go to: ${target.title}` : `Not found: ${title}`}
                >
                  {children}
                </a>
              );
            }
            return <a href={href} {...props}>{children}</a>;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
