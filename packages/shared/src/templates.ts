export interface NoteTemplate {
  id: string;
  name: string;
  icon: string;
  title: string;
  content: string;
}

export const templates: NoteTemplate[] = [
  {
    id: 'meeting',
    name: 'Meeting Notes',
    icon: '📋',
    title: 'Meeting Notes',
    content: `# Meeting Notes

## Date
${new Date().toLocaleDateString()}

## Attendees
-

## Agenda
1.

## Discussion


## Action Items
- [ ]
`,
  },
  {
    id: 'journal',
    name: 'Daily Journal',
    icon: '📝',
    title: 'Daily Journal',
    content: `# Daily Journal

## How am I feeling today?


## What am I grateful for?
1.
2.
3.

## What do I want to accomplish today?
- [ ]

## Reflections

`,
  },
  {
    id: 'todo',
    name: 'TODO List',
    icon: '✅',
    title: 'TODO List',
    content: `# TODO List

## High Priority
- [ ]

## Medium Priority
- [ ]

## Low Priority
- [ ]

## Done
- [x]
`,
  },
];
