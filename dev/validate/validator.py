"""
Validate all skills in the repository.

Scans ../skills/ and ../examples/ for directories containing skill.py,
validates structure via dynamic import and Pydantic validation.

Usage:
    python -m dev.validate.validator [--verbose]

Exit code 1 if any errors found.
"""

from __future__ import annotations

import importlib.util
import re
import sys
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


NAME_PATTERN = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$")
SEMVER_PATTERN = re.compile(r"^\d+\.\d+\.\d+")

VALID_HOOKS = {
    "on_load",
    "on_unload",
    "on_session_start",
    "on_session_end",
    "on_before_message",
    "on_after_response",
    "on_memory_flush",
    "on_tick",
}

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


class SkillResult:
    def __init__(self, name: str) -> None:
        self.name = name
        self.errors: list[str] = []
        self.warnings: list[str] = []


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def validate_skill_py(skill_py_path: Path, dir_name: str) -> SkillResult:
    """Validate a skill.py file via dynamic import and structural checks."""
    result = SkillResult(str(skill_py_path))

    if not skill_py_path.exists():
        # skill.py is optional for prompt-only skills
        return result

    # Dynamic import
    try:
        spec = importlib.util.spec_from_file_location("_skill_validate", skill_py_path)
        if spec is None or spec.loader is None:
            result.errors.append("Cannot create module spec for skill.py")
            return result
        module = importlib.util.module_from_spec(spec)
        # Add repo root to sys.path for imports
        repo_root = skill_py_path.parent.parent.parent
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))
        spec.loader.exec_module(module)
    except Exception as exc:
        result.errors.append(f"Failed to import skill.py: {exc}")
        return result

    skill_obj = getattr(module, "skill", None)
    if skill_obj is None:
        result.errors.append("skill.py must export a `skill` variable")
        return result

    # Validate via Pydantic if not already a SkillDefinition
    skill: SkillDefinition
    if isinstance(skill_obj, SkillDefinition):
        skill = skill_obj
    else:
        try:
            skill = SkillDefinition.model_validate(skill_obj)
        except Exception as exc:
            result.errors.append(f"Invalid SkillDefinition: {exc}")
            return result

    # --- Validate top-level fields ---
    if not skill.name or not isinstance(skill.name, str):
        result.errors.append("Missing or invalid `name` (must be a non-empty string)")
    else:
        if not NAME_PATTERN.match(skill.name):
            result.errors.append(
                f'Invalid name "{skill.name}" — must be lowercase-hyphens (e.g., "my-skill")'
            )
        if skill.name != dir_name:
            result.warnings.append(
                f'Skill name "{skill.name}" does not match directory "{dir_name}"'
            )

    if not skill.description or not isinstance(skill.description, str):
        result.errors.append("Missing or invalid `description` (must be a non-empty string)")

    if not skill.version or not isinstance(skill.version, str):
        result.errors.append("Missing or invalid `version` (must be a non-empty string)")
    elif not SEMVER_PATTERN.match(skill.version):
        result.warnings.append(
            f'Version "{skill.version}" does not match semver pattern (X.Y.Z)'
        )

    # --- Validate hooks ---
    if skill.hooks:
        hooks_dict = skill.hooks.model_dump(exclude_none=True)
        for hook_name, hook_fn in hooks_dict.items():
            if hook_name not in VALID_HOOKS:
                result.warnings.append(
                    f'Unknown hook "{hook_name}" — will be ignored by the runtime'
                )
        # Also check the original hooks object for callable validation
        if skill.hooks:
            for field_name in VALID_HOOKS:
                val = getattr(skill.hooks, field_name, None)
                if val is not None and not callable(val):
                    result.errors.append(
                        f'Hook "{field_name}" must be callable, got {type(val).__name__}'
                    )

    # --- Validate tools ---
    if skill.tools:
        tool_names: set[str] = set()
        for i, tool in enumerate(skill.tools):
            prefix = f"tools[{i}]"

            if not tool.definition:
                result.errors.append(f"{prefix}: missing `definition`")
                continue

            defn = tool.definition
            if not defn.name or not isinstance(defn.name, str):
                result.errors.append(f"{prefix}: definition must have a `name` string")
            else:
                if defn.name in tool_names:
                    result.errors.append(f'{prefix}: duplicate tool name "{defn.name}"')
                tool_names.add(defn.name)

            if not defn.description or not isinstance(defn.description, str):
                result.warnings.append(
                    f'{prefix} ("{defn.name or "?"}"): missing description'
                )

            params = defn.parameters
            if not params or params.get("type") != "object":
                result.errors.append(
                    f'{prefix} ("{defn.name or "?"}"): parameters must be {{"type": "object", ...}}'
                )

            if not callable(tool.execute):
                result.errors.append(
                    f'{prefix} ("{defn.name or "?"}"): missing `execute` callable'
                )

    # --- Validate tickInterval ---
    if skill.tick_interval is not None:
        if not isinstance(skill.tick_interval, int):
            result.errors.append("`tick_interval` must be an integer")
        elif skill.tick_interval < 1000:
            result.errors.append(
                f"tick_interval {skill.tick_interval}ms is below minimum (1000ms)"
            )

    return result


# ---------------------------------------------------------------------------
# Directory scanning
# ---------------------------------------------------------------------------


def find_skill_dirs(base_dir: Path) -> list[Path]:
    """Find directories containing skill.py under base_dir."""
    dirs: list[Path] = []
    if not base_dir.is_dir():
        return dirs
    for entry in sorted(base_dir.iterdir()):
        if not entry.is_dir() or entry.name.startswith("."):
            continue
        if (entry / "skill.py").exists():
            dirs.append(entry)
    return dirs


def find_example_skill_dirs(base_dir: Path) -> list[Path]:
    """Find skill directories under examples/ (may be nested one level)."""
    dirs: list[Path] = []
    if not base_dir.is_dir():
        return dirs
    for category in sorted(base_dir.iterdir()):
        if not category.is_dir() or category.name.startswith("."):
            continue
        # Check if category itself has skill.py
        if (category / "skill.py").exists():
            dirs.append(category)
            continue
        # Check subdirectories
        for entry in sorted(category.iterdir()):
            if entry.is_dir() and (entry / "skill.py").exists():
                dirs.append(entry)
    return dirs


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    verbose = "--verbose" in sys.argv
    # Determine repo root (dev/ is one level below repo root)
    dev_dir = Path(__file__).resolve().parent.parent
    root_dir = dev_dir.parent

    print()
    print(bold("AlphaHuman Skills Validator"))
    print()

    # Find all skill directories
    skill_dirs = [
        *find_skill_dirs(root_dir / "skills"),
        *find_example_skill_dirs(root_dir / "examples"),
    ]

    if not skill_dirs:
        print("  No skills found to validate.")
        sys.exit(0)

    print(f"  Found {len(skill_dirs)} skill(s) to validate.")
    print()

    results: list[SkillResult] = []

    for skill_dir in skill_dirs:
        rel_path = skill_dir.relative_to(root_dir)
        skill_py_path = skill_dir / "skill.py"

        print(bold(f"  {rel_path}"))

        result = validate_skill_py(skill_py_path, skill_dir.name)
        result.name = str(rel_path)
        results.append(result)

        all_errors = result.errors
        all_warnings = result.warnings

        if not all_errors and not all_warnings:
            print(f"    {PASS} All checks passed")
        else:
            for err in all_errors:
                print(f"    {FAIL} {err}")
            for wrn in all_warnings:
                print(f"    {WARN} {wrn}")
        print()

    # --- Summary ---
    print(bold("Summary"))
    print()

    total_errors = sum(len(r.errors) for r in results)
    total_warnings = sum(len(r.warnings) for r in results)
    total_passed = sum(1 for r in results if not r.errors)

    print(f"  Skills:   {len(results)}")
    print(f"  {PASS} Passed:   {total_passed}")
    print(f"  {FAIL} Errors:   {total_errors}")
    print(f"  {WARN} Warnings: {total_warnings}")
    print()

    if verbose:
        for r in results:
            if r.errors:
                print(f"  {FAIL} {r.name}:")
                for e in r.errors:
                    print(f"      {e}")
        print()

    sys.exit(1 if total_errors > 0 else 0)


if __name__ == "__main__":
    main()
