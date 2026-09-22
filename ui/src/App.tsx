import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { WorkflowList } from './components/WorkflowList';
import { Placeholder } from './components/Placeholder';

export default function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('workflows');

  const renderContent = () => {
    switch (activeTab) {
      case 'workflows':
        return <WorkflowList />;
      case 'executions':
        return <Placeholder message={t('execution.empty')} />;
      case 'settings':
        return <Placeholder message={t('nav.settings')} />;
      default:
        return null;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}
