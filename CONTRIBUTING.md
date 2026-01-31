# Contributing to AlphaHuman Skills

Thank you for contributing to the AlphaHuman skills ecosystem. This guide covers everything you need to submit a skill.

## Ways to Contribute

1. **Create a new skill** — Add capabilities to the AlphaHuman agent
2. **Improve an existing skill** — Better instructions, more examples, bug fixes
3. **Improve tooling** — Enhance dev tools, CI, documentation
4. **Add examples** — Show patterns others can follow

## Creating a New Skill

### 1. Setup

```bash
# Fork and clone
git clone https://github.com/YOUR-USERNAME/alphahuman-skills.git
cd alphahuman-skills

# Install dev tools
cd dev && npm install

# Create a branch
git checkout -b skill/my-skill-name
```

### 2. Scaffold

```bash
npx tsx scaffold/new-skill.ts
```

Or manually copy `TEMPLATE/` to `skills/your-skill-name/`.

### 3. Write SKILL.md

Every skill needs a `SKILL.md` with:

- **YAML frontmatter**: `name` (lowercase-hyphens) and `description` (one sentence)
- **Overview**: What the skill does (2-3 sentences)
- **When to Use**: At least 3 trigger conditions
- **Instructions**: Numbered, detailed, unambiguous steps
- **Output Format**: Exact format with placeholders
- **Examples**: At least 2 realistic user/agent exchanges
- **Limitations**: Honest list of what the skill can't do

### 4. Write skill.ts (Optional)

If your skill needs custom tools, periodic tasks, or message transforms:

- Default export a `SkillDefinition`
- `name` must match directory name
- `version` must be semver (X.Y.Z)
- Tools need JSON Schema parameters and return `{ content: string }`
- `tickInterval` minimum is 1000ms

### 5. Validate

```bash
cd dev

# Structure and frontmatter checks
npm run validate

# Type checking
npx tsc --noEmit

# Security scan
npm run scan

# Test harness (coded skills)
npx tsx harness/runner.ts ../skills/my-skill --verbose
```

### 6. Submit

```bash
git add skills/my-skill/
git commit -m "Add my-skill"
git push -u origin skill/my-skill
```

Open a pull request. Fill out the PR template completely.

## Naming Conventions

- **Lowercase only**: `price-tracker`, not `Price-Tracker`
- **Hyphens for spaces**: `on-chain-lookup`, not `on_chain_lookup`
- **Descriptive**: `whale-watcher`, not `ww`
- **No prefixes**: `price-tracker`, not `skill-price-tracker`
- **Directory match**: `name` in SKILL.md and skill.ts must match the directory name

## Code Standards

### skill.ts

- No npm dependencies — skills must be self-contained
- No `eval()`, `Function()`, or dynamic code execution
- No direct filesystem access — use `ctx.readData()` / `ctx.writeData()`
- No network requests — use platform-provided tools
- No `process.env` access
- No `localStorage` / `sessionStorage`
- All hooks must complete within 10 seconds
- Use `try/catch` for operations that might fail

### SKILL.md

- Clear, specific instructions the AI can follow literally
- Include financial disclaimers for any skill that touches prices, yields, or investment
- Show complete agent responses in examples (not placeholders)
- State limitations honestly

## What Gets Rejected

1. **Missing sections** — SKILL.md must have all required sections
2. **Vague instructions** — "Try to find prices" is too vague
3. **Hardcoded secrets** — API keys, tokens, private keys in code
4. **Dangerous code** — eval(), Function(), dynamic requires
5. **Name mismatches** — Directory name must match frontmatter and skill.ts name
6. **Failing validation** — `npm run validate` must pass
7. **Security issues** — `npm run scan` must not report errors
8. **No examples** — SKILL.md must show realistic usage

## PR Review Process

1. **Automated CI** runs validation, type checking, security scanning, and test harness
2. **Maintainer review** checks quality, clarity, and safety
3. **Feedback round** — you may be asked to make changes
4. **Merge** — skill becomes available to AlphaHuman users

## Getting Help

- Check [docs/](docs/) for detailed guides
- Use [prompts/](prompts/) if you need help writing SKILL.md
- Open an issue for questions or feature requests
