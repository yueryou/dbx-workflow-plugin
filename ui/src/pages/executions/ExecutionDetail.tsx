import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Title,
  Group,
  Paper,
  Stack,
  Text,
  Badge,
  Table,
  Code,
  ActionIcon,
} from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { api } from '../../api/client';
import type { ExecutionLogs, ExecutionLogItem } from '../../api/types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  running: 'blue',
  completed: 'green',
  failed: 'red',
  canceled: 'gray',
};

export function ExecutionDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ExecutionLogs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadLogs(id);
  }, [id]);

  const loadLogs = async (executionId: string) => {
    try {
      setLoading(true);
      const logs = await api.getExecutionLogs(executionId);
      setData(logs);
    } catch (err) {
      console.error('Failed to load execution logs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container py="xl">
        <Text ta="center">{t('common.loading', 'Loading...')}</Text>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container py="xl">
        <Text ta="center">{t('execution.not_found', 'Execution not found')}</Text>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Group mb="lg">
        <ActionIcon component={Link} to="/executions" variant="subtle">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={2}>{t('execution.detail', '执行详情')}</Title>
        <Badge color={STATUS_COLORS[data.status] || 'gray'} size="lg">
          {data.status}
        </Badge>
      </Group>

      <Paper withBorder p="md" mb="lg">
        <Title order={4} mb="sm">{t('execution.info', '执行信息')}</Title>
        <Stack gap="xs">
          <Group>
            <Text size="sm" c="dimmed">{t('execution.id', 'ID')}:</Text>
            <Text size="sm" ff="mono">{data.executionId}</Text>
          </Group>
          <Group>
            <Text size="sm" c="dimmed">{t('execution.workflow', 'Workflow')}:</Text>
            <Text size="sm">{data.workflowId}</Text>
          </Group>
          <Group>
            <Text size="sm" c="dimmed">{t('execution.started', 'Started')}:</Text>
            <Text size="sm">{new Date(data.startedAt).toLocaleString()}</Text>
          </Group>
          {data.finishedAt && (
            <Group>
              <Text size="sm" c="dimmed">{t('execution.finished', 'Finished')}:</Text>
              <Text size="sm">{new Date(data.finishedAt).toLocaleString()}</Text>
            </Group>
          )}
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">{t('execution.logs', '执行日志')}</Title>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('execution.node', 'Node')}</Table.Th>
              <Table.Th>{t('execution.status', 'Status')}</Table.Th>
              <Table.Th>{t('execution.duration', 'Duration')}</Table.Th>
              <Table.Th>{t('execution.output', 'Output')}</Table.Th>
              <Table.Th>{t('execution.error', 'Error')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.logs.map((log: ExecutionLogItem, idx: number) => (
              <Table.Tr key={`${log.nodeId}-${idx}`}>
                <Table.Td>
                  <Badge variant="light" size="sm">{log.nodeId}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={STATUS_COLORS[log.status] || 'gray'} size="sm">
                    {log.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{log.durationMs ?? '-'}ms</Text>
                </Table.Td>
                <Table.Td>
                  {log.output ? (
                    <Code style={{ maxHeight: 60, overflow: 'auto' }} block>
                      {JSON.stringify(log.output)}
                    </Code>
                  ) : (
                    <Text size="sm" c="dimmed">-</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {log.error ? (
                    <Text size="sm" c="red">{log.error}</Text>
                  ) : (
                    <Text size="sm" c="dimmed">-</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>
    </Container>
  );
}
