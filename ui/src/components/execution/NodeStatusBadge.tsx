import { Badge, Text, Code, Tooltip, Stack } from '@mantine/core';
import { IconCheck, IconX, IconClock, IconLoader } from '@tabler/icons-react';

interface NodeStatusBadgeProps {
  status: string;
  name?: string;
  duration?: number;
  error?: string | null;
  output?: unknown;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'yellow', icon: <IconClock size={12} />, label: '等待中' },
  running: { color: 'blue', icon: <IconLoader size={12} />, label: '运行中' },
  completed: { color: 'green', icon: <IconCheck size={12} />, label: '完成' },
  failed: { color: 'red', icon: <IconX size={12} />, label: '失败' },
  skipped: { color: 'gray', icon: <IconClock size={12} />, label: '跳过' },
  canceled: { color: 'gray', icon: <IconX size={12} />, label: '取消' },
};

export function NodeStatusBadge({ status, name, duration, error, output }: NodeStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  const badge = (
    <Badge
      color={config.color}
      variant="light"
      size="sm"
      leftSection={config.icon}
    >
      {config.label}
      {duration !== undefined && duration > 0 && ` (${duration}ms)`}
    </Badge>
  );

  if (!error && !output) {
    return badge;
  }

  return (
    <Tooltip
      multiline
      withArrow
      label={
        <Stack gap={4}>
          {name && <Text size="xs" fw={500}>{name}</Text>}
          {error && <Text size="xs" c="red">{error}</Text>}
          {output != null && (
            <Code style={{ maxHeight: 100, overflow: 'auto', fontSize: 10 }} block>
              {JSON.stringify(output, null, 2)}
            </Code>
          )}
        </Stack>
      }
    >
      {badge}
    </Tooltip>
  );
}
