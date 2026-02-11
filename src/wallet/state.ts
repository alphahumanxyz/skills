// skill-state.ts — global state for the wallet skill.
// Wallet addresses come from the frontend via onLoad(params).
import type { WalletSkillConfig } from './types';

export interface WalletSkillState {
  config: WalletSkillConfig;
  isRunning: boolean;
}

declare global {
  function getWalletSkillState(): WalletSkillState;
  var __walletSkillState: WalletSkillState;
}

const skillState: WalletSkillState = {
  config: { walletAddresses: [], networks: [] },
  isRunning: false,
};
globalThis.__walletSkillState = skillState;

globalThis.getWalletSkillState = function getWalletSkillState(): WalletSkillState {
  return globalThis.__walletSkillState;
};

export function getWalletSkillState(): WalletSkillState {
  return globalThis.getWalletSkillState();
}
