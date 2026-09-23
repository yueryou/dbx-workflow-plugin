import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Title,
  Stepper,
  Button,
  Group,
  TextInput,
  Textarea,
  TagsInput,
  Select,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import { ConnectionSelector } from '../../components/workflow/ConnectionSelector';
import { SqlEditor } from '../../components/workflow/SqlEditor';
import { CustomRulesEditor } from '../../components/workflow/CustomRulesEditor';
import { TransformPreview } from '../../components/workflow/TransformPreview';
import { api } from '../../api/client';
import type { CustomRule } from '../../api/types';

interface WorkflowConfig {
  name: string;
  description: string;
  tags: string[];
  template: string;
  sourceConnection: string;
  targetConnection: string;
  sourceDialect: string;
  targetDialect: string;
  sql: string;
  customRules: CustomRule[];
}

const TEMPLATES = [
  { value: 'sql_sync', label: 'SQL 数据同步' },
  { value: 'backup', label: '数据备份' },
  { value: 'etl', label: 'ETL 管道' },
  { value: 'custom', label: '自定义' },
];

export function WorkflowCreatorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  const [config, setConfig] = useState<WorkflowConfig>({
    name: '',
    description: '',
    tags: [],
    template: 'sql_sync',
    sourceConnection: '',
    targetConnection: '',
    sourceDialect: 'mysql',
    targetDialect: 'postgresql',
    sql: 'SELECT `id`, `name`, `email` FROM `users` WHERE `status` = 1 LIMIT 100',
    customRules: [],
  });

  const handleCreate = async () => {
    try {
      setLoading(true);
      // 根据选择的连接获取连接信息，构建工作流
      const wf = await api.createWorkflow({
        name: config.name,
        description: config.description,
        tags: config.tags,
        nodes: [
          { id: 'n1', node_type: 'start', name: '开始', inputs: [], outputs: [] },
          {
            id: 'n2',
            node_type: 'file_read',
            name: '读取 SQL',
            inputs: [],
            outputs: [{ id: 'o2', label: 'content' }],
            config: { path: 'inline', sourceConnection: config.sourceConnection },
          },
          {
            id: 'n3',
            node_type: 'sql_transform',
            name: `${config.sourceDialect} → ${config.targetDialect}`,
            inputs: [],
            outputs: [{ id: 'o3', label: 'converted' }],
            config: {
              inputNode: 'n2',
              sourceDialect: config.sourceDialect,
              targetDialect: config.targetDialect,
              customRules: config.customRules,
            },
          },
          {
            id: 'n4',
            node_type: 'sql_execute',
            name: '执行 SQL',
            inputs: [],
            outputs: [],
            config: { inputNode: 'n3', connectionId: config.targetConnection },
          },
          { id: 'n5', node_type: 'end', name: '完成', inputs: [], outputs: [] },
        ],
        edges: [
          { id: 'e1', source_node: 'n1', target_node: 'n2' },
          { id: 'e2', source_node: 'n2', target_node: 'n3' },
          { id: 'e3', source_node: 'n3', target_node: 'n4' },
          { id: 'e4', source_node: 'n4', target_node: 'n5' },
        ],
      });
      navigate(`/workflows/${wf.id}`);
    } catch (err) {
      console.error('Failed to create workflow:', err);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setActive((s) => Math.min(s + 1, 5));
  const prevStep = () => setActive((s) => Math.max(s - 1, 0));

  const canProceed = () => {
    switch (active) {
      case 0:
        return config.name.trim().length > 0;
      case 2:
        return config.sql.trim().length > 0;
      case 4:
        return config.targetConnection.length > 0;
      default:
        return true;
    }
  };

  return (
    <Container size="lg" py="xl" style={{ minHeight: '100vh' }}>
      <Title order={2} mb="lg">
        {t('workflow.create_new', 'Create New Workflow')}
      </Title>

      {/* 固定 Stepper 在顶部 */}
      <Paper withBorder p="md" mb="lg" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <Stepper active={active} onStepClick={setActive}>
          <Stepper.Step label="基本信息" description="名称和描述" />
          <Stepper.Step label="选择模板" description="工作流类型" />
          <Stepper.Step label="数据源" description="连接和 SQL" />
          <Stepper.Step label="转换" description="方言配置" />
          <Stepper.Step label="目标" description="目标连接" />
          <Stepper.Step label="确认" description="创建" />
        </Stepper>
      </Paper>

      {/* 可滚动的内容区域 */}
      <Paper withBorder p="md" style={{ minHeight: 400, overflow: 'visible' }}>
        {active === 0 && (
          <Stack>
            <TextInput
              label={t('workflow.name', '工作流名称')}
              placeholder="MySQL → PostgreSQL 数据同步"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              required
            />
            <Textarea
              label={t('workflow.description', '描述')}
              placeholder="描述这个工作流的功能..."
              value={config.description}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              minRows={3}
            />
            <TagsInput
              label={t('workflow.tags', '标签')}
              placeholder="输入标签后按回车"
              value={config.tags}
              onChange={(tags) => setConfig({ ...config, tags })}
            />
          </Stack>
        )}

        {active === 1 && (
          <Stack>
            <Select
              label="工作流模板"
              value={config.template}
              onChange={(v) => setConfig({ ...config, template: v || 'custom' })}
              data={TEMPLATES}
            />
            <Paper withBorder p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
              <Text size="sm">
                {config.template === 'sql_sync' && 'SQL 数据同步：从源数据库读取 SQL，转换方言后执行到目标数据库'}
                {config.template === 'backup' && '数据备份：定期导出数据库表到文件'}
                {config.template === 'etl' && 'ETL 管道：提取-转换-加载数据'}
                {config.template === 'custom' && '自定义：完全自定义工作流步骤'}
              </Text>
            </Paper>
          </Stack>
        )}

        {active === 2 && (
          <Stack gap="lg">
            <ConnectionSelector
              value={config.sourceConnection}
              onChange={(v) => setConfig({ ...config, sourceConnection: v })}
              label="源数据库连接"
            />
            <Select
              label="源数据库方言"
              value={config.sourceDialect}
              onChange={(v) => setConfig({ ...config, sourceDialect: v || 'mysql' })}
              data={[
                { value: 'mysql', label: 'MySQL' },
                { value: 'postgresql', label: 'PostgreSQL' },
                { value: 'sqlite', label: 'SQLite' },
              ]}
            />
            <SqlEditor
              label="SQL 查询"
              value={config.sql}
              onChange={(sql) => setConfig({ ...config, sql })}
              dialect={config.sourceDialect}
              minHeight={200}
              maxHeight={500}
            />
            <Text size="xs" c="dimmed">
              提示：可以直接输入 SQL，也可以点击文件夹图标从磁盘选择 .sql 文件
            </Text>
          </Stack>
        )}

        {active === 3 && (
          <Stack gap="lg">
            <Group grow>
              <Select
                label="源方言"
                value={config.sourceDialect}
                onChange={(v) => setConfig({ ...config, sourceDialect: v || 'mysql' })}
                data={[
                  { value: 'mysql', label: 'MySQL' },
                  { value: 'postgresql', label: 'PostgreSQL' },
                ]}
              />
              <Select
                label="目标方言"
                value={config.targetDialect}
                onChange={(v) => setConfig({ ...config, targetDialect: v || 'postgresql' })}
                data={[
                  { value: 'mysql', label: 'MySQL' },
                  { value: 'postgresql', label: 'PostgreSQL' },
                ]}
              />
            </Group>
            <CustomRulesEditor
              rules={config.customRules}
              onChange={(rules) => setConfig({ ...config, customRules: rules })}
            />
            <TransformPreview
              sql={config.sql}
              sourceDialect={config.sourceDialect}
              targetDialect={config.targetDialect}
              customRules={config.customRules}
            />
          </Stack>
        )}

        {active === 4 && (
          <Stack gap="lg">
            <ConnectionSelector
              value={config.targetConnection}
              onChange={(v) => setConfig({ ...config, targetConnection: v })}
              label="目标数据库连接"
            />
            <Select
              label="目标方言"
              value={config.targetDialect}
              onChange={(v) => setConfig({ ...config, targetDialect: v || 'postgresql' })}
              data={[
                { value: 'mysql', label: 'MySQL' },
                { value: 'postgresql', label: 'PostgreSQL' },
                { value: 'sqlite', label: 'SQLite' },
              ]}
            />
          </Stack>
        )}

        {active === 5 && (
          <Stack>
            <Title order={4}>确认工作流配置</Title>
            <Paper withBorder p="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text c="dimmed">名称:</Text>
                  <Text fw={500}>{config.name || '(未命名)'}</Text>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed">模板:</Text>
                  <Text>{TEMPLATES.find((tpl) => tpl.value === config.template)?.label}</Text>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed">源连接:</Text>
                  <Text>{config.sourceConnection || '(未选择)'}</Text>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed">目标连接:</Text>
                  <Text>{config.targetConnection || '(未选择)'}</Text>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed">转换:</Text>
                  <Text>{config.sourceDialect} → {config.targetDialect}</Text>
                </Group>
                <Group justify="space-between">
                  <Text c="dimmed">自定义规则:</Text>
                  <Text>{config.customRules.filter((r) => r.enabled).length} 条</Text>
                </Group>
              </Stack>
            </Paper>
            <Paper withBorder p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
              <Text size="xs" c="dimmed" mb={4}>SQL 预览:</Text>
              <pre style={{ fontSize: 12, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 100, overflow: 'auto' }}>
                {config.sql.slice(0, 500)}
                {config.sql.length > 500 ? '...' : ''}
              </pre>
            </Paper>
          </Stack>
        )}
      </Paper>

      {/* 固定在底部的按钮 */}
      <Paper withBorder p="md" mt="lg" style={{ position: 'sticky', bottom: 0, backgroundColor: 'var(--mantine-color-body)' }}>
        <Group justify="space-between">
          <Button variant="default" onClick={prevStep} disabled={active === 0}>
            ← 上一步
          </Button>
          <Text size="sm" c="dimmed">
            步骤 {active + 1} / 6
          </Text>
          {active < 5 ? (
            <Button onClick={nextStep} disabled={!canProceed()}>
              下一步 →
            </Button>
          ) : (
            <Button onClick={handleCreate} loading={loading} color="green">
              ✓ 创建工作流
            </Button>
          )}
        </Group>
      </Paper>
    </Container>
  );
}
