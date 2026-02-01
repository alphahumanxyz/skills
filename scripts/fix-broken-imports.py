#!/usr/bin/env python3
"""
Fix broken imports in split files.

The split script broke import statements by cutting them in the middle.
This script fixes them by removing incomplete import lines and fixing indentation.
"""

import re
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent


def fix_telegram_message_api_imports(file_path: Path) -> bool:
    """Fix imports in telegram message_api split files."""
    content = file_path.read_text(encoding="utf-8")
    original = content
    
    # Remove broken incomplete import lines
    lines = content.splitlines()
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Remove incomplete import statements
        if re.match(r'^from telethon\.tl\.(types|functions\.(messages|channels)) import \($', line):
            # Skip this line and any indented lines after it until we find a proper import
            i += 1
            while i < len(lines) and (lines[i].startswith('    ') or lines[i].strip() == ''):
                i += 1
            continue
        
        # Fix indented imports that shouldn't be indented
        if line.startswith('    from ') and 'import' in line:
            fixed_lines.append(line.lstrip())
        else:
            fixed_lines.append(line)
        
        i += 1
    
    # Add proper imports at the top
    if 'from telethon' not in '\n'.join(fixed_lines[:20]):
        # Determine which imports are needed based on file content
        imports_to_add = []
        
        if any('ReactionEmoji' in line or 'SendReactionRequest' in line for line in fixed_lines):
            imports_to_add.extend([
                'from telethon.tl.types import ReactionEmoji',
                'from telethon.tl.functions.messages import SendReactionRequest',
            ])
        
        if any('GetHistoryRequest' in line or 'Message' in line for line in fixed_lines):
            imports_to_add.extend([
                'from telethon.tl.types import Message',
                'from telethon.tl.functions.messages import GetHistoryRequest',
            ])
        
        if any('EditMessageRequest' in line for line in fixed_lines):
            imports_to_add.append('from telethon.tl.functions.messages import EditMessageRequest')
        
        if any('DeleteMessagesRequest' in line for line in fixed_lines):
            imports_to_add.append('from telethon.tl.functions.messages import DeleteMessagesRequest')
        
        if any('ForwardMessagesRequest' in line for line in fixed_lines):
            imports_to_add.append('from telethon.tl.functions.messages import ForwardMessagesRequest')
        
        if any('UpdatePinnedMessageRequest' in line for line in fixed_lines):
            imports_to_add.append('from telethon.tl.functions.messages import UpdatePinnedMessageRequest')
        
        if any('ReadHistoryRequest' in line for line in fixed_lines):
            imports_to_add.append('from telethon.tl.functions.messages import ReadHistoryRequest')
        
        if any('GetForumTopicsRequest' in line for line in fixed_lines):
            imports_to_add.append('from telethon.tl.functions.channels import GetForumTopicsRequest')
        
        # Add common imports
        common_imports = [
            'from __future__ import annotations',
            'import logging',
            'from ..client.telethon_client import get_client',
            'from ..client.builders import build_message',
            'from ..state import store',
            'from ..state.types import TelegramMessage',
            'from ..helpers import enforce_rate_limit',
        ]
        
        # Find where to insert imports (after __future__ import if present)
        insert_idx = 0
        for idx, line in enumerate(fixed_lines):
            if line.startswith('from __future__'):
                insert_idx = idx + 1
                break
        
        # Remove duplicates and add imports
        all_imports = common_imports + imports_to_add
        seen = set()
        unique_imports = []
        for imp in all_imports:
            if imp not in seen:
                unique_imports.append(imp)
                seen.add(imp)
        
        # Insert imports
        for imp in reversed(unique_imports):
            if imp not in '\n'.join(fixed_lines[:insert_idx + 10]):
                fixed_lines.insert(insert_idx, imp)
    
    fixed_content = '\n'.join(fixed_lines)
    if fixed_content != original:
        file_path.write_text(fixed_content, encoding="utf-8")
        return True
    return False


def fix_kitchen_sink_imports(file_path: Path) -> bool:
    """Fix imports in kitchen-sink split files."""
    content = file_path.read_text(encoding="utf-8")
    original = content
    
    lines = content.splitlines()
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Remove incomplete import statements
        if re.match(r'^from dev\.types\.(skill_types|setup_types) import \($', line):
            i += 1
            while i < len(lines) and (lines[i].startswith('    ') or lines[i].strip() == ''):
                i += 1
            continue
        
        # Fix indented imports
        if line.startswith('    from ') and 'import' in line:
            fixed_lines.append(line.lstrip())
        else:
            fixed_lines.append(line)
        
        i += 1
    
    # Add proper imports if missing
    if 'from dev.types' not in '\n'.join(fixed_lines[:20]):
        imports = [
            'from __future__ import annotations',
            'from typing import Any',
            'from dev.types.skill_types import SkillContext, SkillDefinition, SkillHooks, SkillTool, ToolDefinition, ToolResult',
            'from dev.types.setup_types import SetupField, SetupFieldError, SetupFieldOption, SetupResult, SetupStep',
        ]
        
        insert_idx = 0
        for idx, line in enumerate(fixed_lines):
            if line.startswith('from __future__'):
                insert_idx = idx + 1
                break
        
        for imp in reversed(imports):
            if imp.split(' import')[0] not in '\n'.join(fixed_lines[:insert_idx + 10]):
                fixed_lines.insert(insert_idx, imp)
    
    fixed_content = '\n'.join(fixed_lines)
    if fixed_content != original:
        file_path.write_text(fixed_content, encoding="utf-8")
        return True
    return False


def fix_skill_generator_imports(file_path: Path) -> bool:
    """Fix imports in skill-generator split files."""
    content = file_path.read_text(encoding="utf-8")
    original = content
    
    lines = content.splitlines()
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Remove incomplete import statements
        if re.match(r'^from dev\.(types\.skill_types|validate\.validator|security\.scan_secrets) import \($', line):
            i += 1
            while i < len(lines) and (lines[i].startswith('        ') or lines[i].strip() == ''):
                i += 1
            continue
        
        # Fix indented imports
        if line.startswith('        from ') and 'import' in line:
            fixed_lines.append(line.lstrip())
        else:
            fixed_lines.append(line)
        
        i += 1
    
    # Add proper imports if missing
    if 'from dev.types' not in '\n'.join(fixed_lines[:20]):
        imports = [
            'from __future__ import annotations',
            'from typing import Any',
            'from dev.types.skill_types import SkillDefinition, SkillContext, SkillHooks, SkillTool, ToolDefinition, ToolResult',
        ]
        
        # Add specific imports based on content
        content_str = '\n'.join(fixed_lines)
        if 'validate_skill_py' in content_str:
            imports.append('from dev.validate.validator import validate_skill_py, SkillResult as ValidatorResult')
        if 'scan_content' in content_str:
            imports.append('from dev.security.scan_secrets import scan_content')
        
        insert_idx = 0
        for idx, line in enumerate(fixed_lines):
            if line.startswith('from __future__'):
                insert_idx = idx + 1
                break
        
        for imp in reversed(imports):
            if imp.split(' import')[0] not in '\n'.join(fixed_lines[:insert_idx + 10]):
                fixed_lines.insert(insert_idx, imp)
    
    fixed_content = '\n'.join(fixed_lines)
    if fixed_content != original:
        file_path.write_text(fixed_content, encoding="utf-8")
        return True
    return False


def main():
    """Fix all broken imports."""
    fixed_count = 0
    
    # Fix telegram message_api files
    telegram_api_dir = ROOT / "skills" / "telegram" / "api"
    for file_path in telegram_api_dir.glob("message_api_*.py"):
        if fix_telegram_message_api_imports(file_path):
            print(f"Fixed: {file_path.relative_to(ROOT)}")
            fixed_count += 1
    
    # Fix kitchen-sink files
    kitchen_sink_dir = ROOT / "examples" / "kitchen-sink"
    for file_path in kitchen_sink_dir.glob("skill_*.py"):
        if fix_kitchen_sink_imports(file_path):
            print(f"Fixed: {file_path.relative_to(ROOT)}")
            fixed_count += 1
    
    # Fix skill-generator files
    skill_gen_dir = ROOT / "skills" / "skill-generator"
    for file_path in skill_gen_dir.glob("skill_*.py"):
        if fix_skill_generator_imports(file_path):
            print(f"Fixed: {file_path.relative_to(ROOT)}")
            fixed_count += 1
    
    print(f"\n✅ Fixed {fixed_count} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
