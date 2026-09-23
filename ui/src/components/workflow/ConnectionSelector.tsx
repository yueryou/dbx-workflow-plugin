import { useEffect, useState } from 'react';
import { Select, Stack, Text, Badge, Group } from '@mantine/core';
import { api } from '../../api/client';
import type { DbConnection } from '../../api/types';

interface ConnectionSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  withNewLink?: boolean;
}

export function ConnectionSelector({
  value,
  onChange,
  label = '数据库连接',
  placeholder = '选择连接',
  withNewLink = true,
}: ConnectionSelectorProps) {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const data = await api.listConnections();
      setConnections(data);
    } catch (err) {
      console.error('Failed to load connections:', err);
    }
  };

  const selected = connections.find((c) => c.id === value);

  return (
    <Stack gap="xs">
      <Select
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(v) => onChange(v || '')}
        data={connections.map((c) => ({
          value: c.id,
          label: `${c.name} (${c.host}:${c.port}/${c.database})`,
        }))}
        searchable
        clearable
      />
      {selected && (
        <Group gap="xs" ml={2}>
          <Badge size="xs" variant="light" color={selected.status === 'connected' ? 'green' : 'gray'}>
            {selected.driver}
          </Badge>
          <Text size="xs" c="dimmed">
            {selected.host}:{selected.port}/{selected.database}
          </Text>
        </Group>
      )}
      {withNewLink && (
        <Text size="xs">
          <a href="#/settings/connections" style={{ color: 'var(--mantine-color-blue-6)' }}>
            + 添加新连接
          </a>
        </Text>
      )}
    </Stack>
  );
}
