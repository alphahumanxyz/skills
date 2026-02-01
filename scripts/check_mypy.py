#!/usr/bin/env python3
"""
Check mypy type errors across all Python files in the skills directory.

Usage:
    python scripts/check_mypy.py
    python scripts/check_mypy.py --summary
    python scripts/check_mypy.py --fix-common
"""

import argparse
import subprocess
import sys
from pathlib import Path
from collections import defaultdict


def run_mypy(exclude: list[str] | None = None) -> tuple[int, str]:
  """Run mypy and return error count and output."""
  cmd = ["python", "-m", "mypy", "skills", "--config-file", "pyproject.toml"]
  if exclude:
    for item in exclude:
      cmd.extend(["--exclude", item])

  result = subprocess.run(cmd, capture_output=True, text=True, cwd=Path.cwd())
  return result.returncode, result.stdout + result.stderr


def categorize_errors(output: str) -> dict[str, list[str]]:
  """Categorize mypy errors by type."""
  categories = defaultdict(list)

  for line in output.split("\n"):
    if "error:" in line:
      error_type = line.split("error:")[1].strip().split("[")[0].strip()
      categories[error_type].append(line)

  return dict(categories)


def print_summary(categories: dict[str, list[str]]):
  """Print a summary of error categories."""
  print("=" * 60)
  print("MYPY ERROR SUMMARY")
  print("=" * 60)

  total = sum(len(errors) for errors in categories.values())
  print(f"\nTotal errors: {total}\n")

  # Sort by count
  sorted_cats = sorted(categories.items(), key=lambda x: len(x[1]), reverse=True)

  for error_type, errors in sorted_cats:
    count = len(errors)
    print(f"{error_type}: {count}")
    if count <= 5:
      for err in errors[:3]:
        print(f"  {err}")
    print()


def main():
  parser = argparse.ArgumentParser(description="Check mypy type errors")
  parser.add_argument("--summary", action="store_true", help="Show error summary by category")
  parser.add_argument("--exclude", nargs="+", default=["skillcoder"], help="Directories to exclude")

  args = parser.parse_args()

  exit_code, output = run_mypy(exclude=args.exclude)

  if args.summary:
    categories = categorize_errors(output)
    print_summary(categories)
  else:
    print(output)

  sys.exit(exit_code)


if __name__ == "__main__":
  main()
