import { useEffect, useState } from 'react';
import {
  Stack,
  Text,
  Group,
  Paper,
  Code,
  Badge,
  Button,
  Loader,
  Alert,
} from '@mantine/core';
import { IconPlayerPlay, IconAlertCircle } from '@tabler/icons-react';
import { api } from '../../api/client';
import type { CustomRule } from '../../api/types';

interface TransformPreviewProps {
  sql: string;
  sourceDialect: string;
  targetDialect: string;
  customRules?: CustomRule[];
}

export function TransformPreview({
  sql,
  sourceDialect,
  targetDialect,
  customRules = [],
}: TransformPreviewProps) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-preview when inputs change (debounced)
    const timer = setTimeout(() => {
      if (sql) {
        runTransform();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [sql, sourceDialect, targetDialect, customRules]);

  const runTransform = async () => {
    if (!sql.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.transformSql({
        sql,
        sourceDialect,
        targetDialect,
        customRules: customRules.filter((r) => r.enabled && r.pattern),
      });
      setResult(res.sql);
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const diffLines = getDiff(sql, result || '');

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          转换预览
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={loading ? <Loader size={14} /> : <IconPlayerPlay size={14} />}
          onClick={runTransform}
          loading={loading}
        >
          刷新
        </Button>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error}
        </Alert>
      )}

      <Group grow align="flex-start">
        <Paper withBorder p="sm" style={{ flex: 1 }}>
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed">
              源 ({sourceDialect})
            </Text>
            <Badge size="xs" variant="light">
              {sql.split('\n').length} 行
            </Badge>
          </Group>
          <Code block style={{ maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {sql || '(空)'}
          </Code>
        </Paper>

        <Paper withBorder p="sm" style={{ flex: 1 }}>
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed">
              结果 ({targetDialect})
            </Text>
            <Group gap="xs">
              {result && result !== sql && (
                <Badge size="xs" color="green" variant="light">
                  已转换
                </Badge>
              )}
              {result && result === sql && (
                <Badge size="xs" color="gray" variant="light">
                  无变化
                </Badge>
              )}
            </Group>
          </Group>
          <Code block style={{ maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {result || '(等待转换...)'}
          </Code>
        </Paper>
      </Group>

      {diffLines.added > 0 || diffLines.removed > 0 ? (
        <Text size="xs" c="dimmed">
          变更: <span style={{ color: 'green' }}>+{diffLines.added}</span> 行,{' '}
          <span style={{ color: 'red' }}>-{diffLines.removed}</span> 行
        </Text>
      ) : null}
    </Stack>
  );
}

function getDiff(original: string, transformed: string) {
  const origLines = original.split('\n');
  const transLines = transformed.split('\n');
  let added = 0;
  let removed = 0;
  const maxLen = Math.max(origLines.length, transLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= origLines.length) added++;
    else if (i >= transLines.length) removed++;
    else if (origLines[i] !== transLines[i]) {
      removed++;
      added++;
    }
  }
  return { added, removed };
}
