'use client'

import { http } from 'wagmi'
import { monadTestnet } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { QueryClient } from '@tanstack/react-query'

const rpc = process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC || ''
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

export const wagmiConfig = getDefaultConfig({
  appName: 'cult',
  projectId,
  chains: [monadTestnet],
  transports: { [monadTestnet.id]: http(rpc, { timeout: 10000 }) },
})

export const queryClient = new QueryClient()