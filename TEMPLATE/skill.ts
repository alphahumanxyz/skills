import type { SkillDefinition, SkillContext } from "@alphahuman/skill-types";

const skill: SkillDefinition = {
  name: "my-skill",
  description: "Brief description of what this skill does",
  version: "1.0.0",

  hooks: {
    async onLoad(ctx: SkillContext) {
      ctx.log("Skill loaded");
    },

    async onUnload(ctx: SkillContext) {
      ctx.log("Skill unloaded");
    },

    // async onSessionStart(ctx: SkillContext, sessionId: string) {
    //   // Called when a new chat session starts
    // },

    // async onSessionEnd(ctx: SkillContext, sessionId: string) {
    //   // Called when a session ends
    // },

    // async onBeforeMessage(ctx: SkillContext, message: string) {
    //   // Called before the AI processes a user message.
    //   // Return a string to transform the message, or void to pass through.
    // },

    // async onAfterResponse(ctx: SkillContext, response: string) {
    //   // Called after the AI generates a response.
    //   // Return a string to transform the response, or void to pass through.
    // },

    // async onMemoryFlush(ctx: SkillContext) {
    //   // Called before memory compaction
    // },

    // async onTick(ctx: SkillContext) {
    //   // Called periodically (see tickInterval below)
    // },
  },

  // Custom tools this skill provides to the AI
  // tools: [
  //   {
  //     definition: {
  //       name: "my_tool",
  //       description: "What this tool does",
  //       parameters: {
  //         type: "object",
  //         properties: {
  //           arg1: { type: "string", description: "First argument" },
  //         },
  //         required: ["arg1"],
  //       },
  //     },
  //     async execute(args) {
  //       return { content: `Result: ${args.arg1}` };
  //     },
  //   },
  // ],

  // Tick interval in ms (uncomment to enable periodic onTick calls)
  // tickInterval: 60_000, // every minute
};

export default skill;
