import { Paper, Text, Group, Progress, Badge } from '@mantine/core';
import { IconCheck, IconX, IconLoader, IconClock } from '@tabler/icons-react';

interface ProgressBarProps {
  totalNodes: number;
  completedNodes: number;
  runningNodes: number;
  failedNodes: number;
  durationMs: number;
  status: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m${sec}s`;
}

export function ProgressBar({
  totalNodes,
  completedNodes,
  runningNodes,
  failedNodes,
  durationMs,
  status,
}: ProgressBarProps) {
  const waitingNodes = totalNodes - completedNodes - runningNodes - failedNodes;

  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'running':
        return 'blue';
      case 'failed':
        return 'red';
      case 'canceled':
        return 'gray';
      default:
        return 'yellow';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'completed':
        return <IconCheck size={16} />;
      case 'running':
        return <IconLoader size={16} />;
      case 'failed':
        return <IconX size={16} />;
      default:
        return <IconClock size={16} />;
    }
  };

  return (
    <Paper withBorder p="md">
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <Badge color={getStatusColor()} variant="filled" leftSection={getStatusIcon()}>
            {status}
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          耗时: {formatDuration(durationMs)}
        </Text>
      </Group>

      {/* 分段进度条 */}
      <Progress.Root size="xl" mb="sm">
        {completedNodes > 0 && (
          <Progress.Section value={(waitingNodes / totalNodes) * 100} color="gray" />
        )}
        {runningNodes > 0 && (
          <Progress.Section
            value={(runningNodes / totalNodes) * 100}
            color="blue"
            animated
          />
        )}
        {failedNodes > 0 && (
          <Progress.Section value={(failedNodes / totalNodes) * 100} color="red" />
        )}
      </Progress.Root>

      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {completedNodes}/{totalNodes} 节点
        </Text>
        <Group gap="md">
          <Group gap={4}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--mantine-color-green-6)',
              }}
            />
            <Text size="xs" c="dimmed">
              完成 {completedNodes}
            </Text>
          </Group>
          <Group gap={4}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--mantine-color-blue-6)',
              }}
            />
            <Text size="xs" c="dimmed">
              运行中 {runningNodes}
            </Text>
          </Group>
          {failedNodes > 0 && (
            <Group gap={4}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-red-6)',
                }}
              />
              <Text size="xs" c="dimmed">
                失败 {failedNodes}
              </Text>
            </Group>
          )}
        </Group>
      </Group>
    </Paper>
  );
}
