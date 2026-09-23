import { useState } from 'react';
import {
  Stack,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Paper,
  Alert,
  Text,
  Switch,
  Divider,
} from '@mantine/core';
import { IconCheck, IconAlertCircle, IconSend } from '@tabler/icons-react';
import { api } from '../../api/client';
import type { NotifyConfig } from '../../api/types';

interface NotificationFormProps {
  initialConfig?: NotifyConfig;
  onSave?: (config: NotifyConfig) => void;
}

const WEBHOOK_TEMPLATES = [
  { label: '企业微信', value: 'wechat_webhook', url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY' },
  { label: '钉钉', value: 'dingtalk', url: 'https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN' },
  { label: '飞书', value: 'feishu', url: 'https://open.feishu.cn/open-apis/bot/v2/hook/YOUR_WEBHOOK_ID' },
];

const MESSAGE_TEMPLATES = [
  { label: '执行完成', message: '✅ 工作流 {{workflowName}} 执行完成\n状态: {{status}}\n耗时: {{duration}}ms' },
  { label: '执行失败', message: '❌ 工作流 {{workflowName}} 执行失败\n错误: {{error}}' },
  { label: '详细报告', message: '📊 工作流报告\n名称: {{workflowName}}\n状态: {{status}}\n执行ID: {{executionId}}\n开始: {{startedAt}}\n结束: {{finishedAt}}' },
];

export function NotificationForm({ initialConfig, onSave }: NotificationFormProps) {
  const [form, setForm] = useState<NotifyConfig>(initialConfig || {
    type: 'webhook',
    webhookUrl: '',
    message: MESSAGE_TEMPLATES[0].message,
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [advanced, setAdvanced] = useState(false);

  const handleTest = async () => {
    if (!form.webhookUrl) {
      setTestResult({ success: false, message: '请输入 Webhook URL' });
      return;
    }
    try {
      setTesting(true);
      setTestResult(null);
      const result = await api.testNotification(form);
      setTestResult({ success: result.success, message: result.error });
    } catch (err) {
      setTestResult({ success: false, message: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave?.(form);
  };

  const applyTemplate = (url: string, type: string) => {
    setForm({ ...form, webhookUrl: url, type });
  };

  const applyMessageTemplate = (message: string) => {
    setForm({ ...form, message });
  };

  return (
    <Stack gap="md">
      <Select
        label="通知类型"
        value={form.type}
        onChange={(v) => setForm({ ...form, type: v || 'webhook' })}
        data={[
          { value: 'webhook', label: '通用 Webhook' },
          { value: 'wechat_webhook', label: '企业微信 Webhook' },
          { value: 'dingtalk', label: '钉钉 Webhook' },
          { value: 'feishu', label: '飞书 Webhook' },
          { value: 'email', label: '邮件通知' },
        ]}
      />

      <Paper withBorder p="xs" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
        <Text size="xs" fw={500} mb={4}>
          快速模板
        </Text>
        <Group gap="xs">
          {WEBHOOK_TEMPLATES.map((tpl) => (
            <Button
              key={tpl.value}
              size="xs"
              variant="default"
                            onClick={() => applyTemplate(tpl.url, tpl.value)}
            >
              {tpl.label}
            </Button>
          ))}
        </Group>
      </Paper>

      <TextInput
        label="Webhook URL"
        placeholder="https://..."
        value={form.webhookUrl}
        onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
        required
      />

      <Paper withBorder p="xs" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
        <Text size="xs" fw={500} mb={4}>
          消息模板
        </Text>
        <Group gap="xs">
          {MESSAGE_TEMPLATES.map((tpl) => (
            <Button
              key={tpl.label}
              size="xs"
              variant="default"
                            onClick={() => applyMessageTemplate(tpl.message)}
            >
              {tpl.label}
            </Button>
          ))}
        </Group>
      </Paper>

      <Textarea
        label="消息模板内容"
        description="支持变量: {{workflowName}}, {{status}}, {{executionId}}, {{duration}}, {{error}}, {{startedAt}}, {{finishedAt}}"
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        minRows={4}
      />

      <Switch
        label="显示高级选项"
        checked={advanced}
        onChange={(e) => setAdvanced(e.target.checked)}
        size="sm"
      />

      {advanced && (
        <Paper withBorder p="sm">
          <Stack gap="xs">
            <TextInput
              size="xs"
              label="HTTP Headers"
              placeholder='{"Authorization": "Bearer token"}'
              value={(form as any).headers || ''}
              onChange={(e) => setForm({ ...form, ...{ headers: e.target.value } })}
            />
            <TextInput
              size="xs"
              label="重试次数"
              type="number"
              value={String((form as any).retryCount || 3)}
              onChange={(e) => setForm({ ...form, ...{ retryCount: Number(e.target.value) } })}
            />
            <TextInput
              size="xs"
              label="超时 (ms)"
              type="number"
              value={String((form as any).timeout || 5000)}
              onChange={(e) => setForm({ ...form, ...{ timeout: Number(e.target.value) } })}
            />
          </Stack>
        </Paper>
      )}

      <Group>
        <Button variant="outline" onClick={handleTest} loading={testing} leftSection={<IconSend size={14} />}>
          发送测试通知
        </Button>
        <Button onClick={handleSave}>保存配置</Button>
      </Group>

      {testResult?.success && (
        <Alert icon={<IconCheck size={16} />} color="green">
          测试通知发送成功！请检查您的消息客户端。
        </Alert>
      )}

      {testResult && !testResult.success && (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          测试失败: {testResult.message}
        </Alert>
      )}

      <Divider />

      <Paper withBorder p="sm">
        <Text size="xs" c="dimmed">
          <strong>提示：</strong>企业微信、钉钉和飞书的 Webhook 机器人需要在各自的管理后台创建。
          详细配置方法请参考各平台的开发者文档。
        </Text>
      </Paper>
    </Stack>
  );
}
