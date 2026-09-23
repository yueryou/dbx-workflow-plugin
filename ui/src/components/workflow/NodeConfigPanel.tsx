import { useState } from 'react';
import {
  Stack,
  TextInput,
  Select,
  Switch,
  Text,
  Group,
  Paper,
  Textarea,
  Badge,
  Divider,
  Code,
  Button,
  ActionIcon,
} from '@mantine/core';
import { IconTrash, IconCopy } from '@tabler/icons-react';
import type { WorkflowNode, NodeType, CustomRule } from '../../api/types';
import { SqlEditor } from './SqlEditor';
import { CustomRulesEditor } from './CustomRulesEditor';

interface NodeConfigPanelProps {
  node: WorkflowNode;
  upstreamNodes: WorkflowNode[];
  onChange: (node: WorkflowNode) => void;
  onDelete?: () => void;
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  start: '开始节点',
  end: '结束节点',
  http: 'HTTP 请求',
  script: '脚本执行',
  condition: '条件分支',
  wait: '等待',
  data_source: '数据源',
  transform: '转换',
  approval: '人工审批',
  sub_workflow: '子工作流',
  file_read: '文件读取',
  sql_transform: 'SQL 转换',
  sql_execute: 'SQL 执行',
  notify: '通知',
};

const DIALECTS = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'mssql', label: 'SQL Server' },
  { value: 'oracle', label: 'Oracle' },
];

export function NodeConfigPanel({
  node,
  upstreamNodes,
  onChange,
  onDelete,
}: NodeConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'config' | 'advanced'>('config');

  const config = (node.config || {}) as Record<string, unknown>;

  const updateConfig = (key: string, value: unknown) => {
    onChange({
      ...node,
      config: { ...config, [key]: value },
    });
  };

  const renderBasicFields = () => (
    <Stack gap="xs">
      <TextInput
        label="节点名称"
        value={node.name}
        onChange={(e) => onChange({ ...node, name: e.target.value })}
      />
      <Textarea
        label="节点描述"
        value={node.description || ''}
        onChange={(e) => onChange({ ...node, description: e.target.value })}
        minRows={2}
      />
      <Group grow>
        <TextInput label="节点 ID" value={node.id} readOnly disabled />
        <Select
          label="节点类型"
          value={node.node_type}
          data={Object.entries(NODE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(v) => onChange({ ...node, node_type: v as NodeType })}
        />
      </Group>
    </Stack>
  );

  const renderNodeConfig = () => {
    switch (node.node_type) {
      case 'file_read':
        return (
          <Stack gap="md">
            <TextInput
              label="文件路径"
              placeholder="/path/to/file.sql"
              value={(config.path as string) || ''}
              onChange={(e) => updateConfig('path', e.target.value)}
            />
            <Select
              label="路径类型"
              value={(config.pathType as string) || 'absolute'}
              data={[
                { value: 'absolute', label: '绝对路径' },
                { value: 'relative', label: '相对路径' },
                { value: 'workspace', label: '工作区路径' },
              ]}
              onChange={(v) => updateConfig('pathType', v)}
            />
          </Stack>
        );

      case 'sql_transform':
        return (
          <Stack gap="md">
            <Select
              label="输入源"
              description="选择从哪个节点获取 SQL"
              value={(config.inputNode as string) || ''}
              onChange={(v) => updateConfig('inputNode', v)}
              data={upstreamNodes.map((n) => ({
                value: n.id,
                label: `${n.name} (${n.node_type})`,
              }))}
              clearable
              placeholder="选择上游节点..."
            />
            <Group grow>
              <Select
                label="源方言"
                value={(config.sourceDialect as string) || 'mysql'}
                onChange={(v) => updateConfig('sourceDialect', v)}
                data={DIALECTS}
              />
              <Select
                label="目标方言"
                value={(config.targetDialect as string) || 'postgresql'}
                onChange={(v) => updateConfig('targetDialect', v)}
                data={DIALECTS}
              />
            </Group>
            <TextInput
              label="内联 SQL (可选)"
              description="如果未指定输入节点，将使用此 SQL"
              value={(config.sql as string) || ''}
              onChange={(e) => updateConfig('sql', e.target.value)}
            />
            <Divider label="自定义正则规则" />
            <CustomRulesEditor
              rules={((config.customRules as CustomRule[]) || [])}
              onChange={(rules) => updateConfig('customRules', rules)}
            />
          </Stack>
        );

      case 'sql_execute':
        return (
          <Stack gap="md">
            <Select
              label="SQL 来源"
              value={(config.inputNode as string) ? 'node' : 'inline'}
              onChange={(v) => {
                if (v === 'inline') {
                  updateConfig('inputNode', null);
                }
              }}
              data={[
                { value: 'node', label: '上游节点' },
                { value: 'inline', label: '内联 SQL' },
              ]}
            />
            {config.inputNode ? (
              <Select
                label="输入节点"
                value={(config.inputNode as string) || ''}
                onChange={(v) => updateConfig('inputNode', v)}
                data={upstreamNodes.map((n) => ({
                  value: n.id,
                  label: `${n.name} (${n.node_type})`,
                }))}
                placeholder="选择节点..."
              />
            ) : (
              <SqlEditor
                label="SQL 语句"
                value={(config.sql as string) || ''}
                onChange={(sql) => updateConfig('sql', sql)}
                minHeight={120}
              />
            )}
            <Select
              label="目标连接"
              value={(config.connectionId as string) || ''}
              onChange={(v) => updateConfig('connectionId', v)}
              data={[{ value: 'conn_mysql_001', label: '本地 MySQL' }, { value: 'conn_pg_001', label: '生产 PostgreSQL' }]}
              placeholder="选择连接..."
            />
            <Group grow>
              <TextInput
                label="超时 (秒)"
                type="number"
                value={String((config.timeoutSeconds as number) || 30)}
                onChange={(e) => updateConfig('timeoutSeconds', Number(e.target.value))}
              />
              <TextInput
                label="批量大小"
                type="number"
                description="可选"
                value={String((config.batchSize as number) || '')}
                onChange={(e) => updateConfig('batchSize', Number(e.target.value) || null)}
              />
            </Group>
          </Stack>
        );

      case 'condition':
        return (
          <Stack gap="md">
            <Textarea
              label="条件表达式"
              description="支持: >, <, >=, <=, ==, !=, &&, ||"
              placeholder="output.affectedRows > 0"
              value={(config.expression as string) || ''}
              onChange={(e) => updateConfig('expression', e.target.value)}
              minRows={2}
            />
            <Text size="xs" c="dimmed">
              可用变量: nodeId.field (引用上游节点输出), variables.* (全局变量)
            </Text>
            <Paper withBorder p="xs" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
              <Text size="xs" fw={500} mb={4}>
                示例:
              </Text>
              <Stack gap={2}>
                {[
                  'output.status == "success"',
                  'output.affectedRows > 0',
                  'variables.env == "production"',
                  'output.count >= 100 && output.errors == 0',
                ].map((ex) => (
                  <Code
                    key={ex}
                    style={{ cursor: 'pointer' }}
                    onClick={() => updateConfig('expression', ex)}
                  >
                    {ex}
                  </Code>
                ))}
              </Stack>
            </Paper>
          </Stack>
        );

      case 'notify':
        return (
          <Stack gap="md">
            <Select
              label="通知类型"
              value={(config.type as string) || 'webhook'}
              onChange={(v) => updateConfig('type', v)}
              data={[
                { value: 'webhook', label: '通用 Webhook' },
                { value: 'wechat_webhook', label: '企业微信 Webhook' },
                { value: 'dingtalk', label: '钉钉 Webhook' },
                { value: 'feishu', label: '飞书 Webhook' },
              ]}
            />
            <TextInput
              label="Webhook URL"
              placeholder="https://..."
              value={(config.webhookUrl as string) || ''}
              onChange={(e) => updateConfig('webhookUrl', e.target.value)}
            />
            <Textarea
              label="消息模板"
              description="支持 {{variable}} 语法"
              placeholder="工作流 {{workflowName}} 执行 {{status}}"
              value={(config.message as string) || '工作流执行完成: {{workflowName}}'}
              onChange={(e) => updateConfig('message', e.target.value)}
              minRows={3}
            />
          </Stack>
        );

      case 'http':
        return (
          <Stack gap="md">
            <Group grow>
              <Select
                label="请求方法"
                value={(config.method as string) || 'GET'}
                onChange={(v) => updateConfig('method', v)}
                data={['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => ({ value: m, label: m }))}
              />
              <TextInput
                label="Content-Type"
                value={(config.contentType as string) || 'application/json'}
                onChange={(e) => updateConfig('contentType', e.target.value)}
              />
            </Group>
            <TextInput
              label="URL"
              placeholder="https://api.example.com/endpoint"
              value={(config.url as string) || ''}
              onChange={(e) => updateConfig('url', e.target.value)}
            />
            <Textarea
              label="请求体 (JSON)"
              value={(config.body as string) || ''}
              onChange={(e) => updateConfig('body', e.target.value)}
              minRows={4}
            />
          </Stack>
        );

      default:
        return (
          <Paper withBorder p="md" style={{ textAlign: 'center' }}>
            <Text size="sm" c="dimmed">
              节点类型 "{NODE_TYPE_LABELS[node.node_type] || node.node_type}" 无需特殊配置
            </Text>
            {node.node_type === 'start' && (
              <Text size="xs" c="dimmed" mt={4}>
                开始节点标志着工作流的起点
              </Text>
            )}
            {node.node_type === 'end' && (
              <Text size="xs" c="dimmed" mt={4}>
                结束节点标志着工作流的终点
              </Text>
            )}
          </Paper>
        );
    }
  };

  return (
    <Paper withBorder>
      <Group justify="space-between" p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group gap="xs">
          <Badge variant="light">{NODE_TYPE_LABELS[node.node_type] || node.node_type}</Badge>
          <Text size="sm" fw={500}>
            {node.name}
          </Text>
        </Group>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            size="sm"
            title="复制节点"
            onClick={() => {
              // 复制逻辑由父组件处理
            }}
          >
            <IconCopy size={14} />
          </ActionIcon>
          {onDelete && node.node_type !== 'start' && node.node_type !== 'end' && (
            <ActionIcon variant="subtle" color="red" size="sm" title="删除节点" onClick={onDelete}>
              <IconTrash size={14} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      <Group
        gap={0}
        p="xs"
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        {(['basic', 'config', 'advanced'] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'light' : 'subtle'}
            size="xs"
                        onClick={() => setActiveTab(tab)}
            mr={4}
          >
            {tab === 'basic' ? '基础' : tab === 'config' ? '配置' : '高级'}
          </Button>
        ))}
      </Group>

      <Stack gap="md" p="md">
        {activeTab === 'basic' && renderBasicFields()}
        {activeTab === 'config' && renderNodeConfig()}
        {activeTab === 'advanced' && (
          <Stack gap="md">
            <Text size="sm" fw={500}>
              高级选项
            </Text>
            <Switch
              label="失败时重试"
              checked={Boolean(config.retryOnFailure)}
              onChange={(e) => updateConfig('retryOnFailure', e.target.checked)}
            />
            {Boolean(config.retryOnFailure) && (
              <Group grow>
                <TextInput
                  label="最大重试次数"
                  type="number"
                  value={String((config.maxRetries as number) || 3)}
                  onChange={(e) => updateConfig('maxRetries', Number(e.target.value))}
                />
                <TextInput
                  label="重试间隔 (ms)"
                  type="number"
                  value={String((config.retryDelay as number) || 1000)}
                  onChange={(e) => updateConfig('retryDelay', Number(e.target.value))}
                />
              </Group>
            )}
            <Switch
              label="忽略错误继续执行"
              checked={(config.ignoreError as boolean) || false}
              onChange={(e) => updateConfig('ignoreError', e.target.checked)}
            />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
