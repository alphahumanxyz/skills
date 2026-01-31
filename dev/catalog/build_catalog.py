"""
Build a skills catalog JSON file.

Scans ../skills/ for production skills, extracts metadata from skill.py
exports and package.json, then writes skills-catalog.json to the
repository root.

Usage:
    python -m dev.catalog.build_catalog
"""

from __future__ import annotations

import importlib.util
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dev.types.skill_types import SkillDefinition

# ---------------------------------------------------------------------------
# Console helpers
# ---------------------------------------------------------------------------

PASS = "\033[32m\u2713\033[0m"
FAIL = "\033[31m\u2717\033[0m"
WARN = "\033[33m!\033[0m"


def bold(s: str) -> str:
    return f"\033[1m{s}\033[0m"


def dim(s: str) -> str:
    return f"\033[2m{s}\033[0m"


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


def detect_execution_style(dir_path: Path) -> str:
    """Detect skill execution style from directory contents."""
    has_skill_py = (dir_path / "skill.py").exists()
    has_pkg_json = (dir_path / "package.json").exists()
    has_src_dir = (dir_path / "src").is_dir()
    has_ts_files = any(dir_path.rglob("*.ts"))

    if has_skill_py:
        return "python"
    if has_pkg_json and has_src_dir:
        return "integration"
    if has_ts_files:
        return "integration"
    return "prompt-only"


# ---------------------------------------------------------------------------
# Metadata extraction
# ---------------------------------------------------------------------------


def extract_skill_py(skill_py_path: Path) -> dict[str, Any] | None:
    """Extract metadata from skill.py via dynamic import."""
    if not skill_py_path.exists():
        return None

    try:
        spec = importlib.util.spec_from_file_location("_skill_catalog", skill_py_path)
        if spec is None or spec.loader is None:
            return None
        module = importlib.util.module_from_spec(spec)
        # Add repo root to sys.path for imports
        repo_root = skill_py_path.parent.parent.parent
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))
        spec.loader.exec_module(module)
    except Exception as exc:
        print(f"  {WARN} Failed to import {skill_py_path}: {exc}", file=sys.stderr)
        return None

    skill_obj = getattr(module, "skill", None)
    if skill_obj is None:
        return None

    # Coerce to SkillDefinition if needed
    skill: SkillDefinition
    if isinstance(skill_obj, SkillDefinition):
        skill = skill_obj
    else:
        try:
            skill = SkillDefinition.model_validate(skill_obj)
        except Exception:
            return None

    tools: list[str] = []
    for tool in skill.tools:
        if tool.definition and tool.definition.name:
            tools.append(tool.definition.name)

    hooks: list[str] = []
    if skill.hooks:
        for field_name in [
            "on_load", "on_unload", "on_session_start", "on_session_end",
            "on_before_message", "on_after_response", "on_memory_flush", "on_tick",
        ]:
            if getattr(skill.hooks, field_name, None) is not None:
                hooks.append(field_name)

    return {
        "name": skill.name,
        "description": skill.description,
        "version": skill.version,
        "tools": tools,
        "hooks": hooks,
        "tick_interval": skill.tick_interval,
    }


def read_pkg_json(pkg_json_path: Path) -> dict[str, str] | None:
    """Read metadata from package.json."""
    try:
        data = json.loads(pkg_json_path.read_text(encoding="utf-8"))
        return {
            "name": data.get("name", ""),
            "description": data.get("description", ""),
            "version": data.get("version", ""),
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    dev_dir = Path(__file__).resolve().parent.parent
    root_dir = dev_dir.parent
    skills_dir = root_dir / "skills"
    output_path = root_dir / "skills-catalog.json"

    print(file=sys.stderr)
    print(bold("AlphaHuman Skills Catalog Builder"), file=sys.stderr)
    print(file=sys.stderr)

    # 1. Read all subdirectories of skills/
    if not skills_dir.is_dir():
        print(f"  {FAIL} Cannot read skills directory: {skills_dir}", file=sys.stderr)
        sys.exit(1)

    entries = sorted(
        e.name
        for e in skills_dir.iterdir()
        if e.is_dir() and not e.name.startswith(".")
    )

    if not entries:
        print(f"  {WARN} No skill directories found in {skills_dir}", file=sys.stderr)
        sys.exit(0)

    print(
        f"  Found {len(entries)} skill director{'y' if len(entries) == 1 else 'ies'}.",
        file=sys.stderr,
    )
    print(file=sys.stderr)

    catalog_entries: list[dict[str, Any]] = []
    seen_names: set[str] = set()
    warnings = 0

    for dir_name in entries:
        dir_path = skills_dir / dir_name
        rel_path = f"skills/{dir_name}"

        # 2. Detect execution style
        style = detect_execution_style(dir_path)

        # 3. Parse metadata
        skill_data = extract_skill_py(dir_path / "skill.py")
        pkg_data = read_pkg_json(dir_path / "package.json")

        # 4. Determine name (priority: skill.py > package.json > dirName)
        name = (
            (skill_data or {}).get("name")
            or (pkg_data or {}).get("name")
            or dir_name
        )

        # 5. Check for duplicates
        if name in seen_names:
            print(f'  {WARN} Duplicate skill name: "{name}" (in {rel_path})', file=sys.stderr)
            warnings += 1
        seen_names.add(name)

        # 6. Determine description
        description = (
            (skill_data or {}).get("description")
            or (pkg_data or {}).get("description")
            or ""
        )
        if not description:
            print(f"  {WARN} No description found for {rel_path}", file=sys.stderr)
            warnings += 1

        # 7. Build entry
        entry: dict[str, Any] = {
            "name": name,
            "description": description,
            "icon": None,
            "executionStyle": style,
            "version": (
                (skill_data or {}).get("version")
                or (pkg_data or {}).get("version")
                or None
            ),
            "tools": (skill_data or {}).get("tools", []),
            "hooks": (skill_data or {}).get("hooks", []),
            "tickInterval": (skill_data or {}).get("tick_interval"),
            "path": rel_path,
        }

        catalog_entries.append(entry)
        print(f"  {PASS} {name} {dim(f'({style})')}", file=sys.stderr)

    # 8. Sort alphabetically
    catalog_entries.sort(key=lambda e: e["name"])

    # 9. Write catalog
    catalog = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
        "skills": catalog_entries,
    }

    output_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")

    # 10. Summary
    print(file=sys.stderr)
    print(bold("Summary"), file=sys.stderr)
    print(file=sys.stderr)
    print(f"  Skills:   {len(catalog_entries)}", file=sys.stderr)
    print(f"  {WARN} Warnings: {warnings}", file=sys.stderr)

    try:
        rel_output = output_path.relative_to(Path.cwd())
    except ValueError:
        rel_output = output_path
    print(f"  Output:   {rel_output}", file=sys.stderr)
    print(file=sys.stderr)

    by_style: dict[str, int] = {}
    for e in catalog_entries:
        by_style[e["executionStyle"]] = by_style.get(e["executionStyle"], 0) + 1
    for style, count in sorted(by_style.items()):
        print(f"    {style}: {count}", file=sys.stderr)
    print(file=sys.stderr)


if __name__ == "__main__":
    main()
