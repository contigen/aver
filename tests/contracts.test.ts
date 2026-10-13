import { describe, expect, it } from 'bun:test'
import fs from 'fs'
import path from 'path'
import solc from 'solc'
import {
  mockUsdcAbi,
  lockVaultAbi,
  averRegistryAbi,
} from '../src/lib/contracts/abis'

describe('Smart Contract Compilation and ABI Validation', () => {
  const findImports = (importPath: string) => {
    if (importPath.startsWith('@openzeppelin/')) {
      const resolvedPath = path.resolve('./node_modules', importPath)
      return { contents: fs.readFileSync(resolvedPath, 'utf8') }
    }
    const localPath = path.resolve('./contracts', importPath)
    if (fs.existsSync(localPath)) {
      return { contents: fs.readFileSync(localPath, 'utf8') }
    }
    return { error: `File not found: ${importPath}` }
  }

  const input = {
    language: 'Solidity',
    sources: {
      'MockUSDC.sol': {
        content: fs.readFileSync('./contracts/MockUSDC.sol', 'utf8'),
      },
      'LockVault.sol': {
        content: fs.readFileSync('./contracts/LockVault.sol', 'utf8'),
      },
      'AverRegistry.sol': {
        content: fs.readFileSync('./contracts/AverRegistry.sol', 'utf8'),
      },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  }

  type SolcContract = {
    abi: Array<{ name?: string; type: string }>
    evm: { bytecode: { object: string } }
  }

  type SolcOutput = {
    errors?: Array<{ severity: string; message: string }>
    contracts: Record<string, Record<string, SolcContract>>
  }

  const compiled = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports }),
  ) as SolcOutput

  it('should compile all contracts with zero errors', () => {
    const errors = compiled.errors?.filter(e => e.severity === 'error') ?? []
    expect(errors.length).toBe(0)
  })

  it('should generate valid bytecode for MockUSDC', () => {
    const contract = compiled.contracts['MockUSDC.sol']['MockUSDC']
    expect(contract.evm.bytecode.object.length).toBeGreaterThan(100)
    const faucetFn = mockUsdcAbi.find(
      item => item.type === 'function' && item.name === 'faucet',
    )
    expect(faucetFn).toBeDefined()
  })

  it('should generate valid bytecode for LockVault', () => {
    const contract = compiled.contracts['LockVault.sol']['LockVault']
    expect(contract.evm.bytecode.object.length).toBeGreaterThan(100)
    const depositFn = lockVaultAbi.find(
      item => item.type === 'function' && item.name === 'deposit',
    )
    const withdrawFn = lockVaultAbi.find(
      item => item.type === 'function' && item.name === 'withdraw',
    )
    expect(depositFn).toBeDefined()
    expect(withdrawFn).toBeDefined()
  })

  it('should generate valid bytecode for AverRegistry', () => {
    const contract = compiled.contracts['AverRegistry.sol']['AverRegistry']
    expect(contract.evm.bytecode.object.length).toBeGreaterThan(100)
    const issueFn = averRegistryAbi.find(
      item => item.type === 'function' && item.name === 'issue',
    )
    const statusOfFn = averRegistryAbi.find(
      item => item.type === 'function' && item.name === 'statusOf',
    )
    const markBreachedFn = averRegistryAbi.find(
      item => item.type === 'function' && item.name === 'markBreached',
    )
    expect(issueFn).toBeDefined()
    expect(statusOfFn).toBeDefined()
    expect(markBreachedFn).toBeDefined()
  })
})
