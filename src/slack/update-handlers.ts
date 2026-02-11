// Event-driven ingestion handler for Slack skill

export async function onServerEvent(event: string, payload: unknown): Promise<void> {
  if (event !== 'slack') {
    return;
  }

  const envelope = payload as Record<string, unknown> | null;
  if (!envelope || typeof envelope !== 'object') {
    return;
  }

  // Events API: { type: 'event_callback', event: { type: 'message', channel, user, ts, text, ... } }
  // Socket Mode: similar envelope
  const eventPayload = envelope.event as Record<string, unknown> | undefined;
  if (!eventPayload || typeof eventPayload !== 'object') {
    return;
  }

  const eventType = eventPayload.type as string | undefined;
  if (eventType !== 'message' && eventType !== 'app_mention') {
    return;
  }

  const channelId = eventPayload.channel as string | undefined;
  const ts = eventPayload.ts as string | undefined;
  if (!channelId || !ts) {
    return;
  }

  const userId = eventPayload.user as string | undefined;
  const getDisplayText = (globalThis as Record<string, unknown>).getMessageDisplayText as
    | ((m: Record<string, unknown>) => string)
    | undefined;
  const displayText =
    typeof getDisplayText === 'function'
      ? getDisplayText(eventPayload)
      : ((eventPayload.text as string) ?? '');
  const type = (eventPayload.type as string) ?? 'message';
  const subtype = eventPayload.subtype as string | undefined;
  const threadTs = eventPayload.thread_ts as string | undefined;
  const createdAt = new Date().toISOString();
  const blocksJson = eventPayload.blocks ? JSON.stringify(eventPayload.blocks) : null;
  const attachmentsJson = eventPayload.attachments
    ? JSON.stringify(eventPayload.attachments)
    : null;

  try {
    globalThis.slackDb.insertMessage(
      channelId,
      userId ?? null,
      ts,
      displayText,
      type,
      subtype ?? null,
      eventType,
      threadTs ?? null,
      createdAt,
      blocksJson,
      attachmentsJson
    );
    state.setPartial({ last_event_at: createdAt });
  } catch (e) {
    console.error('[slack] Failed to store event:', e);
  }
}

declare global {
  var slackUpdateHandlers: { onServerEvent: typeof onServerEvent };
}
globalThis.slackUpdateHandlers = { onServerEvent };
