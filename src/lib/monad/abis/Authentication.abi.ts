export const AuthenticationABI = [
  {
    type: "event",
    name: "MemberEnrolled",
    inputs: [
      { name: "_address", type: "address", indexed: true },
      { name: "name", type: "bytes", indexed: true },
    ],
  },
  {
    type: "function",
    name: "createAccount",
    stateMutability: "nonpayable",
    inputs: [{ name: "_name", type: "bytes" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getUserInfo",
    stateMutability: "view",
    inputs: [{ name: "_userAddress", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "name", type: "bytes" },
          { name: "address_", type: "address" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getUserInfoFromName",
    stateMutability: "view",
    inputs: [{ name: "_name", type: "bytes" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "name", type: "bytes" },
          { name: "address_", type: "address" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getAddressFromName",
    stateMutability: "view",
    inputs: [{ name: "_name", type: "bytes" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "usernameExist",
    stateMutability: "view",
    inputs: [{ name: "_name", type: "bytes" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const
