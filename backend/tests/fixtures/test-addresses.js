/**
 * Test Addresses & Blockchain Fixtures
 * Validated synthetic test vectors for scanner, recipient checker, and token approvals.
 */

export const TEST_ADDRESSES = {
  // Standard valid addresses
  vitalik: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  binanceHot: '0x28C6c06298d514Db089934071355E5743bf21d60',
  usdcContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  
  // Synthetic lookalike / poisoned address pairs
  genuineRecipient: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  lookalikePoisoned: '0x71C7650000000000000000000000000000d8976F', // same prefix 0x71C765, same suffix d8976F
  
  // Zero-value transfer attack vector
  zeroValueAttacker: '0x9999999999999999999999999999999999999999',
  
  // Malformed / invalid inputs
  tooShort: '0x12345',
  tooLong: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA960451234',
  invalidHex: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA960ZZ',
  empty: '',
  spaced: '   0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045   ',
}

export const TEST_CHAINS = [
  { id: 1, name: 'Ethereum Mainnet', testnet: false },
  { id: 8453, name: 'Base', testnet: false },
  { id: 42161, name: 'Arbitrum One', testnet: false },
  { id: 10, name: 'Optimism', testnet: false },
  { id: 137, name: 'Polygon', testnet: false },
  { id: 11155111, name: 'Sepolia Testnet', testnet: true },
]

