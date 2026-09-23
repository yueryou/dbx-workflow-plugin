import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Title,
  Group,
  Button,
  Paper,
  Stack,
  Text,
  Badge,
  SimpleGrid,
  Table,
  ActionIcon,
  Code,
} from '@mantine/core';
import { IconArrowLeft, IconEdit, IconPlayerPlay, IconTrash } from '@tabler/icons-react';
import { api } from '../../api/client';
import type { Workflow } from '../../api/types';

export function WorkflowDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (id) loadWorkflow(id);
  }, [id]);

  const loadWorkflow = async (workflowId: string) => {
    try {
      setLoading(true);
      const data = await api.getWorkflow(workflowId);
      setWorkflow(data);
    } catch (err) {
      console.error('Failed to load workflow:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    if (!workflow) return;
    try {
      setRunning(true);
      await api.runExecution(workflow.id);
      navigate('/executions');
    } catch (err) {
      console.error('Failed to run workflow:', err);
    } finally {
      setRunning(false);
    }
  };

  const handleDelete = async () => {
    if (!workflow || !confirm(t('workflow.delete_confirm', '确定要删除这个工作流吗？'))) return;
    try {
      await api.deleteWorkflow(workflow.id);
      navigate('/workflows');
    } catch (err) {
      console.error('Failed to delete workflow:', err);
    }
  };

  if (loading) {
    return (
      <Container py="xl">
        <Text ta="center">{t('common.loading', 'Loading...')}</Text>
      </Container>
    );
  }

  if (!workflow) {
    return (
      <Container py="xl">
        <Text ta="center">{t('workflow.not_found', 'Workflow not found')}</Text>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Group>
          <ActionIcon component={Link} to="/workflows" variant="subtle">
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>{workflow.name}</Title>
          <Badge variant="light">v{workflow.version}</Badge>
        </Group>
        <Group>
          <Button
            variant="light"
            leftSection={<IconPlayerPlay size={16} />}
            onClick={handleRun}
            loading={running}
          >
            {t('workflow.run', 'Run')}
          </Button>
          <Button
            variant="light"
            leftSection={<IconEdit size={16} />}
            component={Link}
            to={`/workflows/${workflow.id}/edit`}
          >
            {t('common.edit', 'Edit')}
          </Button>
          <ActionIcon color="red" variant="subtle" onClick={handleDelete}>
            <IconTrash size={18} />
          </ActionIcon>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Paper withBorder p="md">
          <Title order={4} mb="sm">{t('workflow.info', '基本信息')}</Title>
          <Stack gap="xs">
            <div>
              <Text size="sm" c="dimmed">{t('workflow.description', 'Description')}</Text>
              <Text>{workflow.description || '-'}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">{t('workflow.tags', 'Tags')}</Text>
              <Group gap={4}>
                {workflow.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </Group>
            </div>
            <div>
              <Text size="sm" c="dimmed">{t('workflow.created', 'Created')}</Text>
              <Text size="sm">{new Date(workflow.created_at).toLocaleString()}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">{t('workflow.updated', 'Updated')}</Text>
              <Text size="sm">{new Date(workflow.updated_at).toLocaleString()}</Text>
            </div>
          </Stack>
        </Paper>

        <Paper withBorder p="md">
          <Title order={4} mb="sm">{t('workflow.flow', '工作流结构')}</Title>
          <Stack gap="xs">
            {workflow.nodes.map((node, idx) => (
              <Group key={node.id} gap="xs">
                <Badge size="sm" variant="filled">{idx + 1}</Badge>
                <Text size="sm">{node.name}</Text>
                <Badge size="xs" variant="light" color="gray">{node.node_type}</Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md" mt="lg">
        <Title order={4} mb="sm">{t('workflow.nodes_detail', '节点详情')}</Title>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('workflow.node_name', '名称')}</Table.Th>
              <Table.Th>{t('workflow.node_type', '类型')}</Table.Th>
              <Table.Th>{t('workflow.node_config', '配置')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {workflow.nodes.map((node) => (
              <Table.Tr key={node.id}>
                <Table.Td>{node.name}</Table.Td>
                <Table.Td>
                  <Badge variant="light">{node.node_type}</Badge>
                </Table.Td>
                <Table.Td>
                  {node.config ? (
                    <Code style={{ maxHeight: 60, overflow: 'auto' }} block>
                      {JSON.stringify(node.config, null, 2)}
                    </Code>
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
