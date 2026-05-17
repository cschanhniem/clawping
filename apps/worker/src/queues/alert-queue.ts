import type { Env } from '../index';
import { isAccountMuted, telegramApi } from '../util';

export interface AlertQueueMessage {
  chatId: string;
  text: string;
}

export async function processAlertBatch(batch: MessageBatch<AlertQueueMessage>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      if (await isAccountMuted(env)) {
        message.ack();
        continue;
      }
      await telegramApi(env, 'sendMessage', {
        chat_id: message.body.chatId,
        text: message.body.text,
      });
      message.ack();
    } catch (error) {
      console.error('Alert delivery failed', error);
      message.retry({ delaySeconds: 300 });
    }
  }
}
