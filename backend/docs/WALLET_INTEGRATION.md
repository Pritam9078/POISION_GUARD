# Wallet integration

The backend is **wallet-agnostic** and **non-custodial**. It never holds keys, never signs, never broadcasts. Wallets interact in two ways:

1. **Ownership proof (SIWE / EIP-4361)** — `POST /auth/wallet/challenge` returns an exact message (domain, address, chain id, nonce, issued/expiry, statement that it authorizes nothing). The wallet signs it with `personal_sign` (EIP-191); `POST /auth/wallet/verify` recovers the signer, checks expiry and consumes the nonce atomically (single use).
2. **User-signed transactions** — the API returns unsigned `{ chainId, from, to, data, value }`; the frontend passes it to `eth_sendTransaction`; the user reviews in their wallet; the frontend posts back the tx hash for verification.

Connection is not authorization: linking a wallet grants no spending rights.

## Compatibility

| Wallet | Connection | Networks relevant here | Status |
|---|---|---|---|
| MetaMask / Rabby / Coinbase (injected) | `window.ethereum` (EIP-1193) | all EVM chains in registry | Backend flow verified with ethers-signed EIP-191 messages and real txs on a local EVM (`tests/e2e`). Frontend wiring not tested. |
| WalletConnect v2 wallets | WalletConnect (frontend) | per wallet | Backend-compatible (same `personal_sign` + `eth_sendTransaction`). Requires a WalletConnect project id in the frontend. **Not tested.** |
| Cake Wallet | Per Cake Wallet's README: supports ETH, Polygon, Base, Arbitrum and ERC-20 tokens. The README does **not** document WalletConnect or an injected provider. | Ethereum, Polygon, Base, Arbitrum | **Unverified.** Do not advertise support until a real device test confirms a dApp connection method (WalletConnect pairing or in-app browser). `walletType: 'cake'` is accepted for labelling only. |
| Smart-contract wallets (Safe, ERC-4337) | — | — | **Not supported** for sign-in: EIP-1271 signature validation is not implemented. Safe-owned treasuries can still be watched and used as intent `from` (execution reconciliation checks the tx sender). |

Never request a seed phrase or private key. No endpoint accepts one.
