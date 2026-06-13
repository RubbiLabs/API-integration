export const SubscriptionServiceABI = [
  {
    type: "event",
    name: "SubscriptionPlanCreated",
    inputs: [
      { name: "creator", type: "address", indexed: false },
      { name: "planfee", type: "uint256", indexed: false },
      { name: "planName", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SubscriptionStarted",
    inputs: [
      { name: "subscriber", type: "address", indexed: true },
      { name: "planId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SubscriptionPaid",
    inputs: [
      { name: "from", type: "address", indexed: false },
      { name: "to", type: "address", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SubscriptionPaused",
    inputs: [
      { name: "subscriber", type: "address", indexed: true },
      { name: "planId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SubscriptionResumed",
    inputs: [
      { name: "subscriber", type: "address", indexed: true },
      { name: "planId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "getAllSubscriptionPlans",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "name", type: "string" },
          { name: "fee", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getSubscriptionsOfAddress",
    stateMutability: "view",
    inputs: [{ name: "_add", type: "address" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "active", type: "bool" },
          { name: "name", type: "string" },
          { name: "fee", type: "uint256" },
          { name: "userAddress", type: "address" },
          { name: "subPlanId", type: "uint256" },
          { name: "email", type: "string" },
          { name: "password", type: "string" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "startSubscription",
    stateMutability: "nonpayable",
    inputs: [
      { name: "planId", type: "uint256" },
      { name: "_email", type: "string" },
      { name: "_password", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "pauseSubscription",
    stateMutability: "nonpayable",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resumeSubscription",
    stateMutability: "nonpayable",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [],
  },
] as const
