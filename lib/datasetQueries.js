import { checkForUpdates } from './update'

const ONE_HOUR = 1000 * 60 * 60
const ONE_DAY = ONE_HOUR * 24

export function datasetBootstrapQueryOptions(locale = 'en') {
  return {
    queryKey: ['dataset-bootstrap', locale],
    queryFn: () => checkForUpdates(locale),
    staleTime: ONE_HOUR,
    gcTime: ONE_DAY,
    networkMode: 'offlineFirst',
    retry: 1
  }
}
