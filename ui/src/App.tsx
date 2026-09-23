import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';

// Pages
import { WorkflowListPage } from './pages/workflows/WorkflowList';
import { WorkflowCreatorPage } from './pages/workflows/WorkflowCreator';
import { WorkflowDetailPage } from './pages/workflows/WorkflowDetail';
import { WorkflowEditorPage } from './pages/workflows/WorkflowEditor';
import { ExecutionHistoryPage } from './pages/executions/ExecutionHistory';
import { ExecutionDetailPage } from './pages/executions/ExecutionDetail';
import { ExecutionMonitorPage } from './pages/executions/ExecutionMonitor';
import { SettingsPage } from './pages/settings/Settings';
import { ConnectionManagerPage } from './pages/settings/ConnectionManager';
import { NotificationConfigPage } from './pages/settings/NotificationConfig';

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/workflows" replace />} />
          <Route path="/workflows" element={<WorkflowListPage />} />
          <Route path="/workflows/new" element={<WorkflowCreatorPage />} />
          <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
          <Route path="/workflows/:id/edit" element={<WorkflowEditorPage />} />
          <Route path="/executions" element={<ExecutionHistoryPage />} />
          <Route path="/executions/:id" element={<ExecutionDetailPage />} />
          <Route path="/executions/:id/monitor" element={<ExecutionMonitorPage />} />
          <Route path="/settings" element={<SettingsPage />}>
            <Route path="connections" element={<ConnectionManagerPage />} />
            <Route path="notifications" element={<NotificationConfigPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/workflows" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
