/**
 * Contact domain tool handlers.
 */

import * as contactApi from "../api/contact-api.js";
import { formatEntity, logAndFormatError, ErrorCategory } from "../helpers.js";
import type { ToolResult } from "../helpers.js";
import { validateId, optNumber } from "../validation.js";

export async function list_contacts(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const limit = optNumber(args, "limit", 20);
    const { data: contacts } = await contactApi.listContacts(limit);

    if (contacts.length === 0) {
      return { content: "No contacts found." };
    }

    const lines = contacts.map((u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
      return `${name} (ID: ${u.id})${u.username ? ` @${u.username}` : ""}${u.phoneNumber ? ` ${u.phoneNumber}` : ""}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("list_contacts", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function search_contacts(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const query = typeof args.query === "string" ? args.query : "";
    if (!query) return { content: "Search query is required", isError: true };
    const limit = optNumber(args, "limit", 20);

    const { data: contacts } = await contactApi.searchContacts(query, limit);
    if (contacts.length === 0) {
      return { content: `No contacts found matching "${query}".` };
    }

    const lines = contacts.map((u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "Unknown";
      return `${name} (ID: ${u.id})${u.username ? ` @${u.username}` : ""}`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("search_contacts", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function add_contact(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const firstName = typeof args.first_name === "string" ? args.first_name : "";
    const lastName = typeof args.last_name === "string" ? args.last_name : "";
    const phoneNumber = typeof args.phone_number === "string" ? args.phone_number : "";
    const userId = typeof args.user_id === "string" ? args.user_id : undefined;
    if (!firstName) return { content: "First name is required", isError: true };
    if (!phoneNumber && !userId) return { content: "Phone number or user ID is required", isError: true };

    await contactApi.addContact(firstName, lastName, phoneNumber, userId);
    return { content: `Contact ${firstName} ${lastName} added successfully.` };
  } catch (error) {
    return logAndFormatError("add_contact", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function delete_contact(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const userId = validateId(args.user_id, "user_id");
    await contactApi.deleteContact(String(userId));
    return { content: `Contact ${userId} deleted.` };
  } catch (error) {
    return logAndFormatError("delete_contact", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function block_user(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const userId = validateId(args.user_id, "user_id");
    await contactApi.blockUser(String(userId));
    return { content: `User ${userId} blocked.` };
  } catch (error) {
    return logAndFormatError("block_user", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function unblock_user(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const userId = validateId(args.user_id, "user_id");
    await contactApi.unblockUser(String(userId));
    return { content: `User ${userId} unblocked.` };
  } catch (error) {
    return logAndFormatError("unblock_user", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function get_blocked_users(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const limit = optNumber(args, "limit", 100);
    const { data: users } = await contactApi.getBlockedUsers(limit);

    if (users.length === 0) {
      return { content: "No blocked users." };
    }

    const lines = users.map((u) => `${u.firstName} (ID: ${u.id})`);
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_blocked_users", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function get_contact_ids(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const { data: ids } = await contactApi.getContactIds();
    if (ids.length === 0) {
      return { content: "No contacts found." };
    }
    return { content: `Contact IDs: ${ids.join(", ")}` };
  } catch (error) {
    return logAndFormatError("get_contact_ids", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function import_contacts(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const contacts = Array.isArray(args.contacts) ? args.contacts : [];
    if (contacts.length === 0) return { content: "No contacts to import", isError: true };

    const { data } = await contactApi.importContacts(
      contacts.map((c: Record<string, unknown>) => ({
        phone: String(c.phone ?? ""),
        firstName: String(c.first_name ?? ""),
        lastName: c.last_name ? String(c.last_name) : undefined,
      })),
    );
    return { content: `Imported ${data} contacts.` };
  } catch (error) {
    return logAndFormatError("import_contacts", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function export_contacts(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const { data: contacts } = await contactApi.exportContacts();
    if (contacts.length === 0) {
      return { content: "No contacts to export." };
    }

    const lines = contacts.map((u) => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
      return `${name}${u.phoneNumber ? ` (${u.phoneNumber})` : ""} [ID: ${u.id}]`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("export_contacts", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function get_direct_chat_by_contact(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const userId = validateId(args.user_id, "user_id");
    const { data: chat } = await contactApi.getDirectChatByContact(String(userId));
    if (!chat) {
      return { content: `No direct chat found with user ${userId}.` };
    }
    const entity = formatEntity(chat);
    return { content: `Direct chat: ${entity.name} (ID: ${entity.id})` };
  } catch (error) {
    return logAndFormatError("get_direct_chat_by_contact", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function get_contact_chats(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const limit = optNumber(args, "limit", 20);
    const { data: chats } = await contactApi.getContactChats(limit);

    if (chats.length === 0) {
      return { content: "No contact chats found." };
    }

    const lines = chats.map((c) => {
      const entity = formatEntity(c);
      return `${entity.name} (ID: ${entity.id})`;
    });
    return { content: lines.join("\n") };
  } catch (error) {
    return logAndFormatError("get_contact_chats", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}

export async function get_last_interaction(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const userId = validateId(args.user_id, "user_id");
    const { data } = await contactApi.getLastInteraction(String(userId));
    if (!data) {
      return { content: `No interaction found with user ${userId}.` };
    }
    return { content: data };
  } catch (error) {
    return logAndFormatError("get_last_interaction", error instanceof Error ? error : new Error(String(error)), ErrorCategory.CONTACT);
  }
}
