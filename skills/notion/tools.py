"""
All 22 Notion tool definitions.

Each tool is a ToolDefinition (from dev.types.skill_types) with a JSON Schema
for its parameters. Tool names follow the pattern notion_<action>.
"""

from __future__ import annotations

from dev.types.skill_types import ToolDefinition

# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

NOTION_SEARCH = ToolDefinition(
    name="notion_search",
    description="Search pages and databases in the connected Notion workspace.",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query text",
            },
            "filter": {
                "type": "string",
                "enum": ["page", "database"],
                "description": "Filter results by object type (page or database). Omit to search both.",
            },
            "page_size": {
                "type": "integer",
                "description": "Number of results to return (max 100, default 20)",
                "default": 20,
            },
        },
        "required": [],
    },
)

NOTION_GET_PAGE = ToolDefinition(
    name="notion_get_page",
    description="Get a Notion page's properties by ID.",
    parameters={
        "type": "object",
        "properties": {
            "page_id": {
                "type": "string",
                "description": "The page ID (UUID format, with or without dashes)",
            },
        },
        "required": ["page_id"],
    },
)

NOTION_CREATE_PAGE = ToolDefinition(
    name="notion_create_page",
    description="Create a new page in a Notion parent (page or database).",
    parameters={
        "type": "object",
        "properties": {
            "parent_id": {
                "type": "string",
                "description": "Parent page or database ID",
            },
            "parent_type": {
                "type": "string",
                "enum": ["page", "database"],
                "description": "Whether the parent is a page or database (default: page)",
                "default": "page",
            },
            "title": {
                "type": "string",
                "description": "Page title",
            },
            "content": {
                "type": "string",
                "description": "Optional text content to add as a paragraph block",
            },
            "properties": {
                "type": "object",
                "description": "Additional page properties (for database entries). Keys are property names, values follow Notion property value format.",
            },
        },
        "required": ["parent_id", "title"],
    },
)

NOTION_UPDATE_PAGE = ToolDefinition(
    name="notion_update_page",
    description="Update a Notion page's properties or archive status.",
    parameters={
        "type": "object",
        "properties": {
            "page_id": {
                "type": "string",
                "description": "The page ID",
            },
            "title": {
                "type": "string",
                "description": "New title for the page",
            },
            "properties": {
                "type": "object",
                "description": "Properties to update. Keys are property names, values follow Notion property value format.",
            },
            "archived": {
                "type": "boolean",
                "description": "Set to true to archive, false to unarchive",
            },
        },
        "required": ["page_id"],
    },
)

NOTION_DELETE_PAGE = ToolDefinition(
    name="notion_delete_page",
    description="Archive (soft-delete) a Notion page.",
    parameters={
        "type": "object",
        "properties": {
            "page_id": {
                "type": "string",
                "description": "The page ID to archive",
            },
        },
        "required": ["page_id"],
    },
)

# ---------------------------------------------------------------------------
# Databases
# ---------------------------------------------------------------------------

NOTION_QUERY_DATABASE = ToolDefinition(
    name="notion_query_database",
    description="Query a Notion database with optional filters and sorts.",
    parameters={
        "type": "object",
        "properties": {
            "database_id": {
                "type": "string",
                "description": "The database ID",
            },
            "filter": {
                "type": "object",
                "description": "Notion filter object (see Notion API docs for filter format)",
            },
            "sorts": {
                "type": "array",
                "description": "Array of sort objects, e.g. [{\"property\": \"Name\", \"direction\": \"ascending\"}]",
                "items": {"type": "object"},
            },
            "page_size": {
                "type": "integer",
                "description": "Number of results (max 100, default 20)",
                "default": 20,
            },
        },
        "required": ["database_id"],
    },
)

NOTION_GET_DATABASE = ToolDefinition(
    name="notion_get_database",
    description="Get a Notion database's schema and metadata.",
    parameters={
        "type": "object",
        "properties": {
            "database_id": {
                "type": "string",
                "description": "The database ID",
            },
        },
        "required": ["database_id"],
    },
)

NOTION_CREATE_DATABASE = ToolDefinition(
    name="notion_create_database",
    description="Create a new database in a Notion parent page.",
    parameters={
        "type": "object",
        "properties": {
            "parent_id": {
                "type": "string",
                "description": "Parent page ID",
            },
            "title": {
                "type": "string",
                "description": "Database title",
            },
            "properties": {
                "type": "object",
                "description": "Database property schema. Keys are property names, values define type and config. A 'Name' title property is always included.",
            },
        },
        "required": ["parent_id", "title"],
    },
)

NOTION_UPDATE_DATABASE = ToolDefinition(
    name="notion_update_database",
    description="Update a Notion database's title, description, or properties.",
    parameters={
        "type": "object",
        "properties": {
            "database_id": {
                "type": "string",
                "description": "The database ID",
            },
            "title": {
                "type": "string",
                "description": "New database title",
            },
            "description": {
                "type": "string",
                "description": "New database description",
            },
            "properties": {
                "type": "object",
                "description": "Properties to add or update in the schema",
            },
        },
        "required": ["database_id"],
    },
)

# ---------------------------------------------------------------------------
# Blocks
# ---------------------------------------------------------------------------

NOTION_GET_BLOCK = ToolDefinition(
    name="notion_get_block",
    description="Get a single Notion block by ID.",
    parameters={
        "type": "object",
        "properties": {
            "block_id": {
                "type": "string",
                "description": "The block ID",
            },
        },
        "required": ["block_id"],
    },
)

NOTION_GET_BLOCK_CHILDREN = ToolDefinition(
    name="notion_get_block_children",
    description="List child blocks of a Notion block or page.",
    parameters={
        "type": "object",
        "properties": {
            "block_id": {
                "type": "string",
                "description": "The parent block or page ID",
            },
            "page_size": {
                "type": "integer",
                "description": "Number of blocks to return (max 100, default 50)",
                "default": 50,
            },
        },
        "required": ["block_id"],
    },
)

NOTION_APPEND_BLOCKS = ToolDefinition(
    name="notion_append_blocks",
    description="Append child blocks to a Notion page or block.",
    parameters={
        "type": "object",
        "properties": {
            "block_id": {
                "type": "string",
                "description": "The parent block or page ID",
            },
            "children": {
                "type": "array",
                "description": "Array of block objects to append (Notion block format)",
                "items": {"type": "object"},
            },
        },
        "required": ["block_id", "children"],
    },
)

NOTION_UPDATE_BLOCK = ToolDefinition(
    name="notion_update_block",
    description="Update a Notion block's content.",
    parameters={
        "type": "object",
        "properties": {
            "block_id": {
                "type": "string",
                "description": "The block ID",
            },
            "content": {
                "type": "object",
                "description": "Block content update object. The key should be the block type (e.g. 'paragraph') with the updated content.",
            },
        },
        "required": ["block_id", "content"],
    },
)

NOTION_DELETE_BLOCK = ToolDefinition(
    name="notion_delete_block",
    description="Delete a Notion block.",
    parameters={
        "type": "object",
        "properties": {
            "block_id": {
                "type": "string",
                "description": "The block ID to delete",
            },
        },
        "required": ["block_id"],
    },
)

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

NOTION_LIST_USERS = ToolDefinition(
    name="notion_list_users",
    description="List all users in the Notion workspace.",
    parameters={
        "type": "object",
        "properties": {
            "page_size": {
                "type": "integer",
                "description": "Number of users to return (max 100, default 50)",
                "default": 50,
            },
        },
        "required": [],
    },
)

NOTION_GET_USER = ToolDefinition(
    name="notion_get_user",
    description="Get a Notion user by ID.",
    parameters={
        "type": "object",
        "properties": {
            "user_id": {
                "type": "string",
                "description": "The user ID",
            },
        },
        "required": ["user_id"],
    },
)

# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

NOTION_CREATE_COMMENT = ToolDefinition(
    name="notion_create_comment",
    description="Create a comment on a Notion page.",
    parameters={
        "type": "object",
        "properties": {
            "parent_id": {
                "type": "string",
                "description": "The page ID to comment on",
            },
            "text": {
                "type": "string",
                "description": "Comment text",
            },
        },
        "required": ["parent_id", "text"],
    },
)

NOTION_LIST_COMMENTS = ToolDefinition(
    name="notion_list_comments",
    description="List comments on a Notion page or block.",
    parameters={
        "type": "object",
        "properties": {
            "block_id": {
                "type": "string",
                "description": "The page or block ID",
            },
            "page_size": {
                "type": "integer",
                "description": "Number of comments to return (max 100, default 20)",
                "default": 20,
            },
        },
        "required": ["block_id"],
    },
)

# ---------------------------------------------------------------------------
# Convenience tools
# ---------------------------------------------------------------------------

NOTION_GET_PAGE_CONTENT = ToolDefinition(
    name="notion_get_page_content",
    description="Recursively fetch and render all blocks of a Notion page as readable text/markdown.",
    parameters={
        "type": "object",
        "properties": {
            "page_id": {
                "type": "string",
                "description": "The page ID",
            },
            "max_depth": {
                "type": "integer",
                "description": "Maximum nesting depth to fetch (default 3)",
                "default": 3,
            },
        },
        "required": ["page_id"],
    },
)

NOTION_APPEND_TEXT = ToolDefinition(
    name="notion_append_text",
    description="Append a text block to a Notion page (convenience wrapper for append_blocks).",
    parameters={
        "type": "object",
        "properties": {
            "page_id": {
                "type": "string",
                "description": "The page ID",
            },
            "text": {
                "type": "string",
                "description": "Text to append",
            },
            "type": {
                "type": "string",
                "enum": ["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "to_do"],
                "description": "Block type (default: paragraph)",
                "default": "paragraph",
            },
        },
        "required": ["page_id", "text"],
    },
)

NOTION_LIST_ALL_PAGES = ToolDefinition(
    name="notion_list_all_pages",
    description="List all pages accessible to the integration.",
    parameters={
        "type": "object",
        "properties": {
            "page_size": {
                "type": "integer",
                "description": "Number of pages to return (max 100, default 20)",
                "default": 20,
            },
        },
        "required": [],
    },
)

NOTION_LIST_ALL_DATABASES = ToolDefinition(
    name="notion_list_all_databases",
    description="List all databases accessible to the integration.",
    parameters={
        "type": "object",
        "properties": {
            "page_size": {
                "type": "integer",
                "description": "Number of databases to return (max 100, default 20)",
                "default": 20,
            },
        },
        "required": [],
    },
)

# ---------------------------------------------------------------------------
# Combined list for skill registration
# ---------------------------------------------------------------------------

ALL_TOOLS: list[ToolDefinition] = [
    # Pages
    NOTION_SEARCH,
    NOTION_GET_PAGE,
    NOTION_CREATE_PAGE,
    NOTION_UPDATE_PAGE,
    NOTION_DELETE_PAGE,
    # Databases
    NOTION_QUERY_DATABASE,
    NOTION_GET_DATABASE,
    NOTION_CREATE_DATABASE,
    NOTION_UPDATE_DATABASE,
    # Blocks
    NOTION_GET_BLOCK,
    NOTION_GET_BLOCK_CHILDREN,
    NOTION_APPEND_BLOCKS,
    NOTION_UPDATE_BLOCK,
    NOTION_DELETE_BLOCK,
    # Users
    NOTION_LIST_USERS,
    NOTION_GET_USER,
    # Comments
    NOTION_CREATE_COMMENT,
    NOTION_LIST_COMMENTS,
    # Convenience
    NOTION_GET_PAGE_CONTENT,
    NOTION_APPEND_TEXT,
    NOTION_LIST_ALL_PAGES,
    NOTION_LIST_ALL_DATABASES,
]
