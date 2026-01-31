"""
Tool definitions for all 72 GitHub MCP tools.

Each tool has a name, description, and inputSchema (JSON Schema dict).
Tools are organised by domain and combined into ALL_TOOLS at the end.
"""

from __future__ import annotations

from mcp.types import Tool

# ---------------------------------------------------------------------------
# Repository tools (12)
# ---------------------------------------------------------------------------

repo_tools: list[Tool] = [
    Tool(
        name="list_repos",
        description="List repositories for the authenticated user or a specific owner",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner (user or org). Defaults to the authenticated user"},
                "limit": {"type": "number", "description": "Maximum number of repositories to return", "default": 30},
                "visibility": {"type": "string", "description": "Filter by visibility", "enum": ["all", "public", "private"]},
                "sort": {"type": "string", "description": "Sort field", "enum": ["created", "updated", "pushed", "full_name"]},
            },
        },
    ),
    Tool(
        name="get_repo",
        description="Get detailed information about a specific repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
            },
            "required": ["owner", "repo"],
        },
    ),
    Tool(
        name="create_repo",
        description="Create a new repository for the authenticated user",
        inputSchema={
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Repository name"},
                "description": {"type": "string", "description": "Repository description"},
                "visibility": {"type": "string", "description": "Repository visibility", "enum": ["public", "private"], "default": "private"},
                "auto_init": {"type": "boolean", "description": "Initialize with a README", "default": False},
            },
            "required": ["name"],
        },
    ),
    Tool(
        name="fork_repo",
        description="Fork a repository to the authenticated user's account",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Owner of the repository to fork"},
                "repo": {"type": "string", "description": "Repository name to fork"},
                "fork_name": {"type": "string", "description": "Custom name for the forked repository"},
            },
            "required": ["owner", "repo"],
        },
    ),
    Tool(
        name="delete_repo",
        description="Permanently delete a repository. This action cannot be undone",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "confirm": {"type": "boolean", "description": "Must be true to confirm deletion"},
            },
            "required": ["owner", "repo", "confirm"],
        },
    ),
    Tool(
        name="clone_repo",
        description="Clone a repository to a local directory",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "directory": {"type": "string", "description": "Local directory path to clone into"},
            },
            "required": ["owner", "repo"],
        },
    ),
    Tool(
        name="list_collaborators",
        description="List collaborators on a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "limit": {"type": "number", "description": "Maximum number of collaborators to return", "default": 30},
            },
            "required": ["owner", "repo"],
        },
    ),
    Tool(
        name="add_collaborator",
        description="Add a collaborator to a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "username": {"type": "string", "description": "GitHub username of the collaborator to add"},
                "permission": {"type": "string", "description": "Permission level to grant", "enum": ["pull", "triage", "push", "maintain", "admin"], "default": "push"},
            },
            "required": ["owner", "repo", "username"],
        },
    ),
    Tool(
        name="remove_collaborator",
        description="Remove a collaborator from a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "username": {"type": "string", "description": "GitHub username of the collaborator to remove"},
            },
            "required": ["owner", "repo", "username"],
        },
    ),
    Tool(
        name="list_topics",
        description="List topics (tags) on a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
            },
            "required": ["owner", "repo"],
        },
    ),
    Tool(
        name="set_topics",
        description="Replace all topics on a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "topics": {"type": "array", "items": {"type": "string"}, "description": "List of topic names to set"},
            },
            "required": ["owner", "repo", "topics"],
        },
    ),
    Tool(
        name="list_languages",
        description="List programming languages detected in a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
            },
            "required": ["owner", "repo"],
        },
    ),
]

# ---------------------------------------------------------------------------
# Issue tools (12)
# ---------------------------------------------------------------------------

issue_tools: list[Tool] = [
    Tool(
        name="list_issues",
        description="List issues in a repository with optional filters",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "limit": {"type": "number", "description": "Maximum number of issues to return", "default": 30},
                "state": {"type": "string", "description": "Filter by state", "enum": ["open", "closed", "all"], "default": "open"},
                "label": {"type": "string", "description": "Filter by label name"},
                "assignee": {"type": "string", "description": "Filter by assignee username"},
            },
            "required": ["owner", "repo"],
        },
    ),
    Tool(
        name="get_issue",
        description="Get detailed information about a specific issue",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Issue number"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="create_issue",
        description="Create a new issue in a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "title": {"type": "string", "description": "Issue title"},
                "body": {"type": "string", "description": "Issue body (Markdown supported)"},
                "labels": {"type": "array", "items": {"type": "string"}, "description": "Labels to apply to the issue"},
                "assignees": {"type": "array", "items": {"type": "string"}, "description": "Usernames to assign to the issue"},
            },
            "required": ["owner", "repo", "title"],
        },
    ),
    Tool(
        name="close_issue",
        description="Close an issue",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Issue number"},
                "reason": {"type": "string", "description": "Reason for closing", "enum": ["completed", "not_planned"]},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="reopen_issue",
        description="Reopen a closed issue",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Issue number"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="edit_issue",
        description="Edit an existing issue's title or body",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Issue number"},
                "title": {"type": "string", "description": "New issue title"},
                "body": {"type": "string", "description": "New issue body"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="comment_on_issue",
        description="Add a comment to an issue",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Issue number"},
                "body": {"type": "string", "description": "Comment body (Markdown supported)"},
            },
            "required": ["owner", "repo", "number", "body"],
        },
    ),
    Tool(
        name="list_issue_comments",
        description="List comments on an issue",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Issue number"},
                "limit": {"type": "number", "description": "Maximum number of comments to return", "default": 30},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="add_issue_labels",
        description="Add labels to an issue",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Issue number"},
                "labels": {"type": "array", "items": {"type": "string"}, "description": "Labels to add"},
            },
            "required": ["owner", "repo", "number", "labels"],
        },
    ),
    Tool(
        name="remove_issue_labels",
        description="Remove labels from an issue",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Issue number"},
                "labels": {"type": "array", "items": {"type": "string"}, "description": "Labels to remove"},
            },
            "required": ["owner", "repo", "number", "labels"],
        },
    ),
    Tool(
        name="add_issue_assignees",
        description="Add assignees to an issue",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Issue number"},
                "assignees": {"type": "array", "items": {"type": "string"}, "description": "Usernames to assign"},
            },
            "required": ["owner", "repo", "number", "assignees"],
        },
    ),
    Tool(
        name="remove_issue_assignees",
        description="Remove assignees from an issue",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Issue number"},
                "assignees": {"type": "array", "items": {"type": "string"}, "description": "Usernames to remove"},
            },
            "required": ["owner", "repo", "number", "assignees"],
        },
    ),
]

# ---------------------------------------------------------------------------
# Pull Request tools (16)
# ---------------------------------------------------------------------------

pr_tools: list[Tool] = [
    Tool(
        name="list_prs",
        description="List pull requests in a repository with optional filters",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "limit": {"type": "number", "description": "Maximum number of pull requests to return", "default": 30},
                "state": {"type": "string", "description": "Filter by state", "enum": ["open", "closed", "all"], "default": "open"},
                "base": {"type": "string", "description": "Filter by base branch name"},
                "label": {"type": "string", "description": "Filter by label name"},
            },
            "required": ["owner", "repo"],
        },
    ),
    Tool(
        name="get_pr",
        description="Get detailed information about a specific pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="create_pr",
        description="Create a new pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "title": {"type": "string", "description": "Pull request title"},
                "head": {"type": "string", "description": "The branch containing the changes (e.g. 'feature-branch' or 'user:feature-branch')"},
                "base": {"type": "string", "description": "The branch to merge into (defaults to repo default branch)"},
                "body": {"type": "string", "description": "Pull request body (Markdown supported)"},
                "draft": {"type": "boolean", "description": "Create as a draft pull request", "default": False},
                "labels": {"type": "array", "items": {"type": "string"}, "description": "Labels to apply"},
                "assignees": {"type": "array", "items": {"type": "string"}, "description": "Usernames to assign"},
                "reviewers": {"type": "array", "items": {"type": "string"}, "description": "Usernames to request review from"},
            },
            "required": ["owner", "repo", "title", "head"],
        },
    ),
    Tool(
        name="close_pr",
        description="Close a pull request without merging",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="reopen_pr",
        description="Reopen a closed pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="merge_pr",
        description="Merge a pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
                "method": {"type": "string", "description": "Merge method to use", "enum": ["merge", "squash", "rebase"], "default": "merge"},
                "delete_branch": {"type": "boolean", "description": "Delete the head branch after merging", "default": False},
                "commit_message": {"type": "string", "description": "Custom merge commit message"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="edit_pr",
        description="Edit a pull request's title, body, or base branch",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
                "title": {"type": "string", "description": "New pull request title"},
                "body": {"type": "string", "description": "New pull request body"},
                "base": {"type": "string", "description": "New base branch"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="comment_on_pr",
        description="Add a comment to a pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
                "body": {"type": "string", "description": "Comment body (Markdown supported)"},
            },
            "required": ["owner", "repo", "number", "body"],
        },
    ),
    Tool(
        name="list_pr_comments",
        description="List comments on a pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
                "limit": {"type": "number", "description": "Maximum number of comments to return", "default": 30},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="list_pr_reviews",
        description="List reviews on a pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="create_pr_review",
        description="Submit a review on a pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
                "event": {"type": "string", "description": "Review action to perform", "enum": ["APPROVE", "REQUEST_CHANGES", "COMMENT"]},
                "body": {"type": "string", "description": "Review comment body"},
            },
            "required": ["owner", "repo", "number", "event"],
        },
    ),
    Tool(
        name="list_pr_files",
        description="List files changed in a pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="get_pr_diff",
        description="Get the unified diff for a pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="get_pr_checks",
        description="Get CI/CD check runs and status for a pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
    Tool(
        name="request_pr_reviewers",
        description="Request reviews from specific users on a pull request",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
                "reviewers": {"type": "array", "items": {"type": "string"}, "description": "Usernames to request review from"},
            },
            "required": ["owner", "repo", "number", "reviewers"],
        },
    ),
    Tool(
        name="mark_pr_ready",
        description="Mark a draft pull request as ready for review",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "number": {"type": "number", "description": "Pull request number"},
            },
            "required": ["owner", "repo", "number"],
        },
    ),
]

# ---------------------------------------------------------------------------
# Search tools (4)
# ---------------------------------------------------------------------------

search_tools: list[Tool] = [
    Tool(
        name="search_repos",
        description="Search GitHub repositories by query",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (supports GitHub search syntax)"},
                "limit": {"type": "number", "description": "Maximum number of results to return", "default": 30},
                "sort": {"type": "string", "description": "Sort field", "enum": ["stars", "forks", "help-wanted-issues", "updated"]},
                "order": {"type": "string", "description": "Sort order", "enum": ["asc", "desc"], "default": "desc"},
            },
            "required": ["query"],
        },
    ),
    Tool(
        name="search_issues",
        description="Search issues and pull requests across GitHub",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (supports GitHub search syntax, e.g. 'is:issue is:open label:bug')"},
                "limit": {"type": "number", "description": "Maximum number of results to return", "default": 30},
                "sort": {"type": "string", "description": "Sort field", "enum": ["comments", "reactions", "created", "updated"]},
            },
            "required": ["query"],
        },
    ),
    Tool(
        name="search_code",
        description="Search code across GitHub repositories",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (supports GitHub code search syntax)"},
                "limit": {"type": "number", "description": "Maximum number of results to return", "default": 30},
                "repo": {"type": "string", "description": "Restrict search to a specific repo (owner/name format)"},
                "language": {"type": "string", "description": "Filter by programming language"},
            },
            "required": ["query"],
        },
    ),
    Tool(
        name="search_commits",
        description="Search commits across GitHub repositories",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query (supports GitHub commit search syntax)"},
                "limit": {"type": "number", "description": "Maximum number of results to return", "default": 30},
                "repo": {"type": "string", "description": "Restrict search to a specific repo (owner/name format)"},
            },
            "required": ["query"],
        },
    ),
]

# ---------------------------------------------------------------------------
# Code / File tools (3)
# ---------------------------------------------------------------------------

code_tools: list[Tool] = [
    Tool(
        name="view_file",
        description="View the contents of a file in a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "path": {"type": "string", "description": "File path within the repository"},
                "ref": {"type": "string", "description": "Git ref (branch, tag, or commit SHA). Defaults to the default branch"},
            },
            "required": ["owner", "repo", "path"],
        },
    ),
    Tool(
        name="list_directory",
        description="List the contents of a directory in a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "path": {"type": "string", "description": "Directory path within the repository. Defaults to the root"},
                "ref": {"type": "string", "description": "Git ref (branch, tag, or commit SHA). Defaults to the default branch"},
            },
            "required": ["owner", "repo"],
        },
    ),
    Tool(
        name="get_readme",
        description="Get the README file for a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
            },
            "required": ["owner", "repo"],
        },
    ),
]

# ---------------------------------------------------------------------------
# Release tools (6)
# ---------------------------------------------------------------------------

release_tools: list[Tool] = [
    Tool(
        name="list_releases",
        description="List releases for a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "limit": {"type": "number", "description": "Maximum number of releases to return", "default": 30},
            },
            "required": ["owner", "repo"],
        },
    ),
    Tool(
        name="get_release",
        description="Get a specific release by tag name",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "tag": {"type": "string", "description": "Release tag name (e.g. 'v1.0.0')"},
            },
            "required": ["owner", "repo", "tag"],
        },
    ),
    Tool(
        name="create_release",
        description="Create a new release for a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "tag": {"type": "string", "description": "Tag name for the release (e.g. 'v1.0.0')"},
                "title": {"type": "string", "description": "Release title"},
                "notes": {"type": "string", "description": "Release notes body (Markdown supported)"},
                "draft": {"type": "boolean", "description": "Create as a draft release", "default": False},
                "prerelease": {"type": "boolean", "description": "Mark as a pre-release", "default": False},
                "target": {"type": "string", "description": "Target commitish (branch or commit SHA) for the tag"},
                "generate_notes": {"type": "boolean", "description": "Auto-generate release notes from commits", "default": False},
            },
            "required": ["owner", "repo", "tag"],
        },
    ),
    Tool(
        name="delete_release",
        description="Delete a release by tag name",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "tag": {"type": "string", "description": "Release tag name to delete"},
                "cleanup_tag": {"type": "boolean", "description": "Also delete the associated git tag", "default": False},
            },
            "required": ["owner", "repo", "tag"],
        },
    ),
    Tool(
        name="list_release_assets",
        description="List assets (downloadable files) attached to a release",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "tag": {"type": "string", "description": "Release tag name"},
            },
            "required": ["owner", "repo", "tag"],
        },
    ),
    Tool(
        name="get_latest_release",
        description="Get the latest published release for a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
            },
            "required": ["owner", "repo"],
        },
    ),
]

# ---------------------------------------------------------------------------
# Gist tools (6)
# ---------------------------------------------------------------------------

gist_tools: list[Tool] = [
    Tool(
        name="list_gists",
        description="List gists for the authenticated user or a specific user",
        inputSchema={
            "type": "object",
            "properties": {
                "limit": {"type": "number", "description": "Maximum number of gists to return", "default": 30},
                "username": {"type": "string", "description": "GitHub username. Defaults to the authenticated user"},
            },
        },
    ),
    Tool(
        name="get_gist",
        description="Get a specific gist by ID, including its files and content",
        inputSchema={
            "type": "object",
            "properties": {
                "gist_id": {"type": "string", "description": "The gist ID"},
            },
            "required": ["gist_id"],
        },
    ),
    Tool(
        name="create_gist",
        description="Create a new gist with one or more files",
        inputSchema={
            "type": "object",
            "properties": {
                "files": {
                    "type": "object",
                    "description": "Map of filename to file content, e.g. {\"hello.py\": {\"content\": \"print('hello')\"}}",
                    "additionalProperties": {
                        "type": "object",
                        "properties": {
                            "content": {"type": "string", "description": "File content"},
                        },
                        "required": ["content"],
                    },
                },
                "description": {"type": "string", "description": "Gist description"},
                "public": {"type": "boolean", "description": "Whether the gist is public", "default": False},
            },
            "required": ["files"],
        },
    ),
    Tool(
        name="edit_gist",
        description="Edit an existing gist's description or files",
        inputSchema={
            "type": "object",
            "properties": {
                "gist_id": {"type": "string", "description": "The gist ID"},
                "description": {"type": "string", "description": "New gist description"},
                "files": {
                    "type": "object",
                    "description": "Map of filename to new content. Set content to null to delete a file",
                    "additionalProperties": {
                        "type": "object",
                        "properties": {
                            "content": {"type": "string", "description": "New file content"},
                        },
                    },
                },
            },
            "required": ["gist_id"],
        },
    ),
    Tool(
        name="delete_gist",
        description="Permanently delete a gist",
        inputSchema={
            "type": "object",
            "properties": {
                "gist_id": {"type": "string", "description": "The gist ID to delete"},
            },
            "required": ["gist_id"],
        },
    ),
    Tool(
        name="clone_gist",
        description="Clone a gist to a local directory",
        inputSchema={
            "type": "object",
            "properties": {
                "gist_id": {"type": "string", "description": "The gist ID to clone"},
            },
            "required": ["gist_id"],
        },
    ),
]

# ---------------------------------------------------------------------------
# Actions / Workflow tools (9)
# ---------------------------------------------------------------------------

actions_tools: list[Tool] = [
    Tool(
        name="list_workflows",
        description="List GitHub Actions workflows defined in a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
            },
            "required": ["owner", "repo"],
        },
    ),
    Tool(
        name="list_workflow_runs",
        description="List recent workflow runs for a repository",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "limit": {"type": "number", "description": "Maximum number of runs to return", "default": 20},
                "workflow_id": {"type": "string", "description": "Filter by workflow ID or filename (e.g. 'ci.yml')"},
                "branch": {"type": "string", "description": "Filter by branch name"},
                "status": {"type": "string", "description": "Filter by status", "enum": ["queued", "in_progress", "completed", "waiting", "requested"]},
            },
            "required": ["owner", "repo"],
        },
    ),
    Tool(
        name="get_workflow_run",
        description="Get detailed information about a specific workflow run",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "run_id": {"type": "number", "description": "Workflow run ID"},
            },
            "required": ["owner", "repo", "run_id"],
        },
    ),
    Tool(
        name="list_run_jobs",
        description="List jobs for a specific workflow run",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "run_id": {"type": "number", "description": "Workflow run ID"},
            },
            "required": ["owner", "repo", "run_id"],
        },
    ),
    Tool(
        name="get_run_logs",
        description="Download logs for a specific workflow run",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "run_id": {"type": "number", "description": "Workflow run ID"},
            },
            "required": ["owner", "repo", "run_id"],
        },
    ),
    Tool(
        name="rerun_workflow",
        description="Re-run an entire workflow run",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "run_id": {"type": "number", "description": "Workflow run ID to re-run"},
            },
            "required": ["owner", "repo", "run_id"],
        },
    ),
    Tool(
        name="cancel_workflow_run",
        description="Cancel a workflow run that is in progress",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "run_id": {"type": "number", "description": "Workflow run ID to cancel"},
            },
            "required": ["owner", "repo", "run_id"],
        },
    ),
    Tool(
        name="trigger_workflow",
        description="Manually trigger a workflow dispatch event",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "workflow_id": {"type": "string", "description": "Workflow ID or filename (e.g. 'deploy.yml')"},
                "ref": {"type": "string", "description": "Git ref (branch or tag) to run the workflow on", "default": "main"},
                "inputs": {"type": "object", "description": "Input key-value pairs for the workflow_dispatch event", "additionalProperties": {"type": "string"}},
            },
            "required": ["owner", "repo", "workflow_id"],
        },
    ),
    Tool(
        name="view_workflow_yaml",
        description="View the YAML source of a workflow definition",
        inputSchema={
            "type": "object",
            "properties": {
                "owner": {"type": "string", "description": "Repository owner"},
                "repo": {"type": "string", "description": "Repository name"},
                "workflow_id": {"type": "string", "description": "Workflow ID or filename (e.g. 'ci.yml')"},
            },
            "required": ["owner", "repo", "workflow_id"],
        },
    ),
]

# ---------------------------------------------------------------------------
# Notification tools (3)
# ---------------------------------------------------------------------------

notification_tools: list[Tool] = [
    Tool(
        name="list_notifications",
        description="List GitHub notifications for the authenticated user",
        inputSchema={
            "type": "object",
            "properties": {
                "all": {"type": "boolean", "description": "Include read notifications", "default": False},
                "limit": {"type": "number", "description": "Maximum number of notifications to return", "default": 50},
            },
        },
    ),
    Tool(
        name="mark_notification_read",
        description="Mark a specific notification thread as read",
        inputSchema={
            "type": "object",
            "properties": {
                "thread_id": {"type": "string", "description": "Notification thread ID"},
            },
            "required": ["thread_id"],
        },
    ),
    Tool(
        name="mark_all_notifications_read",
        description="Mark all notifications as read",
        inputSchema={
            "type": "object",
            "properties": {},
        },
    ),
]

# ---------------------------------------------------------------------------
# Fallback / raw API tool (1)
# ---------------------------------------------------------------------------

api_tools: list[Tool] = [
    Tool(
        name="gh_api",
        description="Make a raw GitHub REST API request. Use this for any endpoint not covered by the other tools",
        inputSchema={
            "type": "object",
            "properties": {
                "endpoint": {"type": "string", "description": "API endpoint path (e.g. '/repos/owner/repo/branches')"},
                "method": {"type": "string", "description": "HTTP method", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"], "default": "GET"},
                "body": {"type": "object", "description": "Request body (for POST/PUT/PATCH)", "additionalProperties": True},
            },
            "required": ["endpoint"],
        },
    ),
]

# ---------------------------------------------------------------------------
# All tools combined (72 total)
# ---------------------------------------------------------------------------

ALL_TOOLS: list[Tool] = [
    *repo_tools,
    *issue_tools,
    *pr_tools,
    *search_tools,
    *code_tools,
    *release_tools,
    *gist_tools,
    *actions_tools,
    *notification_tools,
    *api_tools,
]
