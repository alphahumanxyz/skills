// Tool: list_networks — list configured blockchain networks

/** Fallback so list_networks and get_balance always have at least Ethereum (avoids relying on init/setup). */
const ETH_MAINNET = {
  chain_id: '1',
  name: 'Ethereum Mainnet',
  rpc_url: 'https://eth.llamarpc.com',
  chain_type: 'evm' as const,
};

export const listNetworksTool = {
  name: 'list_networks',
  description: 'List all configured EVM blockchain networks with RPC endpoints.',
  input_schema: { type: 'object' as const, properties: {} },
  async execute(): Promise<string> {
    const s = (globalThis as any).getState() as {
      config: {
        networks: Array<{ chain_id: string; name: string; rpc_url: string; chain_type: string }>;
      };
    };
    let networks = s.config.networks;
    if (!networks || networks.length === 0) {
      networks = [ETH_MAINNET];
      s.config.networks = networks;
      const state = (globalThis as any).state as { set?: (key: string, value: unknown) => void };
      if (state?.set) state.set('config', s.config);
    }
    const out = networks.map(
      (n: { chain_id: string; name: string; rpc_url: string; chain_type: string }) => ({
        chain_id: n.chain_id,
        name: n.name,
        rpc_url: n.rpc_url,
        chain_type: n.chain_type,
      })
    );
    return JSON.stringify({ networks: out }, null, 2);
  },
};
