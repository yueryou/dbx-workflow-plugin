import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Group,
  Button,
  Table,
  Badge,
  ActionIcon,
  Paper,
  Text,
  Modal,
  Stack,
  TextInput,
  NumberInput,
  PasswordInput,
  Select,
  Code,
} from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconTestPipe, IconCheck, IconX } from '@tabler/icons-react';
import { api } from '../../api/client';
import type { DbConnection, DbConnectionInput } from '../../api/types';

export function ConnectionManagerPage() {
  const { t } = useTranslation();
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DbConnection | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({});

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const data = await api.listConnections();
      setConnections(data);
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (id: string, conn: DbConnection) => {
    setTesting(id);
    setTestResult((r) => ({ ...r, [id]: null }));
    try {
      const result = await api.testConnection({
        name: conn.name,
        driver: conn.driver,
        host: conn.host,
        port: conn.port,
        database: conn.database,
        username: conn.username || '',
      });
      setTestResult((r) => ({ ...r, [id]: result.success }));
    } catch (err) {
      setTestResult((r) => ({ ...r, [id]: false }));
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('connection.delete_confirm', '确定要删除这个连接吗？'))) return;
    try {
      await api.deleteConnection(id);
      loadConnections();
    } catch (err) {
      console.error('Failed to delete connection:', err);
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Text fw={600}>{t('connection.manage', '数据库连接管理')}</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditing(null); setShowForm(true); }}>
          {t('connection.add', '添加连接')}
        </Button>
      </Group>

      <Paper withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('connection.name', '名称')}</Table.Th>
              <Table.Th>{t('connection.type', '类型')}</Table.Th>
              <Table.Th>{t('connection.host', '主机')}</Table.Th>
              <Table.Th>{t('connection.database', '数据库')}</Table.Th>
              <Table.Th>{t('connection.status', '状态')}</Table.Th>
              <Table.Th>{t('common.actions', '操作')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed">{t('common.loading', 'Loading...')}</Text>
                </Table.Td>
              </Table.Tr>
            ) : connections.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed">{t('connection.empty', 'No connections configured')}</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              connections.map((conn) => (
                <Table.Tr key={conn.id}>
                  <Table.Td>{conn.name}</Table.Td>
                  <Table.Td>
                    <Badge>{conn.driver}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Code>{conn.host}:{conn.port}</Code>
                  </Table.Td>
                  <Table.Td>{conn.database}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={conn.status === 'connected' ? 'green' : conn.status === 'error' ? 'red' : 'gray'}
                    >
                      {conn.status || 'unknown'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon
                        variant="subtle"
                        loading={testing === conn.id}
                        onClick={() => handleTestConnection(conn.id, conn)}
                        title={t('connection.test', 'Test')}
                      >
                        <IconTestPipe size={16} />
                      </ActionIcon>
                      {testResult[conn.id] === true && <IconCheck size={16} color="green" />}
                      {testResult[conn.id] === false && <IconX size={16} color="red" />}
                      <ActionIcon variant="subtle" onClick={() => { setEditing(conn); setShowForm(true); }}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon color="red" variant="subtle" onClick={() => handleDelete(conn.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <ConnectionFormModal
        opened={showForm}
        onClose={() => setShowForm(false)}
        connection={editing}
        onSave={loadConnections}
      />
    </div>
  );
}

interface ConnectionFormModalProps {
  opened: boolean;
  onClose: () => void;
  connection: DbConnection | null;
  onSave: () => void;
}

function ConnectionFormModal({ opened, onClose, connection, onSave }: ConnectionFormModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<DbConnectionInput>({
    name: '',
    driver: 'mysql',
    host: 'localhost',
    port: 3306,
    database: '',
    username: '',
    password: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (connection) {
      setForm({
        name: connection.name,
        driver: connection.driver,
        host: connection.host,
        port: connection.port,
        database: connection.database,
        username: connection.username || '',
        password: '',
      });
    } else {
      setForm({
        name: '',
        driver: 'mysql',
        host: 'localhost',
        port: 3306,
        database: '',
        username: '',
        password: '',
      });
    }
  }, [connection, opened]);

  const handleSave = async () => {
    try {
      setSaving(true);
      if (connection) {
        await api.updateConnection(connection.id, form);
      } else {
        await api.createConnection(form);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save connection:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={connection ? t('connection.edit', '编辑连接') : t('connection.add', '添加连接')}
      size="md"
    >
      <Stack>
        <Select
          label={t('connection.driver', '数据库类型')}
          value={form.driver}
          onChange={(v) => setForm({ ...form, driver: v || 'mysql' })}
          data={[
            { value: 'mysql', label: 'MySQL' },
            { value: 'postgresql', label: 'PostgreSQL' },
            { value: 'sqlite', label: 'SQLite' },
            { value: 'mssql', label: 'SQL Server' },
            { value: 'oracle', label: 'Oracle' },
          ]}
        />
        <TextInput
          label={t('connection.name', '连接名称')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="My Database"
        />
        <Group grow>
          <TextInput
            label={t('connection.host', '主机')}
            value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })}
          />
          <NumberInput
            label={t('connection.port', '端口')}
            value={form.port}
            onChange={(v) => setForm({ ...form, port: Number(v) || 3306 })}
          />
        </Group>
        <TextInput
          label={t('connection.database', '数据库')}
          value={form.database}
          onChange={(e) => setForm({ ...form, database: e.target.value })}
        />
        <TextInput
          label={t('connection.username', '用户名')}
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <PasswordInput
          label={t('connection.password', '密码')}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {t('common.save', 'Save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
