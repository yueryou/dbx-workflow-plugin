import { Link, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Container, Title, Tabs } from '@mantine/core';

export function SettingsPage() {
  const { t } = useTranslation();
  const location = useLocation();

  const activeTab = location.pathname.includes('/connections') ? 'connections' : 'notifications';

  return (
    <Container size="xl" py="xl">
      <Title order={2} mb="lg">{t('nav.settings', 'Settings')}</Title>

      <Tabs value={activeTab} mb="lg">
        <Tabs.List>
          <Tabs.Tab value="connections">
            <Link to="/settings/connections" style={{ color: 'inherit', textDecoration: 'none' }}>
              {t('settings.connections', '数据库连接')}
            </Link>
          </Tabs.Tab>
          <Tabs.Tab value="notifications">
            <Link to="/settings/notifications" style={{ color: 'inherit', textDecoration: 'none' }}>
              {t('settings.notifications', '通知配置')}
            </Link>
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Outlet />
    </Container>
  );
}
