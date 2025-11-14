import { QueryClient } from '@tanstack/react-query'

const ONE_HOUR = 1000 * 60 * 60
const ONE_DAY = ONE_HOUR * 24

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        staleTime: ONE_HOUR,
        gcTime: ONE_DAY,
        retry: 1,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        refetchOnMount: false
      },
      mutations: {
        networkMode: 'offlineFirst',
        retry: 1
      }
    }
  })
}
