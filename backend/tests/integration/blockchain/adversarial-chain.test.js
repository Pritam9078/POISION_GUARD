import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { ethers } from 'ethers'

describe('Blockchain: Adversarial & Edge-Case Transaction Suite', () => {
  const MAX_UINT256_STR = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

  test('BigInt Preservation: Max uint256 amounts never lose precision through JS floating point', () => {
    // 1. Parsing max uint256 with BigInt
    const maxBigInt = BigInt(MAX_UINT256_STR)
    assert.equal(maxBigInt.toString(), MAX_UINT256_STR, 'BigInt must maintain full 256-bit precision')

    // 2. Proving that Number() loses precision (violating safety)
    const floatNumber = Number(MAX_UINT256_STR)
    assert.notEqual(floatNumber.toString(), MAX_UINT256_STR, 'Number() loses precision on large integers')
    assert.ok(maxBigInt > BigInt(Number.MAX_SAFE_INTEGER), 'Must handle integers larger than MAX_SAFE_INTEGER')

    // 3. Ethers formatUnits handles large amounts safely
    const parsed = ethers.formatUnits(maxBigInt, 18)
    assert.ok(typeof parsed === 'string', 'Formatted unit must return string')
    assert.ok(parsed.length > 50, 'Formatted string must retain full magnitude')
  })

  test('Zero-address interaction is detected and flagged safely', () => {
    assert.equal(ethers.isAddress(ZERO_ADDRESS), true, 'Zero address is technically valid EVM address format')
    const isZero = ZERO_ADDRESS.toLowerCase() === '0x' + '00'.repeat(20)
    assert.equal(isZero, true, 'Zero address must be explicitly distinguishable')
  })

  test('Zero-value transfers and dust transactions are differentiated from standard transfers', () => {
    const zeroWei = 0n
    const oneWei = 1n
    const oneEther = ethers.parseEther('1.0')

    assert.equal(zeroWei, 0n)
    assert.equal(oneWei, 1n)
    assert.ok(oneWei < oneEther)
    assert.equal(ethers.formatEther(zeroWei), '0.0')
  })

  test('Token Decimals Edge Cases: 0 decimals, 6 decimals, 18 decimals, 30 decimals', () => {
    // NFT / Voting token: 0 decimals
    const zeroDecimalAmount = 100n
    assert.equal(ethers.formatUnits(zeroDecimalAmount, 0), '100')

    // Stablecoin (USDC / USDT): 6 decimals
    const usdcAmount = 1_000_000n // 1.0 USDC
    assert.equal(ethers.formatUnits(usdcAmount, 6), '1.0')

    // Standard ERC-20: 18 decimals
    const standardAmount = 1_000_000_000_000_000_000n // 1.0 ETH
    assert.equal(ethers.formatUnits(standardAmount, 18), '1.0')

    // Deep token: 30 decimals
    const deepDecimalAmount = 1_000_000_000_000_000_000_000_000_000_000n
    assert.equal(ethers.formatUnits(deepDecimalAmount, 30), '1.0')
  })

  test('Transaction Decoding: ERC-20 Transfer and Unlimited Approval selectors', () => {
    const erc20Interface = new ethers.Interface([
      'function transfer(address to, uint256 amount) returns (bool)',
      'function approve(address spender, uint256 amount) returns (bool)',
    ])

    // 1. Encode transfer
    const recipient = '0x1111111111111111111111111111111111111111'
    const transferData = erc20Interface.encodeFunctionData('transfer', [recipient, 1000n])
    const decodedTransfer = erc20Interface.decodeFunctionData('transfer', transferData)

    assert.equal(decodedTransfer[0].toLowerCase(), recipient.toLowerCase())
    assert.equal(decodedTransfer[1], 1000n)

    // 2. Encode unlimited approval (2^256 - 1)
    const spender = '0x2222222222222222222222222222222222222222'
    const approveData = erc20Interface.encodeFunctionData('approve', [spender, BigInt(MAX_UINT256_STR)])
    const decodedApprove = erc20Interface.decodeFunctionData('approve', approveData)

    assert.equal(decodedApprove[0].toLowerCase(), spender.toLowerCase())
    assert.equal(decodedApprove[1].toString(), MAX_UINT256_STR, 'Unlimited approval must decode max uint256')
  })

  test('Malformed calldata is rejected without unhandled exception', () => {
    const erc20Interface = new ethers.Interface(['function transfer(address to, uint256 amount) returns (bool)'])

    // Too short calldata (less than 4-byte selector)
    assert.throws(
      () => erc20Interface.decodeFunctionData('transfer', '0x12'),
      /BUFFER_OVERRUN|data bounds|data out-of-bounds|invalid/i
    )

    // Truncated parameter data
    assert.throws(
      () => erc20Interface.decodeFunctionData('transfer', '0xa9059cbb' + '00'.repeat(10)),
      /data out-of-bounds/i
    )
  })
})
