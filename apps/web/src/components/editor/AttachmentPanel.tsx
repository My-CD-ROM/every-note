import { useCallback, useEffect, useState } from 'react';
import { FileIcon, Image, Loader2, Trash2 } from 'lucide-react';
import { attachmentsApi } from '@/lib/api';
import type { AttachmentResponse } from '@/lib/api';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentPanelProps {
  noteId: string;
  onInsert: (markdown: string) => void;
}

export function AttachmentPanel({ noteId, onInsert }: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<AttachmentResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAttachments = useCallback(async () => {
    try {
      const data = await attachmentsApi.list(noteId);
      setAttachments(data);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleDelete = async (id: string) => {
    await attachmentsApi.delete(id);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleInsert = (att: AttachmentResponse) => {
    const isImage = att.mime_type.startsWith('image/');
    const md = isImage
      ? `![${att.original_filename}](${att.url})`
      : `[${att.original_filename}](${att.url})`;
    onInsert(md);
  };

  if (loading) return null;
  if (attachments.length === 0) return null;

  return (
    <div className="border-t px-4 py-2">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
        Attachments ({attachments.length})
      </div>
      <div className="space-y-1">
        {attachments.map((att) => {
          const isImage = att.mime_type.startsWith('image/');
          return (
            <div
              key={att.id}
              className="flex items-center gap-2 text-xs group rounded px-1 py-0.5 hover:bg-muted transition-colors"
            >
              {isImage ? (
                <Image className="h-3.5 w-3.5 text-primary shrink-0" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <button
                className="truncate text-left flex-1 hover:underline"
                onClick={() => handleInsert(att)}
                title="Click to insert at cursor"
              >
                {att.original_filename}
              </button>
              <span className="text-muted-foreground/50 shrink-0">{formatSize(att.size_bytes)}</span>
              <button
                onClick={() => handleDelete(att.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                title="Delete attachment"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
