// wallet/index.ts — Orchestrator
import './setup';
import './state';
import { getBalanceTool, listNetworksTool, listWalletsTool } from './tools';
import { DEFAULT_NETWORKS, type NetworkConfig } from './types';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  const s = globalThis.getWalletSkillState();
  const saved = state.get('config') as {
    walletAddresses?: string[];
    networks?: NetworkConfig[];
  } | null;
  if (saved?.walletAddresses?.length) {
    s.config.walletAddresses = saved.walletAddresses;
  }
  if (saved?.networks?.length) {
    s.config.networks = saved.networks;
  }
  if (s.config.networks.length === 0) {
    const networks = Array.isArray(DEFAULT_NETWORKS) ? DEFAULT_NETWORKS : [];
    const eth = networks.find(n => n.chain_id === '1');
    if (eth) {
      s.config.networks = [eth];
    }
  }
}

async function start(): Promise<void> {
  const s = globalThis.getWalletSkillState();
  s.isRunning = true;
  publishState();
}

async function stop(): Promise<void> {
  const s = globalThis.getWalletSkillState();
  s.isRunning = false;
  state.setPartial({ connection_status: 'disconnected', status: 'stopped' });
}

async function onLoad(params: {
  walletAddress?: string;
  walletAddresses?: string[];
}): Promise<void> {
  const s = globalThis.getWalletSkillState();
  if (params.walletAddress) {
    if (!s.config.walletAddresses.includes(params.walletAddress)) {
      s.config.walletAddresses = [params.walletAddress];
      state.set('config', s.config);
    }
  }
  if (params.walletAddresses?.length) {
    s.config.walletAddresses = params.walletAddresses;
    state.set('config', s.config);
  }
  state.setPartial({ walletCount: s.config.walletAddresses.length });
}

// ---------------------------------------------------------------------------
// State publishing
// ---------------------------------------------------------------------------

async function publishState(): Promise<void> {
  const s = globalThis.getWalletSkillState();
  state.setPartial({
    connection_status: 'connected',
    status: 'running',
    walletCount: s.config.walletAddresses.length,
    networkCount: s.config.networks.length,
  });
}

// ---------------------------------------------------------------------------
// Expose on globalThis for bundle compatibility
// ---------------------------------------------------------------------------

const _g = globalThis as Record<string, unknown>;
_g.init = init;
_g.start = start;
_g.stop = stop;
_g.onLoad = onLoad;
_g.onSetupStart = globalThis.walletSetup.onSetupStart;
_g.onSetupSubmit = globalThis.walletSetup.onSetupSubmit;
_g.onSetupCancel = globalThis.walletSetup.onSetupCancel;
_g.getState = globalThis.getWalletSkillState;

// ---------------------------------------------------------------------------
// Skill export
// ---------------------------------------------------------------------------

const tools: ToolDefinition[] = [listWalletsTool, listNetworksTool, getBalanceTool];
_g.tools = tools;

const skill: Skill = {
  info: {
    id: 'wallet',
    name: 'Web3 Wallet',
    version: '1.0.0',
    description: 'Web3 wallet connector — manage EVM wallets using addresses from the app.',
    auto_start: false,
    setup: { required: true, label: 'Connect Wallet' },
  },
  tools,
  init,
  start,
  stop,
  onLoad,
  onSetupStart: globalThis.walletSetup.onSetupStart,
  onSetupSubmit: async args => globalThis.walletSetup.onSetupSubmit(args),
  onSetupCancel: globalThis.walletSetup.onSetupCancel,
};

export default skill;
