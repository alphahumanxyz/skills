# Getting Started

Build your first AlphaHuman skill in under 5 minutes.

## Prerequisites

- Node.js 22+ installed
- Git
- A text editor

## 1. Clone the Repository

```bash
git clone https://github.com/your-org/alphahuman-skills.git
cd alphahuman-skills
```

## 2. Install Dev Tools

```bash
cd dev
npm install
```

This installs 3 packages: `typescript`, `tsx`, and `yaml`.

## 3. Create a Skill

### Option A: Interactive Scaffolder

```bash
npx tsx scaffold/new-skill.ts
```

Follow the prompts to name your skill and choose features.

### Option B: Manual Copy

```bash
cp -r TEMPLATE/ skills/my-skill/
```

Edit `skills/my-skill/SKILL.md` with your instructions.

## 4. Write Your SKILL.md

This is the core of your skill. Fill in:

```markdown
---
name: my-skill
description: What this skill does in one sentence.
---

# My Skill

## Overview
What it does.

## When to Use
When the user asks about X, Y, or Z.

## Instructions
1. Step one.
2. Step two.

## Output Format
How to format responses.

## Examples
Show example conversations.

## Limitations
What it can't do.
```

See `examples/typescript/prompt-only/SKILL.md` for a complete example.

## 5. (Optional) Add Code

If your skill needs custom tools, periodic tasks, or message transforms, add a `skill.ts`:

```typescript
import type { SkillDefinition, SkillContext } from "@alphahuman/skill-types";

const skill: SkillDefinition = {
  name: "my-skill",
  description: "What this skill does",
  version: "1.0.0",

  tools: [
    {
      definition: {
        name: "my_tool",
        description: "What the tool does",
        parameters: {
          type: "object",
          properties: {
            input: { type: "string", description: "Input value" },
          },
          required: ["input"],
        },
      },
      async execute(args) {
        const { input } = args as { input: string };
        return { content: `Result: ${input}` };
      },
    },
  ],
};

export default skill;
```

See `examples/typescript/simple-tool/` for a complete example.

## 6. Test Your Skill

### Validate structure

```bash
cd dev
npm run validate
```

### Run the test harness (coded skills only)

```bash
npx tsx harness/runner.ts ../skills/my-skill --verbose
```

### Security scan

```bash
npm run scan
```

## 7. Submit a Pull Request

```bash
git checkout -b skill/my-skill
git add skills/my-skill/
git commit -m "Add my-skill"
git push -u origin skill/my-skill
```

Open a pull request. CI will automatically validate your skill.

## Next Steps

- [Architecture](./architecture.md) — How the skill system works
- [API Reference](./api-reference.md) — SkillContext, hooks, tools
- [Lifecycle](./lifecycle.md) — Hook timing and execution order
- [Testing](./testing.md) — Test harness deep dive
- [Publishing](./publishing.md) — PR workflow and requirements
