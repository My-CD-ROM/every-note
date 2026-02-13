import { ChevronDown, FileText, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { templates } from '@/lib/templates';

interface TemplatePickerProps {
  onSelect: (data: { title: string; content: string; note_type?: string }) => void;
}

export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="New from template">
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onSelect({ title: '', content: '' })}>
          <FileText className="mr-2 h-4 w-4" />
          Blank Note
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect({ title: '', content: '', note_type: 'checklist' })}>
          <ListChecks className="mr-2 h-4 w-4" />
          New Checklist
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {templates.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => onSelect({ title: t.title, content: t.content })}
          >
            <span className="mr-2">{t.icon}</span>
            {t.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
