import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Container,
  Title,
  Group,
  Button,
  Table,
  Badge,
  ActionIcon,
  Menu,
  Text,
  Paper,
} from '@mantine/core';
import { IconPlus, IconDots, IconEdit, IconTrash, IconPlayerPlay } from '@tabler/icons-react';
import { api } from '../../api/client';
import type { WorkflowSummary } from '../../api/types';

export function WorkflowListPage() {
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const data = await api.listWorkflows();
      setWorkflows(data);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个工作流吗？')) return;
    try {
      await api.deleteWorkflow(id);
      loadWorkflows();
    } catch (err) {
      console.error('Failed to delete workflow:', err);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>{t('nav.workflows', 'Workflows')}</Title>
        <Button
          component={Link}
          to="/workflows/new"
          leftSection={<IconPlus size={16} />}
        >
          {t('workflow.new', 'New Workflow')}
        </Button>
      </Group>

      <Paper withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('workflow.name', 'Name')}</Table.Th>
              <Table.Th>{t('workflow.version', 'Version')}</Table.Th>
              <Table.Th>{t('workflow.tags', 'Tags')}</Table.Th>
              <Table.Th>{t('workflow.nodes', 'Nodes')}</Table.Th>
              <Table.Th>{t('workflow.updated', 'Updated')}</Table.Th>
              <Table.Th style={{ width: 100 }}>{t('common.actions', 'Actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed">{t('common.loading', 'Loading...')}</Text>
                </Table.Td>
              </Table.Tr>
            ) : workflows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed">{t('workflow.empty', 'No workflows yet')}</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              workflows.map((wf) => (
                <Table.Tr key={wf.id}>
                  <Table.Td>
                    <Text component={Link} to={`/workflows/${wf.id}`} fw={500}>
                      {wf.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">v{wf.version}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {wf.tags.map((tag) => (
                        <Badge key={tag} size="sm" variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>{wf.node_count}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {new Date(wf.updated_at).toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" color="blue" title={t('workflow.run', 'Run')}>
                        <IconPlayerPlay size={16} />
                      </ActionIcon>
                      <Menu>
                        <Menu.Target>
                          <ActionIcon variant="subtle">
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEdit size={14} />}
                            component={Link}
                            to={`/workflows/${wf.id}/edit`}
                          >
                            {t('common.edit', 'Edit')}
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconTrash size={14} />}
                            color="red"
                            onClick={() => handleDelete(wf.id)}
                          >
                            {t('common.delete', 'Delete')}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
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
