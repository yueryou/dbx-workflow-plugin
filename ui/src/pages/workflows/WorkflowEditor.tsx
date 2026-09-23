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
  ActionIcon,
  Tabs,
  Alert,
} from '@mantine/core';
import { IconArrowLeft, IconDeviceFloppy, IconAlertCircle } from '@tabler/icons-react';
import { api } from '../../api/client';
import type { Workflow, WorkflowNode } from '../../api/types';
import { NodeConfigPanel } from '../../components/workflow/NodeConfigPanel';

export function WorkflowEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'nodes' | 'json'>('nodes');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadWorkflow(id);
  }, [id]);

  const loadWorkflow = async (workflowId: string) => {
    try {
      setLoading(true);
      const data = await api.getWorkflow(workflowId);
      setWorkflow(data);
      setJsonText(JSON.stringify(data, null, 2));
      if (data.nodes.length > 0) {
        setSelectedNodeId(data.nodes[0].id);
      }
    } catch (err) {
      console.error('Failed to load workflow:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!workflow) return;
    try {
      setSaving(true);
      await api.updateWorkflow(workflow.id, {
        name: workflow.name,
        description: workflow.description,
        tags: workflow.tags,
        nodes: workflow.nodes,
        edges: workflow.edges,
      });
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      console.error('Failed to save workflow:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleJsonSave = async () => {
    if (!workflow) return;
    try {
      const parsed = JSON.parse(jsonText);
      setJsonError(null);
      setSaving(true);
      await api.updateWorkflow(workflow.id, {
        name: parsed.name,
        description: parsed.description,
        tags: parsed.tags,
        nodes: parsed.nodes,
        edges: parsed.edges,
      });
      navigate(`/workflows/${workflow.id}`);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setJsonError('JSON 语法错误: ' + err.message);
      } else {
        console.error('Failed to save workflow:', err);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleNodeChange = (updatedNode: WorkflowNode) => {
    if (!workflow) return;
    const newNodes = workflow.nodes.map((n) =>
      n.id === updatedNode.id ? updatedNode : n
    );
    setWorkflow({ ...workflow, nodes: newNodes });
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!workflow) return;
    // Don't allow deleting start/end nodes
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node || node.node_type === 'start' || node.node_type === 'end') return;
    const newNodes = workflow.nodes.filter((n) => n.id !== nodeId);
    const newEdges = workflow.edges.filter(
      (e) => e.source_node !== nodeId && e.target_node !== nodeId
    );
    setWorkflow({ ...workflow, nodes: newNodes, edges: newEdges });
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(newNodes.length > 0 ? newNodes[0].id : null);
    }
  };

  const selectedNode = workflow?.nodes.find((n) => n.id === selectedNodeId);
  const upstreamNodes = workflow?.nodes.filter(
    (n) => n.id !== selectedNodeId && selectedNodeId &&
    workflow.edges.some((e) => e.source_node === n.id && e.target_node === selectedNodeId)
  ) || [];

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
          <ActionIcon component={Link} to={id ? `/workflows/${id}` : '/workflows'} variant="subtle">
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>
            {t('workflow.edit', '编辑')}: {workflow.name}
          </Title>
        </Group>
        <Group>
          <Button variant="default" onClick={() => setActiveTab(activeTab === 'nodes' ? 'json' : 'nodes')}>
            {activeTab === 'nodes' ? 'JSON 视图' : '表单视图'}
          </Button>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={activeTab === 'nodes' ? handleSave : handleJsonSave}
            loading={saving}
          >
            {t('common.save', '保存')}
          </Button>
        </Group>
      </Group>

      {activeTab === 'json' ? (
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="sm">
            {t('workflow.json_editor_hint', '以 JSON 格式编辑工作流定义。节点和边将在保存时验证。')}
          </Text>
          {jsonError && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" mb="sm">
              {jsonError}
            </Alert>
          )}
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setJsonError(null);
            }}
            style={{
              width: '100%',
              minHeight: 500,
              fontFamily: 'monospace',
              fontSize: 13,
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--mantine-color-default-border)',
              resize: 'vertical',
            }}
          />
        </Paper>
      ) : (
        <Group align="flex-start" grow={false}>
          {/* 左侧节点列表 */}
          <Paper withBorder style={{ width: 320, flexShrink: 0 }}>
            <Tabs value="nodes" p="xs">
              <Tabs.List grow>
                <Tabs.Tab value="nodes" size="xs">节点 ({workflow.nodes.length})</Tabs.Tab>
              </Tabs.List>
            </Tabs>
            <Stack gap={0} p="xs" style={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
              {workflow.nodes.map((node, idx) => (
                <Button
                  key={node.id}
                  variant={selectedNodeId === node.id ? 'light' : 'subtle'}
                  size="sm"
                  fullWidth
                  justify="flex-start"
                  mb={4}
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{ textTransform: 'none', height: 'auto', padding: '8px 10px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 24,
                      height: 24,
                      borderRadius: 4,
                      backgroundColor: selectedNodeId === node.id ? 'var(--mantine-color-blue-1)' : 'var(--mantine-color-gray-1)',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <Text size="sm" truncate="end" fw={500} style={{ lineHeight: 1.2 }}>
                        {node.name}
                      </Text>
                      <Text size="xs" c="dimmed" truncate="end">
                        {node.node_type}
                      </Text>
                    </div>
                  </div>
                </Button>
              ))}
            </Stack>
          </Paper>

          {/* 右侧配置面板 */}
          <div style={{ flex: 1, minWidth: 400 }}>
            {selectedNode ? (
              <NodeConfigPanel
                node={selectedNode}
                upstreamNodes={upstreamNodes}
                onChange={handleNodeChange}
                onDelete={() => handleDeleteNode(selectedNode.id)}
              />
            ) : (
              <Paper withBorder p="md">
                <Text ta="center" c="dimmed">选择一个节点进行配置</Text>
              </Paper>
            )}
          </div>
        </Group>
      )}
    </Container>
  );
}
