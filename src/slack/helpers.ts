/**
 * Shared helpers for Slack message handling.
 * Used by sync, get_messages, and onServerEvent.
 */

function textFromBlocks(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    if (b.text && typeof b.text === 'object' && b.text !== null && 'text' in (b.text as object)) {
      const t = (b.text as { text?: string }).text;
      if (typeof t === 'string' && t.trim()) parts.push(t.trim());
    }
    if (b.elements && Array.isArray(b.elements)) {
      for (const el of b.elements) {
        if (el && typeof el === 'object' && 'text' in (el as object)) {
          const t = (el as { text?: string }).text;
          if (typeof t === 'string' && t.trim()) parts.push(t.trim());
        }
      }
    }
  }
  return parts.join(' ');
}

function textFromAttachments(attachments: unknown): string {
  if (!Array.isArray(attachments)) return '';
  const parts: string[] = [];
  for (const a of attachments) {
    if (!a || typeof a !== 'object') continue;
    const at = a as Record<string, unknown>;
    for (const key of ['fallback', 'pretext', 'title', 'text']) {
      const v = at[key];
      if (typeof v === 'string' && v.trim()) parts.push(v.trim());
    }
  }
  return parts.join(' ');
}

/**
 * Display text for a message: msg.text if non-empty, else fallback from blocks and/or attachments.
 */
export function getMessageDisplayText(msg: Record<string, unknown>): string {
  const text = (msg.text as string) ?? '';
  if (text.trim()) return text;
  const fromBlocks = textFromBlocks(msg.blocks);
  if (fromBlocks) return fromBlocks;
  return textFromAttachments(msg.attachments);
}
