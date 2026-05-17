import { Alert, Card, Code, Stack, Text, Title } from '@mantine/core';

export function TelegramPage() {
  return (
    <Stack gap="md">
      <Card withBorder radius="sm" padding="lg">
        <Stack gap="xs">
          <Title order={4}>Telegram webhook</Title>
          <Text c="dimmed">
            Point your bot webhook at:
          </Text>
          <Code block>/api/telegram/webhook</Code>
          <Text c="dimmed">
            ClawPing handles <Code>/start</Code>, <Code>/status</Code>, <Code>/checks</Code>, <Code>/mute</Code>, and <Code>/test</Code>.
          </Text>
        </Stack>
      </Card>

      <Alert color="blue" title="Recommended setup flow">
        1. Create a Telegram bot with BotFather.
        <br />
        2. Set <Code>TELEGRAM_BOT_TOKEN</Code> and <Code>TELEGRAM_WEBHOOK_SECRET</Code>.
        <br />
        3. Configure Telegram to call ClawPing&apos;s webhook URL.
        <br />
        4. Send <Code>/start</Code> from the chat you want alerts in.
      </Alert>
    </Stack>
  );
}
