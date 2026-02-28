import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { graphApi } from '@/lib/api';
import { useNotesStore } from '@/stores/notes-store';
import { useUIStore } from '@/stores/ui-store';

const EDGE_STYLES: Record<string, { stroke: string; strokeDasharray?: string }> = {
  link: { stroke: '#0F766E' },
  tag: { stroke: '#f59e0b', strokeDasharray: '5 5' },
  folder: { stroke: '#64748b', strokeDasharray: '2 4' },
};

export function GraphView() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const setActiveNote = useNotesStore((s) => s.setActiveNote);
  const setView = useUIStore((s) => s.setView);
  const theme = useUIStore((s) => s.theme);
  const isDark = theme === 'dark';

  useEffect(() => {
    graphApi
      .get()
      .then((data) => {
        // Layout: simple grid
        const cols = Math.ceil(Math.sqrt(data.nodes.length));
        const gapX = 220;
        const gapY = 80;

        const flowNodes: Node[] = data.nodes.map((n, i) => ({
          id: n.id,
          position: { x: (i % cols) * gapX, y: Math.floor(i / cols) * gapY },
          data: { label: n.title || 'Untitled' },
          style: {
            background: isDark ? '#1E293B' : '#ffffff',
            color: isDark ? '#F1F5F9' : '#202124',
            border: `1px solid ${isDark ? '#334155' : '#DADCE0'}`,
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.1)',
          },
        }));

        const flowEdges: Edge[] = data.edges.map((e, i) => ({
          id: `e-${i}`,
          source: e.source,
          target: e.target,
          style: EDGE_STYLES[e.type] || EDGE_STYLES.link,
          animated: e.type === 'link',
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
      })
      .finally(() => setLoading(false));
  }, [isDark]); // eslint-disable-line react-hooks/exhaustive-deps

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setActiveNote(node.id);
      setView('all');
    },
    [setActiveNote, setView]
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading graph...
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        No notes to display. Create some notes first.
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        colorMode={isDark ? 'dark' : 'light'}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-4 rounded-md bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-sm border border-border">
        <div className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-primary" />
          Wiki-link
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-500" />
          Shared tag
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dotted border-slate-500" />
          Same folder
        </div>
      </div>
    </div>
  );
}
