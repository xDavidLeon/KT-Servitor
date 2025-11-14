import { useQuery } from '@tanstack/react-query'
import { datasetBootstrapQueryOptions } from '../lib/datasetQueries'

const isBrowser = typeof window !== 'undefined'

export function useDatasetBootstrap(locale = 'en', options = {}) {
  const enabled = options.enabled ?? (isBrowser && Boolean(locale))

  return useQuery({
    ...datasetBootstrapQueryOptions(locale),
    ...options,
    enabled
  })
}
