// Shared types for wallet skill

export interface WalletAccount {
  index: number;
  chain_type: 'evm';
  address: string;
  label: string;
}

export interface NetworkConfig {
  chain_id: string;
  name: string;
  rpc_url: string;
  chain_type: 'evm';
}

export interface WalletSkillConfig {
  walletAddresses: string[];
  networks: NetworkConfig[];
}

/** Only Ethereum Mainnet is supported. */
export const DEFAULT_NETWORKS: NetworkConfig[] = [
  {
    chain_id: '1',
    name: 'Ethereum Mainnet',
    rpc_url: 'https://eth.llamarpc.com',
    chain_type: 'evm',
  },
];
