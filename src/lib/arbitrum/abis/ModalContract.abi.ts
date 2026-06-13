export const ModalContractABI = [
  {
    type: "event",
    name: "DepositSuccessful",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "_amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "WithdrawalSuccessful",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "_amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TransferSuccessful",
    inputs: [
      { name: "sender", type: "address", indexed: false },
      { name: "receiver", type: "address", indexed: false },
      { name: "_amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AdditionSuccessful",
    inputs: [
      { name: "user", type: "address", indexed: false },
      { name: "_amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "DeductionSuccessful",
    inputs: [
      { name: "user", type: "address", indexed: false },
      { name: "_amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "_amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "_amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getBalances",
    stateMutability: "view",
    inputs: [{ name: "_address", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balances",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "contractBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balancePlus",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_address", type: "address" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "subtractFromBalance",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_userAddress", type: "address" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "OPToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const
