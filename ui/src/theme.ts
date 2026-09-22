import { createTheme, MantineThemeOverride } from '@mantine/core';

export const theme: MantineThemeOverride = createTheme({
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  primaryColor: 'violet',
  defaultRadius: 'md',
  components: {
    Button: {
      defaultProps: { size: 'sm' },
    },
  },
});
