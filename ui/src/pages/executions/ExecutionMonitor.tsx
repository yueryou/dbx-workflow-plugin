import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Title, Group, ActionIcon, Text, Stack } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { api } from '../../api/client';
import type { Workflow, ExecutionLogs } from '../../api/types';
import { useExecutionStore } from '../../store/useExecutionStore';
import { ExecutionGraph } from '../../components/execution/ExecutionGraph';
import { LogStream } from '../../components/execution/LogStream';
import { ProgressBar } from '../../components/execution/ProgressBar';

export function ExecutionMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);

  // Store 状态
  const {
    nodeStatuses,
    logs,
    polling,
    activeExecutionId,
    current,
    loadExecutionProgress,
    startPolling,
    stopPolling,
  } = useExecutionStore();

  // 加载工作流定义
  useEffect(() => {
    if (!id) return;

    const loadWorkflow = async () => {
      try {
        setLoading(true);
        // 先获取执行日志以获取 workflowId
        const execLogs = await api.getExecutionLogs(id);
        // 再获取工作流定义
        const wf = await api.getWorkflow(execLogs.workflowId);
        setWorkflow(wf);

        // 加载执行进度
        await loadExecutionProgress(id);

        // 如果还在运行中，开始轮询
        if (['running', 'pending'].includes(execLogs.status)) {
          startPolling(id);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadWorkflow();

    return () => {
      stopPolling();
    };
  }, [id]);

  const handleNodeClick = useCallback((_nodeId: string) => {
    // 节点点击处理
  }, []);

  const handleNodeFilter = useCallback((_nodeId: string | null) => {
    // 日志筛选处理
  }, []);

  if (loading) {
    return (
      <Container py="xl">
        <Text ta="center">加载中...</Text>
      </Container>
    );
  }

  if (!workflow) {
    return (
      <Container py="xl">
        <Text ta="center">执行记录不存在</Text>
      </Container>
    );
  }

  // 计算统计数据
  const totalNodes = workflow.nodes.length;
  const completedNodes = Object.values(nodeStatuses).filter((s) => s.status === 'completed').length;
  const runningNodes = Object.values(nodeStatuses).filter((s) => s.status === 'running').length;
  const failedNodes = Object.values(nodeStatuses).filter((s) => s.status === 'failed').length;

  // 计算耗时
  const execData = current as ExecutionLogs | null;
  const startTime = execData?.startedAt ? new Date(execData.startedAt).getTime() : 0;
  const endTime = execData?.finishedAt ? new Date(execData.finishedAt).getTime() : Date.now();
  const durationMs = endTime - startTime;

  return (
    <Container size="xl" py="xl">
      <Group mb="lg">
        <ActionIcon component={Link} to="/executions" variant="subtle">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={2}>执行监控</Title>
        {polling && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'var(--mantine-color-green-6)',
              display: 'inline-block',
            }}
            title="实时跟踪中"
          />
        )}
      </Group>

      <Stack gap="lg">
        {/* 进度条 */}
        <ProgressBar
          totalNodes={totalNodes}
          completedNodes={completedNodes}
          runningNodes={runningNodes}
          failedNodes={failedNodes}
          durationMs={durationMs}
          status={current?.status || 'pending'}
        />

        {/* DAG 图谱 */}
        <ExecutionGraph
          workflow={workflow}
          nodeStatuses={nodeStatuses}
          selectedNodeId={activeExecutionId}
          onNodeClick={handleNodeClick}
        />

        {/* 实时日志 */}
        <LogStream
          logs={logs}
          selectedNodeId={null}
          onNodeFilter={handleNodeFilter}
        />
      </Stack>
    </Container>
  );
}
