import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  Button,
  Group,
  Text,
  Badge,
  ActionIcon,
  Menu,
  TextInput,
  Stack,
  Modal,
  Loader,
  Alert,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTrash, IconDots, IconAlertCircle, IconDeviceDesktop } from '@tabler/icons-react';
import { useWorkflowStore } from '../store/useWorkflowStore';
import { api } from '../api/client';

export function WorkflowList() {
  const { t } = useTranslation();
  const {
    workflows,
    loading,
    error,
    fetchWorkflows,
    createWorkflow,
    deleteWorkflow,
  } = useWorkflowStore();

  const [opened, { open, close }] = useDisclosure(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createWorkflow({
        name: newName.trim(),
        nodes: [],
        edges: [],
        tags: [],
      });
      setNewName('');
      close();
    } catch {
      // error is in store
    }
  };

  const rows = workflows.map((wf) => (
    <Table.Tr key={wf.id}>
      <Table.Td>
        <Text fw={500}>{wf.name}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          v{wf.version}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{wf.node_count}</Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          {wf.tags.map((tag) => (
            <Badge key={tag} size="sm" variant="light">
              {tag}
            </Badge>
          ))}
        </Group>
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {wf.updated_at}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs" justify="flex-end">
          <Menu withinPortal position="bottom-end" shadow="sm">
            <Menu.Target>
              <ActionIcon variant="subtle">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => deleteWorkflow(wf.id)}
              >
                {t('common.delete')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Text size="lg" fw={600}>
            {t('workflow.title')}
          </Text>
          {api.isMockMode && (
            <Badge size="xs" variant="outline" color="orange" mt={4} leftSection={<IconDeviceDesktop size={12} />}>
              Demo Mode
            </Badge>
          )}
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={open}
          variant="light"
        >
          {t('workflow.newName')}
        </Button>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {loading ? (
        <Group justify="center" p="xl">
          <Loader size="sm" />
          <Text c="dimmed" size="sm">{t('common.loading')}</Text>
        </Group>
      ) : workflows.length === 0 ? (
        <Text c="dimmed" ta="center" p="xl">
          {t('workflow.empty')}
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('workflow.name')}</Table.Th>
              <Table.Th>{t('workflow.version')}</Table.Th>
              <Table.Th>{t('workflow.nodes')}</Table.Th>
              <Table.Th>{t('workflow.tags')}</Table.Th>
              <Table.Th>{t('workflow.updated')}</Table.Th>
              <Table.Th>{t('common.actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={close} title={t('workflow.newName')}>
        <Stack>
          <TextInput
            label={t('workflow.name')}
            placeholder="My Workflow"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            autoFocus
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate}>{t('common.create')}</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
