import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';
import '@mantine/core/styles.css';
import './i18n';
import { theme } from './theme';
import App from './App';

async function bootstrap() {
  // Wait for DBX bridge to be ready
  if (window.dbxPlugin?.ready) {
    await window.dbxPlugin.ready;
  }

  const root = createRoot(document.getElementById('root')!);
  root.render(
    <StrictMode>
      <ColorSchemeScript defaultColorScheme="auto" />
      <MantineProvider theme={theme} defaultColorScheme="auto">
        <App />
      </MantineProvider>
    </StrictMode>
  );
}

bootstrap();
