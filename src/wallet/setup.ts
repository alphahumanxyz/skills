// Setup wizard for wallet skill
import { DEFAULT_NETWORKS } from './types';

async function onSetupStart(): Promise<SetupStartResult> {
  const networks = Array.isArray(DEFAULT_NETWORKS) ? DEFAULT_NETWORKS : [];
  const evmOptions = networks.map(n => ({ label: n.name, value: n.chain_id }));

  return {
    step: {
      id: 'networks',
      title: 'Select Networks',
      description:
        'Choose which blockchain networks to enable for balance checks. Your wallet address from the app will be used.',
      fields: [
        {
          name: 'evm_networks',
          type: 'multiselect',
          label: 'EVM Networks',
          description: 'Select EVM networks (Ethereum, Polygon, BSC, etc.)',
          required: false,
          options: evmOptions,
        },
      ],
    },
  };
}

async function onSetupSubmit(args: {
  stepId: string;
  values: Record<string, unknown>;
}): Promise<SetupSubmitResult> {
  const s = globalThis.getWalletSkillState();

  if (args.stepId === 'networks') {
    const networks = Array.isArray(DEFAULT_NETWORKS) ? DEFAULT_NETWORKS : [];
    const evmSelected = (args.values.evm_networks as string[]) || [];
    s.config.networks = networks.filter(n => evmSelected.includes(n.chain_id));
    if (s.config.networks.length === 0) {
      s.config.networks = networks.slice(0, 3);
    }
    state.set('config', s.config);
    return { status: 'complete' };
  }

  return { status: 'error', errors: [{ field: '', message: `Unknown step: ${args.stepId}` }] };
}

async function onSetupCancel(): Promise<void> {
  // No transient state to clear
}

declare global {
  var walletSetup: {
    onSetupStart: typeof onSetupStart;
    onSetupSubmit: typeof onSetupSubmit;
    onSetupCancel: typeof onSetupCancel;
  };
}
globalThis.walletSetup = { onSetupStart, onSetupSubmit, onSetupCancel };

export { onSetupStart, onSetupSubmit, onSetupCancel };
