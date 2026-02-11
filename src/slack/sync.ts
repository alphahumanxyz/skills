// Sync logic for Slack skill
import { SYNC_MAX_CHANNELS, SYNC_MAX_PAGES_PER_CHANNEL, SYNC_WINDOW_DAYS } from './types';

/** Returns Slack ts string for (now - days). */
function slackTsDaysAgo(days: number): string {
  const sec = Math.floor(Date.now() / 1000) - days * 24 * 3600;
  return `${sec}.000000`;
}

async function performSync(): Promise<void> {
  const s = globalThis.getSlackSkillState();
  if (!s.config.botToken) {
    return;
  }
  if (s.syncInProgress) {
    console.log('[slack] Sync already in progress, skipping');
    return;
  }

  s.syncInProgress = true;
  globalThis.slackPublishState();

  const oldest90Str = slackTsDaysAgo(SYNC_WINDOW_DAYS);
  const now = new Date().toISOString();

  try {
    const seen = new Set<string>();

    const listAllChannels = async (types: string): Promise<void> => {
      try {
        let cursor: string | undefined;
        do {
          const params: Record<string, unknown> = { types, exclude_archived: true, limit: 200 };
          if (cursor) params.cursor = cursor;
          const listResult = await globalThis.slackApi.slackApiFetch(
            'GET',
            '/conversations.list',
            params
          );
          const raw = (listResult.channels as Record<string, unknown>[]) || [];
          for (const ch of raw) {
            const id = ch.id as string;
            if (id) seen.add(id);
          }
          const meta = listResult.response_metadata as { next_cursor?: string } | undefined;
          cursor = meta?.next_cursor;
        } while (cursor && seen.size < SYNC_MAX_CHANNELS);
      } catch (e) {
        if (types.includes('im') || types.includes('mpim')) {
          console.log(
            '[slack] Could not list DMs/group DMs (add OAuth scopes im:read and mpim:read, then reinstall the app).'
          );
        } else {
          console.warn('[slack] conversations.list failed:', e);
        }
      }
    };

    await listAllChannels('public_channel,private_channel');
    await listAllChannels('mpim,im');

    const channelIds = Array.from(seen).slice(0, SYNC_MAX_CHANNELS);

    if (channelIds.length === 0) {
      console.log(
        '[slack] No channels found. Add the bot to channels in Slack, or for DMs/group DMs add OAuth scopes im:read and mpim:read and reinstall the app.'
      );
    }

    let totalStored = 0;
    let loggedZeroHint = false;

    for (const channelId of channelIds) {
      const oldestForChannel = s.lastSyncedLatestPerChannel[channelId] ?? oldest90Str;
      let cursor: string | null = null;
      let pagesThisChannel = 0;
      let newestTs: string | null = null;

      while (pagesThisChannel < SYNC_MAX_PAGES_PER_CHANNEL) {
        const params: Record<string, unknown> = {
          channel: channelId,
          oldest: oldestForChannel,
          limit: 200,
        };
        if (cursor) params.cursor = cursor;

        const historyResult = await globalThis.slackApi.slackApiFetch(
          'GET',
          '/conversations.history',
          params
        );
        const messages = (historyResult.messages as Record<string, unknown>[]) || [];
        let storedThisPage = 0;
        for (const msg of messages) {
          const ts = msg.ts as string | number | undefined;
          const tsStr = typeof ts === 'number' ? String(ts) : ts;
          if (!tsStr) continue;
          if (!newestTs || tsStr > newestTs) newestTs = tsStr;
          const userId = msg.user as string | undefined;
          const displayText = (globalThis as Record<string, unknown>).getMessageDisplayText as
            | ((m: Record<string, unknown>) => string)
            | undefined;
          const text =
            typeof displayText === 'function' ? displayText(msg) : ((msg.text as string) ?? '');
          const type = (msg.type as string) ?? 'message';
          const subtype = (msg.subtype as string) ?? null;
          const threadTs = (msg.thread_ts as string) ?? null;
          const blocksJson = msg.blocks ? JSON.stringify(msg.blocks) : null;
          const attachmentsJson = msg.attachments ? JSON.stringify(msg.attachments) : null;
          globalThis.slackDb.insertMessage(
            channelId,
            userId ?? null,
            tsStr,
            text,
            type,
            subtype,
            'message',
            threadTs,
            now,
            blocksJson,
            attachmentsJson
          );
          totalStored++;
          storedThisPage++;
        }

        if (messages.length > 0 || pagesThisChannel === 0) {
          const pageLabel = pagesThisChannel > 0 ? ` (page ${pagesThisChannel + 1})` : '';
          console.log(
            `[slack] Channel ${channelId}: ${messages.length} from API, ${storedThisPage} stored for this channel${pageLabel} (total so far: ${totalStored})`
          );
          if (messages.length === 0 && pagesThisChannel === 0 && !loggedZeroHint) {
            console.log(
              `[slack] Hint: If the channel has messages, ensure the bot has OAuth scopes channels:history (public) and groups:history (private).`
            );
            loggedZeroHint = true;
          }
        }
        pagesThisChannel++;
        const meta = historyResult.response_metadata as { next_cursor?: string } | undefined;
        const nextCursor = meta?.next_cursor;
        if (!nextCursor) break;
        cursor = nextCursor;
      }

      if (newestTs) {
        s.lastSyncedLatestPerChannel[channelId] = newestTs;
      }
    }

    globalThis.slackDb.deleteOlderThan(oldest90Str);

    s.lastSyncTime = Date.now();
    s.lastSyncChannels = channelIds.length;
    s.lastSyncMessages = totalStored;
    state.set('lastSyncTime', s.lastSyncTime);
    state.set('lastSyncedLatestPerChannel', s.lastSyncedLatestPerChannel);
    console.log(
      `[slack] Sync completed: ${channelIds.length} channels, ${totalStored} messages stored in total; trimmed to last ${SYNC_WINDOW_DAYS} days`
    );
  } catch (e) {
    console.error('[slack] Sync failed:', e);
  } finally {
    s.syncInProgress = false;
    globalThis.slackPublishState();
  }
}

declare global {
  var slackPublishState: () => void;
  var slackSync: { performSync: typeof performSync };
}
globalThis.slackSync = { performSync };

export { performSync };
