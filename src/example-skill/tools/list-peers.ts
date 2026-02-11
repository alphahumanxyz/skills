/** list-peers tool — discover other skills via skills.list() */
export const listPeersTool: ToolDefinition = {
  name: 'list-peers',
  description: 'List all registered skills in the runtime.',
  input_schema: { type: 'object', properties: {} },
  async execute(_args: Record<string, unknown>): Promise<string> {
    const peers = skills.list();
    return JSON.stringify({ count: peers.length, skills: peers });
  },
};
