import { Paper, Text, Center } from '@mantine/core';

interface PlaceholderProps {
  message: string;
}

export function Placeholder({ message }: PlaceholderProps) {
  return (
    <Center p="xl">
      <Paper shadow="xs" p="lg" radius="md" withBorder>
        <Text c="dimmed" size="sm">
          {message}
        </Text>
      </Paper>
    </Center>
  );
}
