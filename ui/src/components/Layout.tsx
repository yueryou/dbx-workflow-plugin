import { useTranslation } from 'react-i18next';
import {
  AppShell,
  Group,
  Text,
  NavLink,
  Stack,
  Container,
} from '@mantine/core';
import { IconFileCode, IconHistory, IconSettings } from '@tabler/icons-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { t } = useTranslation();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700} size="lg">
            {t('common.appName')}
          </Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <Stack gap="xs">
          <NavLink
            active={activeTab === 'workflows'}
            label={t('nav.workflows')}
            leftSection={<IconFileCode size={16} />}
            onClick={() => onTabChange('workflows')}
          />
          <NavLink
            active={activeTab === 'executions'}
            label={t('nav.executions')}
            leftSection={<IconHistory size={16} />}
            onClick={() => onTabChange('executions')}
          />
          <NavLink
            active={activeTab === 'settings'}
            label={t('nav.settings')}
            leftSection={<IconSettings size={16} />}
            onClick={() => onTabChange('settings')}
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Container size="lg" p="md">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
