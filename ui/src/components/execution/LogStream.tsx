import { useEffect, useRef, useState } from 'react';
import { Paper, Text, Group, ActionIcon, Switch, Badge, Stack } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

interface LogEntry {
  timestamp: string;
  nodeId: string;
  nodeName?: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

interface LogStreamProps {
  logs: LogEntry[];
  selectedNodeId: string | null;
  onNodeFilter: (nodeId: string | null) => void;
  autoScroll?: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  info: 'var(--mantine-color-gray-6)',
  warn: 'var(--mantine-color-yellow-6)',
  error: 'var(--mantine-color-red-6)',
  success: 'var(--mantine-color-green-6)',
};

const LEVEL_LABELS: Record<string, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERR',
  success: 'OK',
};

export function LogStream({
  logs,
  selectedNodeId,
  onNodeFilter,
  autoScroll = true,
}: LogStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [filterNode, setFilterNode] = useState<string | null>(selectedNodeId);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && !isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isPaused, autoScroll]);

  // 同步外部筛选
  useEffect(() => {
    setFilterNode(selectedNodeId);
  }, [selectedNodeId]);

  const filteredLogs = filterNode
    ? logs.filter((log) => log.nodeId === filterNode)
    : logs;

  const handleClear = () => {
    // 清空日志由父组件处理
  };

  return (
    <Paper withBorder>
      <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group gap="xs">
          <Text size="sm" fw={500}>
            实时日志
          </Text>
          <Badge size="sm" variant="light" color="gray">
            {filteredLogs.length}
          </Badge>
          {filterNode && (
            <Badge
              size="sm"
              variant="light"
              color="blue"
              style={{ cursor: 'pointer' }}
              onClick={() => onNodeFilter(null)}
            >
              {filterNode} ✕
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          <Switch
            size="xs"
            label="实时跟踪"
            checked={!isPaused}
            onChange={(e) => setIsPaused(!e.target.checked)}
            labelPosition="left"
          />
          <ActionIcon variant="subtle" size="sm" title="清空" onClick={handleClear}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <div
        ref={scrollRef}
        style={{
          maxHeight: 300,
          overflow: 'auto',
          padding: '8px 12px',
          backgroundColor: 'var(--mantine-color-gray-0)',
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {filteredLogs.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">
            暂无日志
          </Text>
        ) : (
          <Stack gap={2}>
            {filteredLogs.map((log, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  style={{
                    color: LEVEL_COLORS[log.level],
                    flexShrink: 0,
                    fontWeight: 600,
                    width: 35,
                  }}
                >
                  {LEVEL_LABELS[log.level]}
                </span>
                <span
                  style={{
                    color: 'var(--mantine-color-blue-7)',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                  onClick={() => onNodeFilter(log.nodeId)}
                >
                  [{log.nodeId}]
                </span>
                <span style={{ color: 'var(--mantine-color-text)' }}>{log.message}</span>
              </div>
            ))}
          </Stack>
        )}
      </div>
    </Paper>
  );
}
