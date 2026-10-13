export const LOCK_VAULT_ABI = [
  {
    inputs: [],
    name: 'CannotShortenLock',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'uint128',
        name: 'amount',
        type: 'uint128',
      },
      {
        internalType: 'uint64',
        name: 'unlockAt',
        type: 'uint64',
      },
    ],
    name: 'deposit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'InvalidUnlockTime',
    type: 'error',
  },
  {
    inputs: [],
    name: 'LockNotExpired',
    type: 'error',
  },
  {
    inputs: [],
    name: 'NoActiveLock',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ReentrancyGuardReentrantCall',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
    ],
    name: 'SafeERC20FailedOperation',
    type: 'error',
  },
  {
    inputs: [],
    name: 'ZeroAmount',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'holder',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint128',
        name: 'amount',
        type: 'uint128',
      },
      {
        indexed: false,
        internalType: 'uint64',
        name: 'unlockAt',
        type: 'uint64',
      },
    ],
    name: 'Locked',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
    ],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'holder',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint128',
        name: 'amount',
        type: 'uint128',
      },
    ],
    name: 'Withdrawn',
    type: 'event',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'holder',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'uint128',
        name: 'minAmount',
        type: 'uint128',
      },
      {
        internalType: 'uint64',
        name: 'until',
        type: 'uint64',
      },
    ],
    name: 'isLocked',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'holder',
        type: 'address',
      },
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
    ],
    name: 'lockOf',
    outputs: [
      {
        internalType: 'uint128',
        name: 'amount',
        type: 'uint128',
      },
      {
        internalType: 'uint64',
        name: 'unlockAt',
        type: 'uint64',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]

export const AVER_REGISTRY_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'initialAttestor',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'constructor',
  },
  {
    inputs: [],
    name: 'CertificateAlreadyExists',
    type: 'error',
  },
  {
    inputs: [],
    name: 'CertificateNotActive',
    type: 'error',
  },
  {
    inputs: [],
    name: 'CertificateNotFound',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidAddress',
    type: 'error',
  },
  {
    inputs: [],
    name: 'InvalidCertificateData',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'owner',
        type: 'address',
      },
    ],
    name: 'OwnableInvalidOwner',
    type: 'error',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'OwnableUnauthorizedAccount',
    type: 'error',
  },
  {
    inputs: [],
    name: 'Unauthorized',
    type: 'error',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'attestor',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bool',
        name: 'status',
        type: 'bool',
      },
    ],
    name: 'AttestorUpdated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'attestor',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint64',
        name: 'ts',
        type: 'uint64',
      },
    ],
    name: 'Heartbeat',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'certId',
        type: 'bytes32',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'evidenceHash',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'uint128',
        name: 'threshold',
        type: 'uint128',
      },
      {
        indexed: false,
        internalType: 'enum AverRegistry.Mode',
        name: 'mode',
        type: 'uint8',
      },
      {
        indexed: false,
        internalType: 'uint64',
        name: 'expiresAt',
        type: 'uint64',
      },
    ],
    name: 'Issued',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'previousOwner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'OwnershipTransferStarted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'previousOwner',
        type: 'address',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'OwnershipTransferred',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'bytes32',
        name: 'certId',
        type: 'bytes32',
      },
      {
        indexed: false,
        internalType: 'enum AverRegistry.Status',
        name: 'status',
        type: 'uint8',
      },
      {
        indexed: false,
        internalType: 'uint64',
        name: 'evidenceBlock',
        type: 'uint64',
      },
    ],
    name: 'StatusChanged',
    type: 'event',
  },
  {
    inputs: [],
    name: 'acceptOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'beat',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32',
      },
    ],
    name: 'certs',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'holderCommitment',
        type: 'bytes32',
      },
      {
        internalType: 'bytes32',
        name: 'evidenceHash',
        type: 'bytes32',
      },
      {
        internalType: 'address',
        name: 'token',
        type: 'address',
      },
      {
        internalType: 'uint128',
        name: 'threshold',
        type: 'uint128',
      },
      {
        internalType: 'uint64',
        name: 'windowSeconds',
        type: 'uint64',
      },
      {
        internalType: 'uint64',
        name: 'issuedAt',
        type: 'uint64',
      },
      {
        internalType: 'uint64',
        name: 'expiresAt',
        type: 'uint64',
      },
      {
        internalType: 'enum AverRegistry.Mode',
        name: 'mode',
        type: 'uint8',
      },
      {
        internalType: 'enum AverRegistry.Status',
        name: 'status',
        type: 'uint8',
      },
      {
        internalType: 'uint64',
        name: 'statusAt',
        type: 'uint64',
      },
      {
        internalType: 'uint64',
        name: 'evidenceBlock',
        type: 'uint64',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    name: 'isAttestor',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'certId',
        type: 'bytes32',
      },
      {
        components: [
          {
            internalType: 'bytes32',
            name: 'holderCommitment',
            type: 'bytes32',
          },
          {
            internalType: 'bytes32',
            name: 'evidenceHash',
            type: 'bytes32',
          },
          {
            internalType: 'address',
            name: 'token',
            type: 'address',
          },
          {
            internalType: 'uint128',
            name: 'threshold',
            type: 'uint128',
          },
          {
            internalType: 'uint64',
            name: 'windowSeconds',
            type: 'uint64',
          },
          {
            internalType: 'uint64',
            name: 'issuedAt',
            type: 'uint64',
          },
          {
            internalType: 'uint64',
            name: 'expiresAt',
            type: 'uint64',
          },
          {
            internalType: 'enum AverRegistry.Mode',
            name: 'mode',
            type: 'uint8',
          },
          {
            internalType: 'enum AverRegistry.Status',
            name: 'status',
            type: 'uint8',
          },
          {
            internalType: 'uint64',
            name: 'statusAt',
            type: 'uint64',
          },
          {
            internalType: 'uint64',
            name: 'evidenceBlock',
            type: 'uint64',
          },
        ],
        internalType: 'struct AverRegistry.Certificate',
        name: 'c',
        type: 'tuple',
      },
    ],
    name: 'issue',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'lastHeartbeat',
    outputs: [
      {
        internalType: 'uint64',
        name: '',
        type: 'uint64',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'certId',
        type: 'bytes32',
      },
      {
        internalType: 'uint64',
        name: 'evidenceBlock',
        type: 'uint64',
      },
    ],
    name: 'markBreached',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pendingOwner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'certId',
        type: 'bytes32',
      },
    ],
    name: 'revoke',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'attestor',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: 'ok',
        type: 'bool',
      },
    ],
    name: 'setAttestor',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'certId',
        type: 'bytes32',
      },
    ],
    name: 'statusOf',
    outputs: [
      {
        internalType: 'enum AverRegistry.EffectiveStatus',
        name: '',
        type: 'uint8',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newOwner',
        type: 'address',
      },
    ],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]
