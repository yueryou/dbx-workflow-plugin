import { useEffect, useRef, useState } from 'react';
import { Stack, Text, Group, ActionIcon, Menu, FileButton, Tooltip } from '@mantine/core';
import { IconCopy, IconCheck, IconEraser, IconFile, IconFolder } from '@tabler/icons-react';
import { useClipboard } from '@mantine/hooks';

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  dialect?: string;
  minHeight?: number;
  maxHeight?: number;
  readOnly?: boolean;
}

const SQL_TEMPLATES = [
  { label: 'SELECT 查询', sql: 'SELECT * FROM table_name WHERE condition = value;' },
  { label: 'SELECT + JOIN', sql: 'SELECT a.*, b.name \nFROM table_a a\nJOIN table_b b ON a.id = b.a_id\nWHERE a.status = 1;' },
  { label: 'INSERT', sql: 'INSERT INTO table_name (col1, col2, col3)\nVALUES (val1, val2, val3);' },
  { label: 'UPDATE', sql: 'UPDATE table_name\nSET col1 = new_value\nWHERE condition = value;' },
  { label: 'CREATE TABLE (MySQL)', sql: 'CREATE TABLE users (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  email VARCHAR(255) UNIQUE,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;' },
];

export function SqlEditor({
  value,
  onChange,
  label = 'SQL',
  dialect = 'sql',
  minHeight = 150,
  maxHeight = 400,
  readOnly = false,
}: SqlEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const clipboard = useClipboard({ timeout: 1000 });
  const [lineCount, setLineCount] = useState(1);

  // Update line count when value changes
  useEffect(() => {
    setLineCount(value.split('\n').length);
  }, [value]);

  // Sync scroll between line numbers and textarea
  const handleScroll = () => {
    const textarea = textareaRef.current;
    const lineNumbers = document.getElementById(`${label}-line-numbers`);
    if (textarea && lineNumbers) {
      lineNumbers.scrollTop = textarea.scrollTop;
    }
  };

  const handleTemplateInsert = (sql: string) => {
    onChange(sql);
  };

  const formatSql = () => {
    // Simple SQL formatting
    let formatted = value
      .replace(/\s+/g, ' ')
      .replace(/\s*(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|ORDER BY|GROUP BY|HAVING|LIMIT|OFFSET|SET|VALUES|AND|OR)\s+/gi, '\n$1 ')
      .replace(/\s*(INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\s+/gi, '\n$1 ')
      .trim();
    onChange(formatted);
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onChange(content);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {label}
          {dialect && (
            <Text span c="dimmed" size="xs" ml={8}>
              ({dialect})
            </Text>
          )}
        </Text>
        <Group gap={4}>
          {/* 文件选择按钮 */}
          <FileButton onChange={handleFileSelect} accept=".sql,.txt">
            {(props) => (
              <Tooltip label="从文件加载 SQL">
                <ActionIcon {...props} variant="subtle" size="sm">
                  <IconFolder size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </FileButton>
          <Menu position="bottom-end">
            <Menu.Target>
              <Tooltip label="插入模板">
                <ActionIcon variant="subtle" size="sm">
                  <IconFile size={14} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              {SQL_TEMPLATES.map((tpl) => (
                <Menu.Item key={tpl.label} onClick={() => handleTemplateInsert(tpl.sql)}>
                  {tpl.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <Tooltip label="格式化">
            <ActionIcon variant="subtle" size="sm" onClick={formatSql}>
              <IconEraser size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={clipboard.copied ? '已复制' : '复制'}>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => clipboard.copy(value)}
            >
              {clipboard.copied ? <IconCheck size={14} color="green" /> : <IconCopy size={14} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <div
        style={{
          display: 'flex',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 8,
          overflow: 'hidden',
          maxHeight,
        }}
      >
        {/* Line numbers */}
        <div
          id={`${label}-line-numbers`}
          style={{
            width: 40,
            backgroundColor: 'var(--mantine-color-gray-0)',
            borderRight: '1px solid var(--mantine-color-default-border)',
            padding: '8px 4px',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <Text key={i} size="xs" c="dimmed" ta="right" style={{ lineHeight: '20px', fontFamily: 'monospace', fontSize: 12 }}>
              {i + 1}
            </Text>
          ))}
        </div>
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          readOnly={readOnly}
          spellCheck={false}
          style={{
            flex: 1,
            minHeight,
            maxHeight: maxHeight - 2,
            fontFamily: 'monospace',
            fontSize: 13,
            lineHeight: '20px',
            padding: '8px 12px',
            border: 'none',
            outline: 'none',
            resize: 'none',
            backgroundColor: readOnly ? 'var(--mantine-color-gray-0)' : 'transparent',
            overflow: 'auto',
          }}
        />
      </div>
    </Stack>
  );
}
