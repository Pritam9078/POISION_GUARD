/** Static chain + token registry. Seeded into `chains`/`tokens`; RPC URLs only ever come from env. */
export const CHAINS = [
  { id: 1, key: 'ethereum', name: 'Ethereum', symbol: 'ETH', explorerUrl: 'https://etherscan.io', rpcEnvVar: 'ETHEREUM_RPC_URL', capabilities: ['scan', 'approvals', 'monitoring', 'revoke'], confirmations: 3 },
  { id: 8453, key: 'base', name: 'Base', symbol: 'ETH', explorerUrl: 'https://basescan.org', rpcEnvVar: 'BASE_RPC_URL', capabilities: ['scan', 'approvals', 'monitoring', 'revoke'], confirmations: 3 },
  { id: 42161, key: 'arbitrum', name: 'Arbitrum One', symbol: 'ETH', explorerUrl: 'https://arbiscan.io', rpcEnvVar: 'ARBITRUM_RPC_URL', capabilities: ['scan', 'approvals', 'monitoring', 'revoke'], confirmations: 3 },
  { id: 10, key: 'optimism', name: 'OP Mainnet', symbol: 'ETH', explorerUrl: 'https://optimistic.etherscan.io', rpcEnvVar: 'OPTIMISM_RPC_URL', capabilities: ['scan', 'approvals', 'monitoring'], confirmations: 3 },
  { id: 137, key: 'polygon', name: 'Polygon PoS', symbol: 'POL', explorerUrl: 'https://polygonscan.com', rpcEnvVar: 'POLYGON_RPC_URL', capabilities: ['scan', 'approvals', 'monitoring'], confirmations: 64 },
  { id: 56, key: 'bsc', name: 'BNB Smart Chain', symbol: 'BNB', explorerUrl: 'https://bscscan.com', rpcEnvVar: 'BSC_RPC_URL', capabilities: ['scan', 'monitoring'], confirmations: 15 },
  { id: 11155111, key: 'sepolia', name: 'Sepolia (testnet)', symbol: 'ETH', explorerUrl: 'https://sepolia.etherscan.io', rpcEnvVar: 'SEPOLIA_RPC_URL', capabilities: ['scan', 'approvals', 'revoke'], confirmations: 2, environment: 'testnet' },
]
export const chainById = (id) => CHAINS.find((c) => c.id === Number(id))
export const chainByKey = (k) => CHAINS.find((c) => c.key === k)
/** Accepts a chain id (number/string) or key ("ethereum"). */
export function resolveChain(v) {
  if (v === undefined || v === null || v === '') return null
  return chainByKey(String(v)) || chainById(v) || null
}

/** Canonical stablecoins/wrapped assets per chain — used to detect counterfeit tokens. */
export const CANONICAL_TOKENS = [
  [1, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'USDC', 'USD Coin', 6],
  [1, '0xdac17f958d2ee523a2206206994597c13d831ec7', 'USDT', 'Tether USD', 6],
  [1, '0x6b175474e89094c44da98b954eedeac495271d0f', 'DAI', 'Dai Stablecoin', 18],
  [1, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 'WETH', 'Wrapped Ether', 18],
  [8453, '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 'USDC', 'USD Coin', 6],
  [8453, '0x4200000000000000000000000000000000000006', 'WETH', 'Wrapped Ether', 18],
  [42161, '0xaf88d065e77c8cc2239327c5edb3a432268e5831', 'USDC', 'USD Coin', 6],
  [42161, '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', 'USDT', 'Tether USD', 6],
  [42161, '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', 'WETH', 'Wrapped Ether', 18],
  [10, '0x0b2c639c533813f4aa9d7837caf62653d097ff85', 'USDC', 'USD Coin', 6],
  [10, '0x4200000000000000000000000000000000000006', 'WETH', 'Wrapped Ether', 18],
  [137, '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', 'USDC', 'USD Coin', 6],
  [137, '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', 'USDT', 'Tether USD', 6],
  [56, '0x55d398326f99059ff775485246999027b3197955', 'USDT', 'Tether USD', 18],
  [56, '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', 'USDC', 'USD Coin', 18],
].map(([chainId, address, symbol, name, decimals]) => ({ chainId, address, symbol, name, decimals }))
export const canonicalToken = (chainId, addr) => CANONICAL_TOKENS.find((t) => t.chainId === chainId && t.address === addr?.toLowerCase())
export const canonicalBySymbol = (chainId, sym) => CANONICAL_TOKENS.filter((t) => t.chainId === chainId && t.symbol.toUpperCase() === String(sym).toUpperCase())

/** Recognized spender contracts. A label is identification only — never a safety guarantee. */
export const KNOWN_SPENDERS = {
  '0x000000000022d473030f116ddee9f6b43ac78ba3': 'Uniswap Permit2',
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal Router',
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3 SwapRouter',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap SwapRouter02',
  '0x1111111254eeb25477b68fb85ed92940a95f41c0': '1inch Aggregation Router v5',
  '0x111111125421ca6dc452d289314280a0f8842a65': '1inch Aggregation Router v6',
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Exchange Proxy',
}
