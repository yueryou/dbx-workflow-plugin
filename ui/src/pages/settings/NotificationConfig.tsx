import { Paper, Title, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { NotificationForm } from '../../components/settings/NotificationForm';
import type { NotifyConfig } from '../../api/types';

export function NotificationConfigPage() {
  const { t } = useTranslation();

  const handleSave = (config: NotifyConfig) => {
    // In a real app, this would persist to backend/localStorage
    localStorage.setItem('notification_config', JSON.stringify(config));
    alert(t('notification.saved', '通知配置已保存'));
  };

  const saved = localStorage.getItem('notification_config');
  const initialConfig = saved ? JSON.parse(saved) : undefined;

  return (
    <div>
      <Title order={3} mb="md">{t('notification.title', '通知配置')}</Title>
      <Text size="sm" c="dimmed" mb="lg">
        {t('notification.description', '配置工作流执行完成后的通知方式')}
      </Text>
      <Paper withBorder p="md">
        <NotificationForm initialConfig={initialConfig} onSave={handleSave} />
      </Paper>
    </div>
  );
}
