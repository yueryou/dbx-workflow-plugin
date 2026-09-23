import { useEffect, useState, useCallback } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  Progress,
  Code,
  Timeline,
  Loader,
  Alert,
  Button,
} from '@mantine/core';
import { IconCheck, IconX, IconClock, IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { api } from '../../api/client';
import type { ExecutionLogs } from '../../api/types';

interface ExecutionPanelProps {
  executionId: string;
  onComplete?: () => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <IconCheck size={14} color="green" />,
  failed: <IconX size={14} color="red" />,
  running: <Loader size={14} />,
  pending: <IconClock size={14} color="gray" />,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  running: 'blue',
  completed: 'green',
  failed: 'red',
  canceled: 'gray',
};

export function ExecutionPanel({
  executionId,
  onComplete,
  autoRefresh = true,
  refreshInterval = 2000,
}: ExecutionPanelProps) {
  const [data, setData] = useState<ExecutionLogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const logs = await api.getExecutionLogs(executionId);
      setData(logs);
      setError(null);

      // Stop polling if finished
      if (['completed', 'failed', 'canceled'].includes(logs.status)) {
        setPolling(false);
        onComplete?.();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [executionId, onComplete]);

  // Initial load and polling
  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));

    if (autoRefresh) {
      setPolling(true);
    }
  }, []);

  // Polling effect
  useEffect(() => {
    if (!polling) return;

    const timer = setInterval(loadData, refreshInterval);
    return () => clearInterval(timer);
  }, [polling, refreshInterval, loadData]);

  const handleManualRefresh = () => {
    loadData();
  };

  if (loading) {
    return (
      <Paper withBorder p="md">
        <Group>
          <Loader size="sm" />
          <Text>加载执行状态...</Text>
        </Group>
      </Paper>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" title="加载失败">
        {error}
        <Button size="xs" variant="subtle" onClick={handleManualRefresh} mt="xs">
          重试
        </Button>
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  const completedLogs = data.logs.filter((l) => ['completed', 'failed'].includes(l.status));
  const progress = data.logs.length > 0 ? (completedLogs.length / data.logs.length) * 100 : 0;
  const isRunning = data.status === 'running' || data.status === 'pending';

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between">
          <Group gap="xs">
            <Badge
              color={STATUS_COLORS[data.status] || 'gray'}
              variant="filled"
              leftSection={STATUS_ICONS[data.status]}
            >
              {data.status}
            </Badge>
            <Text size="sm" c="dimmed">
              {data.executionId}
            </Text>
          </Group>
          <Group gap="xs">
            {isRunning && polling && <Loader size="xs" />}
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconRefresh size={14} />}
              onClick={handleManualRefresh}
            >
              刷新
            </Button>
          </Group>
        </Group>

        {/* Progress bar */}
        {isRunning && (
          <div>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed">进度</Text>
              <Text size="xs" c="dimmed">{completedLogs.length}/{data.logs.length}</Text>
            </Group>
            <Progress value={progress} animated={isRunning} size="sm" />
          </div>
        )}

        {/* Timeline */}
        <Timeline active={data.logs.length - 1} bulletSize={24} lineWidth={2}>
          {data.logs.map((log, idx) => (
            <Timeline.Item
              key={`${log.nodeId}-${idx}`}
              bullet={STATUS_ICONS[log.status] || <IconClock size={14} />}
              title={
                <Group gap="xs">
                  <Text size="sm">{log.nodeId}</Text>
                  <Badge size="xs" variant="light" color={STATUS_COLORS[log.status]}>
                    {log.status}
                  </Badge>
                </Group>
              }
            >
              <Stack gap={4} mt={4}>
                {log.durationMs !== undefined && log.durationMs > 0 && (
                  <Text size="xs" c="dimmed">
                    耗时: {log.durationMs}ms
                  </Text>
                )}
                {log.output != null && (
                  <Code block style={{ maxHeight: 80, overflow: 'auto', fontSize: 11 }}>
                    {JSON.stringify(log.output, null, 2)}
                  </Code>
                )}
                {log.error && (
                  <Text size="xs" c="red">
                    {log.error}
                  </Text>
                )}
              </Stack>
            </Timeline.Item>
          ))}
        </Timeline>
      </Stack>
    </Paper>
  );
}
