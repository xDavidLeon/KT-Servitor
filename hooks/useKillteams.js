import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/db'
import { ensureIndex } from '../lib/search'
import { datasetBootstrapQueryOptions } from '../lib/datasetQueries'

const isBrowser = typeof window !== 'undefined'
const ONE_HOUR = 1000 * 60 * 60
const ONE_DAY = ONE_HOUR * 24

function sortKillteams(records) {
  return records
    .slice()
    .sort((a, b) => (a.killteamName || '').localeCompare(b.killteamName || ''))
}

async function loadKillteams() {
  const rows = await db.killteams.orderBy('killteamName').toArray()
  return sortKillteams(rows)
}

export function useKillteams(locale = 'en') {
  const queryClient = useQueryClient()
  const enabled = isBrowser && Boolean(locale)

  useEffect(() => {
    if (!isBrowser) return undefined
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['killteams', locale] })
    }
    window.addEventListener('kt-killteams-updated', handler)
    return () => window.removeEventListener('kt-killteams-updated', handler)
  }, [queryClient, locale])

  return useQuery({
    queryKey: ['killteams', locale],
    queryFn: async () => {
      await queryClient.ensureQueryData(datasetBootstrapQueryOptions(locale))
      await ensureIndex()
      return loadKillteams()
    },
    enabled,
    staleTime: ONE_HOUR,
    gcTime: ONE_DAY,
    networkMode: 'offlineFirst',
    retry: 1
  })
}
