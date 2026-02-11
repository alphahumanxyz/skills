// Telegram Media API — raw TDLib wrappers for sending media and sticker operations.
import type TdLibClient from '../tdlib-client';
import type { TdMessage } from '../types';

/**
 * Send a photo by remote URL.
 */
export async function sendPhoto(
  client: TdLibClient,
  chatId: number,
  url: string,
  caption?: string,
  replyToMessageId?: number
): Promise<TdMessage> {
  const request: { '@type': string; [key: string]: unknown } = {
    '@type': 'sendMessage',
    chat_id: chatId,
    input_message_content: {
      '@type': 'inputMessagePhoto',
      photo: { '@type': 'inputFileRemote', id: url },
      caption: caption ? { '@type': 'formattedText', text: caption } : undefined,
    },
  };

  if (replyToMessageId) {
    request.reply_to = { '@type': 'inputMessageReplyToMessage', message_id: replyToMessageId };
  }

  const response = await client.send(request);
  return response as unknown as TdMessage;
}

/**
 * Send a document/file by remote URL.
 */
export async function sendDocument(
  client: TdLibClient,
  chatId: number,
  url: string,
  caption?: string,
  replyToMessageId?: number
): Promise<TdMessage> {
  const request: { '@type': string; [key: string]: unknown } = {
    '@type': 'sendMessage',
    chat_id: chatId,
    input_message_content: {
      '@type': 'inputMessageDocument',
      document: { '@type': 'inputFileRemote', id: url },
      caption: caption ? { '@type': 'formattedText', text: caption } : undefined,
    },
  };

  if (replyToMessageId) {
    request.reply_to = { '@type': 'inputMessageReplyToMessage', message_id: replyToMessageId };
  }

  const response = await client.send(request);
  return response as unknown as TdMessage;
}

/**
 * Send a sticker by file ID.
 */
export async function sendSticker(
  client: TdLibClient,
  chatId: number,
  stickerId: string,
  replyToMessageId?: number
): Promise<TdMessage> {
  const request: { '@type': string; [key: string]: unknown } = {
    '@type': 'sendMessage',
    chat_id: chatId,
    input_message_content: {
      '@type': 'inputMessageSticker',
      sticker: { '@type': 'inputFileRemote', id: stickerId },
    },
  };

  if (replyToMessageId) {
    request.reply_to = { '@type': 'inputMessageReplyToMessage', message_id: replyToMessageId };
  }

  const response = await client.send(request);
  return response as unknown as TdMessage;
}

/**
 * Send an animation/GIF by remote URL or file ID.
 */
export async function sendAnimation(
  client: TdLibClient,
  chatId: number,
  url: string,
  caption?: string,
  replyToMessageId?: number
): Promise<TdMessage> {
  const request: { '@type': string; [key: string]: unknown } = {
    '@type': 'sendMessage',
    chat_id: chatId,
    input_message_content: {
      '@type': 'inputMessageAnimation',
      animation: { '@type': 'inputFileRemote', id: url },
      caption: caption ? { '@type': 'formattedText', text: caption } : undefined,
    },
  };

  if (replyToMessageId) {
    request.reply_to = { '@type': 'inputMessageReplyToMessage', message_id: replyToMessageId };
  }

  const response = await client.send(request);
  return response as unknown as TdMessage;
}

/**
 * Search for stickers by emoji or keyword.
 * TDLib method: searchStickers sticker_type:StickerType emojis:string query:string input_language_codes:vector<string> offset:int32 limit:int32 = Stickers
 */
export async function searchStickers(
  client: TdLibClient,
  query: string,
  limit: number = 20
): Promise<{ stickers?: Record<string, unknown>[] }> {
  try {
    const response = await client.send({
      '@type': 'searchStickers',
      sticker_type: { '@type': 'stickerTypeRegular' },
      emojis: query,
      query: '',
      input_language_codes: [],
      offset: 0,
      limit,
    });
    return response as { stickers?: Record<string, unknown>[] };
  } catch {
    return { stickers: [] };
  }
}

/**
 * Get a sticker set by ID.
 */
export async function getStickerSet(
  client: TdLibClient,
  setId: string
): Promise<Record<string, unknown> | null> {
  try {
    const response = await client.send({ '@type': 'getStickerSet', set_id: parseInt(setId, 10) });
    return response as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}
