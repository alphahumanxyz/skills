/**
 * Push state summary to the host via reverse RPC.
 *
 * The host's SkillStateManager stores this and React components
 * read it via useSkillState('telegram').
 */

import { getState, subscribe } from "./store.js";
import type { TelegramHostState } from "./types.js";
import createDebug from "debug";

const log = createDebug("skill:telegram:sync");

let pushToHost: ((partial: Record<string, unknown>) => Promise<void>) | null =
  null;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 100;

/**
 * Initialize the sync-to-host bridge.
 * @param setState - The SkillServer's setState reverse RPC method.
 */
export function initHostSync(
  setState: (partial: Record<string, unknown>) => Promise<void>,
): void {
  pushToHost = setState;

  // Subscribe to state changes and debounce pushes
  subscribe(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void pushHostState();
    }, DEBOUNCE_MS);
  });

  // Push initial state
  void pushHostState();
}

function buildHostState(): TelegramHostState {
  const s = getState();
  const totalUnread = s.chatsOrder.reduce(
    (total, id) => total + (s.chats[id]?.unreadCount || 0),
    0,
  );
  return {
    connectionStatus: s.connectionStatus,
    authStatus: s.authStatus,
    isInitialized: s.isInitialized,
    currentUser: s.currentUser,
    chatsOrder: s.chatsOrder,
    chats: s.chats,
    totalUnread,
  };
}

async function pushHostState(): Promise<void> {
  if (!pushToHost) return;
  try {
    const hostState = buildHostState();
    await pushToHost(hostState as unknown as Record<string, unknown>);
  } catch (err) {
    log("Failed to push state to host: %O", err);
  }
}
