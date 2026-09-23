import { useMemo } from 'react';
import { Group, Text, Paper, Loader, ThemeIcon } from '@mantine/core';
import { IconCheck, IconX, IconCircle } from '@tabler/icons-react';
import type { Workflow, WorkflowNode, WorkflowEdge } from '../../api/types';

interface NodeStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  output?: unknown;
  error?: string;
}

interface ExecutionGraphProps {
  workflow: Workflow;
  nodeStatuses: Record<string, NodeStatus>;
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
}

interface LayoutNode {
  node: WorkflowNode;
  x: number;
  y: number;
  layer: number;
  index: number;
}

// 自动布局：按拓扑排序分层
function computeLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): { layoutNodes: LayoutNode[]; svgWidth: number; svgHeight: number } {
  // 计算入度
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  nodes.forEach((n) => {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  });

  edges.forEach((e) => {
    if (inDegree[e.target_node] !== undefined) {
      inDegree[e.target_node]++;
    }
    if (adj[e.source_node]) {
      adj[e.source_node].push(e.target_node);
    }
  });

  // 拓扑排序分层
  const layers: string[][] = [];
  const visited = new Set<string>();
  let currentLayer = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);

  while (currentLayer.length > 0) {
    layers.push(currentLayer);
    currentLayer.forEach((id) => visited.add(id));

    const nextLayer: string[] = [];
    currentLayer.forEach((id) => {
      adj[id]?.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          inDegree[neighbor]--;
          if (inDegree[neighbor] === 0) {
            nextLayer.push(neighbor);
          }
        }
      });
    });
    currentLayer = nextLayer;
  }

  // 计算位置
  const nodeWidth = 140;
  const nodeHeight = 60;
  const hGap = 40;
  const vGap = 80;

  const maxLayerSize = Math.max(...layers.map((l) => l.length));
  const svgWidth = maxLayerSize * (nodeWidth + hGap) + hGap;
  const svgHeight = layers.length * (nodeHeight + vGap) + vGap;

  const layoutNodes: LayoutNode[] = [];

  layers.forEach((layer, layerIdx) => {
    const layerWidth = layer.length * (nodeWidth + hGap) - hGap;
    const startX = (svgWidth - layerWidth) / 2;

    layer.forEach((nodeId, nodeIdx) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        layoutNodes.push({
          node,
          x: startX + nodeIdx * (nodeWidth + hGap),
          y: vGap + layerIdx * (nodeHeight + vGap),
          layer: layerIdx,
          index: nodeIdx,
        });
      }
    });
  });

  return { layoutNodes, svgWidth, svgHeight };
}

export function ExecutionGraph({
  workflow,
  nodeStatuses,
  selectedNodeId,
  onNodeClick,
}: ExecutionGraphProps) {
  const { layoutNodes, svgWidth, svgHeight } = useMemo(
    () => computeLayout(workflow.nodes, workflow.edges),
    [workflow.nodes, workflow.edges]
  );

  const nodePositionMap = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    layoutNodes.forEach((ln) => {
      map[ln.node.id] = { x: ln.x, y: ln.y };
    });
    return map;
  }, [layoutNodes]);

  const getNodeStatus = (nodeId: string): NodeStatus => {
    return nodeStatuses[nodeId] || { status: 'pending' };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'var(--mantine-color-green-6)';
      case 'running':
        return 'var(--mantine-color-blue-6)';
      case 'failed':
        return 'var(--mantine-color-red-6)';
      case 'skipped':
        return 'var(--mantine-color-gray-4)';
      default:
        return 'var(--mantine-color-gray-3)';
    }
  };

  const getNodeIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <IconCheck size={14} color="white" />;
      case 'failed':
        return <IconX size={14} color="white" />;
      case 'running':
        return <Loader size={14} color="white" />;
      default:
        return <IconCircle size={10} color="var(--mantine-color-gray-6)" />;
    }
  };

  return (
    <Paper withBorder p="md" style={{ overflow: 'auto' }}>
      <Text size="sm" fw={500} mb="sm">
        执行图谱
      </Text>
      <div style={{ position: 'relative', minHeight: svgHeight, minWidth: svgWidth }}>
        {/* SVG 连线 */}
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          {workflow.edges.map((edge) => {
            const source = nodePositionMap[edge.source_node];
            const target = nodePositionMap[edge.target_node];
            if (!source || !target) return null;

            const nodeWidth = 140;
            const nodeHeight = 60;

            const x1 = source.x + nodeWidth / 2;
            const y1 = source.y + nodeHeight;
            const x2 = target.x + nodeWidth / 2;
            const y2 = target.y;

            const midY = (y1 + y2) / 2;

            return (
              <path
                key={edge.id}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                fill="none"
                stroke="var(--mantine-color-gray-4)"
                strokeWidth={2}
              />
            );
          })}
        </svg>

        {/* 节点 */}
        {layoutNodes.map((ln) => {
          const status = getNodeStatus(ln.node.id);
          const isSelected = selectedNodeId === ln.node.id;
          const color = getStatusColor(status.status);

          return (
            <Paper
              key={ln.node.id}
              withBorder
              p="xs"
              onClick={() => onNodeClick(ln.node.id)}
              style={{
                position: 'absolute',
                left: ln.x,
                top: ln.y,
                width: 140,
                minHeight: 60,
                cursor: 'pointer',
                backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : 'var(--mantine-color-body)',
                borderColor: isSelected ? 'var(--mantine-color-blue-6)' : undefined,
                transition: 'all 0.2s ease',
              }}
            >
              <Group justify="space-between" gap={4} mb={4}>
                <ThemeIcon size="sm" color={color} radius="sm">
                  {getNodeIcon(status.status)}
                </ThemeIcon>
                <Text size="xs" c="dimmed" truncate="end" style={{ flex: 1, textAlign: 'right' }}>
                  {ln.node.node_type}
                </Text>
              </Group>
              <Text size="sm" fw={500} truncate="end">
                {ln.node.name}
              </Text>
              {status.durationMs !== undefined && status.durationMs > 0 && (
                <Text size="xs" c="dimmed" mt={2}>
                  {status.durationMs}ms
                </Text>
              )}
              {status.error && (
                <Text size="xs" c="red" truncate="end">
                  {status.error}
                </Text>
              )}
            </Paper>
          );
        })}
      </div>
    </Paper>
  );
}
