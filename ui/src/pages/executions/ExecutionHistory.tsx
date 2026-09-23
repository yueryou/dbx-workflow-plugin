import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Title,
  Paper,
  Table,
  Badge,
  Text,
} from '@mantine/core';
import { api } from '../../api/client';
import type { ExecutionSummary } from '../../api/types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  running: 'blue',
  completed: 'green',
  failed: 'red',
  canceled: 'gray',
};

export function ExecutionHistoryPage() {
  const { t } = useTranslation();
  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const data = await api.listExecutions();
      setExecutions(data);
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="lg">{t('nav.executions', 'Executions')}</Title>

      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('execution.id', 'ID')}</Table.Th>
              <Table.Th>{t('execution.workflow', 'Workflow')}</Table.Th>
              <Table.Th>{t('execution.status', 'Status')}</Table.Th>
              <Table.Th>{t('execution.started', 'Started')}</Table.Th>
              <Table.Th style={{ width: 120 }}>{t('execution.duration', 'Duration')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="dimmed">{t('common.loading', 'Loading...')}</Text>
                </Table.Td>
              </Table.Tr>
            ) : executions.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="dimmed">{t('execution.empty', 'No executions yet')}</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              executions.map((ex) => (
                <Table.Tr key={ex.id}>
                  <Table.Td>
                    <Text component={Link} to={`/executions/${ex.id}`} size="sm" ff="mono">
                      {ex.id}
                    </Text>
                  </Table.Td>
                  <Table.Td>{ex.workflow_id}</Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COLORS[ex.status] || 'gray'}>
                      {ex.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{new Date(ex.started_at).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {ex.finished_at
                        ? `${new Date(ex.finished_at).getTime() - new Date(ex.started_at).getTime()}ms`
                        : '-'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Container>
  );
}
