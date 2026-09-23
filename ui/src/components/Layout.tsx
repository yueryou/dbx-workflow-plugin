import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  AppShell,
  Group,
  Text,
  NavLink,
  Stack,
  Badge,
} from '@mantine/core';
import { IconFileCode, IconHistory, IconSettings } from '@tabler/icons-react';
import { api } from '../api/client';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const location = useLocation();

  // Determine active nav from current path
  const getActiveNav = () => {
    const path = location.pathname;
    if (path.startsWith('/executions')) return 'executions';
    if (path.startsWith('/settings')) return 'settings';
    return 'workflows';
  };

  const activeNav = getActiveNav();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700} size="lg">
            {t('common.appName', 'Workflow Manage')}
          </Text>
          {api.isMockMode && (
            <Badge color="orange" variant="filled" size="sm">
              DEMO MODE
            </Badge>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <Stack gap="xs">
          <NavLink
            active={activeNav === 'workflows'}
            label={t('nav.workflows', 'Workflows')}
            leftSection={<IconFileCode size={16} />}
            component={Link}
            to="/workflows"
          />
          <NavLink
            active={activeNav === 'executions'}
            label={t('nav.executions', 'Executions')}
            leftSection={<IconHistory size={16} />}
            component={Link}
            to="/executions"
          />
          <NavLink
            active={activeNav === 'settings'}
            label={t('nav.settings', 'Settings')}
            leftSection={<IconSettings size={16} />}
            component={Link}
            to="/settings/connections"
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
