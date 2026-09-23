import { useState } from 'react';
import {
  Stack,
  Text,
  Group,
  Button,
  TextInput,
  ActionIcon,
  Badge,
  Switch,
  Paper,
  Code,
} from '@mantine/core';
import { IconPlus, IconTrash, IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import type { CustomRule } from '../../api/types';

interface CustomRulesEditorProps {
  rules: CustomRule[];
  onChange: (rules: CustomRule[]) => void;
}

export function CustomRulesEditor({ rules, onChange }: CustomRulesEditorProps) {
  const [testingRule, setTestingRule] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  const addRule = () => {
    onChange([
      ...rules,
      {
        name: `Rule ${rules.length + 1}`,
        pattern: '',
        replacement: '',
        enabled: true,
      },
    ]);
  };

  const updateRule = (index: number, updates: Partial<CustomRule>) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], ...updates };
    onChange(newRules);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= rules.length) return;
    const newRules = [...rules];
    [newRules[index], newRules[newIndex]] = [newRules[newIndex], newRules[index]];
    onChange(newRules);
  };

  const testRule = (rule: CustomRule) => {
    if (!rule.pattern) {
      setTestResult('请输入正则表达式');
      return;
    }
    try {
      const re = new RegExp(rule.pattern, 'g');
      const result = testInput.replace(re, rule.replacement);
      setTestResult(result);
      setTestingRule(rule.name);
    } catch (err) {
      setTestResult(`正则错误: ${(err as Error).message}`);
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          自定义正则规则
          <Badge size="sm" variant="light" ml={8}>
            {rules.length}
          </Badge>
        </Text>
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addRule}>
          添加规则
        </Button>
      </Group>

      <Text size="xs" c="dimmed">
        使用正则表达式定义自定义转换规则。规则按顺序应用。
      </Text>

      {rules.length === 0 ? (
        <Paper withBorder p="md" style={{ textAlign: 'center' }}>
          <Text size="sm" c="dimmed">
            暂无自定义规则
          </Text>
        </Paper>
      ) : (
        rules.map((rule, index) => (
          <Paper key={index} withBorder p="sm" opacity={rule.enabled ? 1 : 0.6}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <Switch
                    size="xs"
                    checked={rule.enabled}
                    onChange={(e) => updateRule(index, { enabled: e.target.checked })}
                  />
                  <TextInput
                    size="xs"
                    placeholder="规则名称"
                    value={rule.name}
                    onChange={(e) => updateRule(index, { name: e.target.value })}
                    style={{ width: 150 }}
                  />
                </Group>
                <Group gap={4}>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => moveRule(index, -1)}
                    disabled={index === 0}
                  >
                    <IconArrowUp size={14} />
                  </ActionIcon>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    onClick={() => moveRule(index, 1)}
                    disabled={index === rules.length - 1}
                  >
                    <IconArrowDown size={14} />
                  </ActionIcon>
                  <ActionIcon size="sm" variant="subtle" color="red" onClick={() => removeRule(index)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Group>
              <Group grow>
                <TextInput
                  size="xs"
                  placeholder="正则表达式"
                  value={rule.pattern}
                  onChange={(e) => updateRule(index, { pattern: e.target.value })}
                  error={rule.pattern && !isValidRegex(rule.pattern) ? '无效的正则' : null}
                />
                <TextInput
                  size="xs"
                  placeholder="替换内容 (支持 $1, $2...)"
                  value={rule.replacement}
                  onChange={(e) => updateRule(index, { replacement: e.target.value })}
                />
              </Group>
              <Group>
                <Button size="xs" variant="default" onClick={() => testRule(rule)}>
                  测试
                </Button>
                {testingRule === rule.name && testResult && (
                  <Code style={{ flex: 1, maxHeight: 60, overflow: 'auto' }}>{testResult}</Code>
                )}
              </Group>
            </Stack>
          </Paper>
        ))
      )}

      {rules.length > 0 && (
        <Paper withBorder p="xs" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
          <Text size="xs" c="dimmed" mb={4}>
            快速测试 (应用于所有启用的规则)
          </Text>
          <Group grow>
            <TextInput
              size="xs"
              placeholder="输入测试文本..."
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
            />
            <Button
              size="xs"
              variant="light"
              onClick={() => {
                let result = testInput;
                for (const rule of rules) {
                  if (rule.enabled && rule.pattern) {
                    try {
                      const re = new RegExp(rule.pattern, 'g');
                      result = result.replace(re, rule.replacement);
                    } catch {
                      // skip invalid
                    }
                  }
                }
                setTestResult(result);
                setTestingRule('all');
              }}
            >
              运行所有规则
            </Button>
          </Group>
          {testingRule === 'all' && testResult && (
            <Code block mt={8} style={{ maxHeight: 80, overflow: 'auto' }}>
              {testResult}
            </Code>
          )}
        </Paper>
      )}
    </Stack>
  );
}

function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
