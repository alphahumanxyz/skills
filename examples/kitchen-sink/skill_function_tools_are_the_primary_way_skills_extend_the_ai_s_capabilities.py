from __future__ import annotations
from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult
from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep
import json
from datetime import datetime, timezone
from typing import Any
"""Section: function. Tools are the primary way skills extend the AI's capabilities."""

# function. Tools are the primary way skills extend the AI's capabilities.


async def execute_add_note(args: dict) -> ToolResult:
    """Save a note to the skill's persistent data directory.

    Demonstrates: write_data, get_state, set_state, emit_event
    """
    ctx: SkillContext = args.pop("__context__")
    title = args.get("title", "Untitled")
    body = args.get("body", "")

    # Read existing notes index from persistent state
    state = ctx.get_state() or {}
    notes: list[dict] = state.get("notes_index", [])

    note_id = f"note_{len(notes) + 1}"
    note = {
        "id": note_id,
        "title": title,
        "body": body,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Persist the note content as a file in data_dir
    await ctx.write_data(f"{note_id}.json", json.dumps(note, indent=2))

    # Update the index in skill state
    notes.append({"id": note_id, "title": title})
    ctx.set_state({"notes_index": notes})

    # Emit an event so intelligence rules can react
    ctx.emit_event("note_created", {"note_id": note_id, "title": title})

    return ToolResult(content=f"Note '{title}' saved as {note_id}.")


async def execute_get_note(args: dict) -> ToolResult:
    """Retrieve a note by its ID.

    Demonstrates: read_data, error handling
    """
    ctx: SkillContext = args.pop("__context__")
    note_id = args.get("note_id", "")

    try:
        raw = await ctx.read_data(f"{note_id}.json")
        note = json.loads(raw)
        return ToolResult(
            content=f"**{note['title']}**\n\n{note['body']}\n\n_Created: {note['created_at']}_"
        )
    except Exception as e:
        return ToolResult(content=f"Note not found: {e}", is_error=True)


async def execute_list_notes(args: dict) -> ToolResult:
    """List all saved notes.

    Demonstrates: get_state
    """
    ctx: SkillContext = args.pop("__context__")
    state = ctx.get_state() or {}
    notes = state.get("notes_index", [])

    if not notes:
        return ToolResult(content="No notes saved yet.")

    lines = [f"- **{n['id']}**: {n['title']}" for n in notes]
    return ToolResult(content=f"Notes ({len(notes)}):\n" + "\n".join(lines))


async def execute_search_memory(args: dict) -> ToolResult:
    """Search the shared memory system.

    Demonstrates: memory.search
    """
    ctx: SkillContext = args.pop("__context__")
    query = args.get("query", "")

    results = await ctx.memory.search(query)

    if not results:
        return ToolResult(content=f"No memory results for '{query}'.")

    lines = []
    for r in results[:10]:
        name = r.get("name", "unknown")
        snippet = r.get("content", "")[:120]
        lines.append(f"- **{name}**: {snippet}")

    return ToolResult(content=f"Memory search results ({len(results)}):\n" + "\n".join(lines))


async def execute_save_memory(args: dict) -> ToolResult:
    """Write to the shared memory system.

    Demonstrates: memory.write
    """
    ctx: SkillContext = args.pop("__context__")
    name = args.get("name", "")
    content = args.get("content", "")

    await ctx.memory.write(name, content)
    return ToolResult(content=f"Memory '{name}' saved.")


async def execute_find_entities(args: dict) -> ToolResult:
    """Query the platform entity graph.

    Demonstrates: entities.search, entities.get_by_tag
    """
    ctx: SkillContext = args.pop("__context__")
    query = args.get("query", "")
    entity_type = args.get("type")

    if query.startswith("#"):
        # Tag-based search
        tag = query.lstrip("#")
        results = await ctx.entities.get_by_tag(tag, type=entity_type)
    else:
        # Free-text search
        results = await ctx.entities.search(query)

    if not results:
        return ToolResult(content="No entities found.")

    lines = []
    for e in results[:10]:
        tags = ", ".join(e.tags) if e.tags else "none"
        lines.append(f"- [{e.type}] **{e.name}** (id={e.id}, tags={tags})")

    return ToolResult(content=f"Entities ({len(results)}):\n" + "\n".join(lines))


async def execute_get_session_info(args: dict) -> ToolResult:
    """Return current session information.

    Demonstrates: session.id, session.get
    """
    ctx: SkillContext = args.pop("__context__")

    session_id = ctx.session.id
    message_count = ctx.session.get("message_count") or 0

    return ToolResult(content=f"Session ID: {session_id}\nMessages in session: {message_count}")

