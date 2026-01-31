# Publishing a Skill

How to submit your skill to the AlphaHuman Skills repository.

## Prerequisites

1. Your skill passes validation: `cd dev && npm run validate`
2. Your skill passes the security scan: `cd dev && npm run scan`
3. If coded, the test harness runs without errors: `npx tsx harness/runner.ts ../skills/my-skill`

## Step 1: Fork & Branch

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR-USERNAME/alphahuman-skills.git
cd alphahuman-skills
git checkout -b skill/my-skill-name
```

## Step 2: Create Your Skill

Either use the scaffolder or create files manually:

```bash
cd dev && npm install
npx tsx scaffold/new-skill.ts my-skill-name
```

Or manually:
```bash
mkdir skills/my-skill-name
# Create SKILL.md and optionally skill.ts
```

## Step 3: Validate

```bash
cd dev

# Run all checks
npm run validate

# Type-check (if you have skill.ts)
npx tsc --noEmit

# Security scan
npm run scan

# Test harness (coded skills)
npx tsx harness/runner.ts ../skills/my-skill-name --verbose
```

## Step 4: Submit PR

```bash
git add skills/my-skill-name/
git commit -m "Add my-skill-name skill"
git push -u origin skill/my-skill-name
```

Open a pull request on GitHub. The PR template will guide you through the submission checklist.

## What Happens Next

1. **CI runs automatically** — validates structure, types, security, and runs the test harness
2. **Maintainer review** — a human reviews the skill for quality and safety
3. **Feedback** — you may get requests for changes
4. **Merge** — once approved, the skill is available to all AlphaHuman users

## Naming Conventions

| Rule | Example | Counter-example |
|------|---------|-----------------|
| Lowercase only | `price-tracker` | `Price-Tracker` |
| Hyphens for spaces | `on-chain-lookup` | `on_chain_lookup` |
| Descriptive | `whale-watcher` | `ww` |
| No prefixes | `price-tracker` | `skill-price-tracker` |
| Match directory | `name: price-tracker` in `skills/price-tracker/` | Mismatch |

## Required Files

| File | Required? | Description |
|------|-----------|-------------|
| `SKILL.md` | Yes | Instructions with YAML frontmatter |
| `skill.ts` | No | Code for hooks, tools, state |

## SKILL.md Requirements

- Valid YAML frontmatter with `name` and `description`
- Name matches directory name
- Non-empty markdown body with instructions
- Sections: Overview, When to Use, Instructions, Output Format, Examples, Limitations

## skill.ts Requirements (if present)

- Default export of `SkillDefinition`
- `name` matches directory name
- `version` follows semver (X.Y.Z)
- Hooks are async functions
- Tools have valid JSON Schema parameters
- Tools return `{ content: string }`
- `tickInterval` >= 1000ms

## Common Rejection Reasons

1. **Missing sections** in SKILL.md (especially Examples or Limitations)
2. **Vague instructions** the AI can't follow unambiguously
3. **Hardcoded secrets** in skill.ts
4. **eval() or dynamic code** execution
5. **Direct network requests** (use ctx methods instead)
6. **Name mismatch** between directory and frontmatter/skill.ts
7. **No examples** showing expected agent behavior
8. **Missing disclaimers** for financial/trading skills

## Updating an Existing Skill

1. Make changes on a new branch
2. Bump the `version` in skill.ts (if applicable)
3. Submit a PR with clear description of what changed
4. CI validates the updated skill
