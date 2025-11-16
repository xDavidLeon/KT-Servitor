// pages/tierlist.js
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import TierList from '../components/TierList'
import TierListManager from '../components/TierListManager'
import Seo from '../components/Seo'
import { useKillteams } from '../hooks/useKillteams'
import {
  loadDefaultTierList,
  loadMercTierList,
  getSavedTierLists,
  getTierList,
  saveTierList,
  setActiveTierList,
  createTierList
} from '../lib/tierlist'

export default function TierListPage() {
  const router = useRouter()
  const locale = router.locale || 'en'
  const { data: killteams = [], isLoading: killteamsLoading } = useKillteams(locale)
  
  const [currentTierListId, setCurrentTierListId] = useState(null)
  const [tierListData, setTierListData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Create killteams map for quick lookup (excluding SPEC teams)
  const killteamsMap = useMemo(() => {
    const map = {}
    killteams.forEach(kt => {
      // Filter out teams with factionId or factionID equal to 'SPEC'
      if (kt.factionId !== 'SPEC' && kt.factionID !== 'SPEC') {
        map[kt.killteamId] = kt
      }
    })
    return map
  }, [killteams])

  // Initialize tier list
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get saved tier lists
        let { tierLists, activeTierListId } = getSavedTierLists()
        
        // Always ensure default tier lists exist (even if user has custom ones)
        const needsDefault = !tierLists.default
        const needsMerc = !tierLists.merc
        
        if (needsDefault) {
          // Load default (empty) tier list
          const defaultData = await loadDefaultTierList()
          console.log('Default tier list data:', defaultData) // Debug log
          const defaultTitle = defaultData.title || 'Default Tier List'
          createTierList(defaultTitle, {
            ...defaultData,
            name: defaultTitle,
            title: defaultTitle,
            createdAt: new Date().toISOString()
          }, true, false) // Use 'default' as the ID, not read-only
        } else {
          // Update existing default tier list if it has "Untitled" title
          const existingDefault = tierLists.default
          if (existingDefault && (existingDefault.title === 'Untitled' || !existingDefault.title)) {
            const defaultData = await loadDefaultTierList()
            if (defaultData.title) {
              saveTierList('default', {
                ...existingDefault,
                title: defaultData.title,
                name: defaultData.title
              })
            }
          }
        }
        
        if (needsMerc) {
          // Load merc tier list
          const mercData = await loadMercTierList()
          if (mercData) {
            console.log('Merc tier list data:', mercData) // Debug log
            const mercTitle = mercData.title || 'Kill Team Mercenarios Tier List'
            createTierList(mercTitle, {
              ...mercData,
              name: mercTitle,
              title: mercTitle,
              createdAt: new Date().toISOString()
            }, false, true, 'merc') // Use 'merc' as the fixed ID, read-only
          }
        } else {
          // Update existing merc tier list if it has "Untitled" title
          const existingMerc = tierLists.merc
          if (existingMerc && (existingMerc.title === 'Untitled' || !existingMerc.title)) {
            const mercData = await loadMercTierList()
            if (mercData && mercData.title) {
              saveTierList('merc', {
                ...existingMerc,
                title: mercData.title,
                name: mercData.title
              })
            }
          }
        }
        
        // Reload tier lists after initialization
        const { tierLists: updatedTierLists, activeTierListId: updatedActiveId } = getSavedTierLists()
        
        // Always use 'default' as the initial active tier list (not 'merc')
        // Only use the saved activeId if it's not 'merc' and the tier list exists
        let activeId = 'default'
        if (updatedActiveId && updatedActiveId !== 'merc' && updatedTierLists[updatedActiveId]) {
          activeId = updatedActiveId
        }
        
        let tierList = getTierList(activeId)
        
        // If active tier list doesn't exist, use default
        if (!tierList) {
          tierList = updatedTierLists.default || await loadDefaultTierList()
          setActiveTierList('default')
          setCurrentTierListId('default')
        } else {
          setActiveTierList(activeId)
          setCurrentTierListId(activeId)
        }
        
        setTierListData(tierList)
      } catch (err) {
        console.error('Failed to initialize tier list', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [])

  // Handle tier list change
  const handleTierListChange = (tierListId) => {
    const tierList = getTierList(tierListId)
    if (tierList) {
      setCurrentTierListId(tierListId)
      setTierListData(tierList)
      setActiveTierList(tierListId)
    }
  }

  // Handle new tier list creation
  const handleNewTierList = (tierListId) => {
    const tierList = getTierList(tierListId)
    if (tierList) {
      setCurrentTierListId(tierListId)
      setTierListData(tierList)
    }
  }

  // Handle tier change (when dragging teams)
  const handleTierChange = (tierName, newKillteamIds) => {
    if (!tierListData || !currentTierListId) return
    
    // Don't allow changes to read-only tier lists
    const currentTierList = getTierList(currentTierListId)
    if (currentTierList?.isReadOnly) {
      return
    }

    // Ensure each kill team can only be in one tier
    // Remove any kill teams from other tiers that are being added to this tier
    const updatedTiers = { ...tierListData.tiers }
    
    // First, remove all kill teams in newKillteamIds from other tiers
    Object.keys(updatedTiers).forEach(otherTierName => {
      if (otherTierName !== tierName) {
        updatedTiers[otherTierName] = updatedTiers[otherTierName].filter(
          id => !newKillteamIds.includes(id)
        )
      }
    })
    
    // Then set the new tier with the kill teams
    updatedTiers[tierName] = newKillteamIds

    const updatedTierList = {
      ...tierListData,
      tiers: updatedTiers,
      updatedAt: new Date().toISOString()
    }

    setTierListData(updatedTierList)
    saveTierList(currentTierListId, updatedTierList)
  }

  // Handle tier rename
  const handleRenameTier = (oldName, newName) => {
    if (!tierListData || !currentTierListId || oldName === newName) return
    
    // Don't allow changes to read-only tier lists
    const currentTierList = getTierList(currentTierListId)
    if (currentTierList?.isReadOnly) {
      return
    }
    
    if (tierListData.tiers[newName]) {
      alert('A tier with that name already exists')
      return
    }

    const updatedTiers = { ...tierListData.tiers }
    updatedTiers[newName] = updatedTiers[oldName] || []
    delete updatedTiers[oldName]

    // Update tierOrder if it exists
    const currentTierOrder = tierListData.tierOrder || Object.keys(tierListData.tiers)
    const newTierOrder = currentTierOrder.map(tier => tier === oldName ? newName : tier)

    const updatedTierList = {
      ...tierListData,
      tiers: updatedTiers,
      tierOrder: newTierOrder,
      updatedAt: new Date().toISOString()
    }

    setTierListData(updatedTierList)
    saveTierList(currentTierListId, updatedTierList)
  }

  // Handle tier deletion
  const handleDeleteTier = (tierName) => {
    if (!tierListData || !currentTierListId) return
    
    // Don't allow changes to read-only tier lists
    const currentTierList = getTierList(currentTierListId)
    if (currentTierList?.isReadOnly) {
      return
    }

    if (!confirm(`Delete tier "${tierName}"? All kill teams in this tier will be removed.`)) {
      return
    }

    const updatedTiers = { ...tierListData.tiers }
    delete updatedTiers[tierName]

    // Update tierOrder if it exists
    const currentTierOrder = tierListData.tierOrder || Object.keys(tierListData.tiers)
    const newTierOrder = currentTierOrder.filter(tier => tier !== tierName)

    const updatedTierList = {
      ...tierListData,
      tiers: updatedTiers,
      tierOrder: newTierOrder,
      updatedAt: new Date().toISOString()
    }

    setTierListData(updatedTierList)
    saveTierList(currentTierListId, updatedTierList)
  }

  // Handle tier reorder
  const handleReorderTiers = (newTierOrder) => {
    if (!tierListData || !currentTierListId) return
    
    // Don't allow changes to read-only tier lists
    const currentTierList = getTierList(currentTierListId)
    if (currentTierList?.isReadOnly) {
      return
    }

    const updatedTierList = {
      ...tierListData,
      tierOrder: newTierOrder,
      updatedAt: new Date().toISOString()
    }

    setTierListData(updatedTierList)
    saveTierList(currentTierListId, updatedTierList)
  }

  // Handle add tier
  const handleAddTier = () => {
    if (!tierListData || !currentTierListId) return
    
    // Don't allow changes to read-only tier lists
    const currentTierList = getTierList(currentTierListId)
    if (currentTierList?.isReadOnly) {
      return
    }

    const name = prompt('Enter tier name:')
    if (!name || !name.trim()) return

    if (tierListData.tiers[name.trim()]) {
      alert('A tier with that name already exists')
      return
    }

    const updatedTiers = {
      ...tierListData.tiers,
      [name.trim()]: []
    }

    // Add new tier to tierOrder if it exists, otherwise create it
    const currentTierOrder = tierListData.tierOrder || Object.keys(tierListData.tiers)
    const newTierOrder = [...currentTierOrder, name.trim()]

    const updatedTierList = {
      ...tierListData,
      tiers: updatedTiers,
      tierOrder: newTierOrder,
      updatedAt: new Date().toISOString()
    }

    setTierListData(updatedTierList)
    saveTierList(currentTierListId, updatedTierList)
  }

  // Handle load default
  const handleLoadDefault = async () => {
    // Don't allow loading default into read-only tier lists
    const currentTierList = getTierList(currentTierListId)
    if (currentTierList?.isReadOnly) {
      alert('Cannot modify read-only tier lists. Please switch to a different tier list first.')
      return
    }
    
    if (!confirm('Load default tier list? This will replace your current tier list.')) {
      return
    }

    try {
      setLoading(true)
      const defaultData = await loadDefaultTierList()
      const updatedTierList = {
        ...defaultData,
        name: defaultData.title || defaultData.name || 'Default',
        updatedAt: new Date().toISOString()
      }
      setTierListData(updatedTierList)
      saveTierList(currentTierListId, updatedTierList)
    } catch (err) {
      console.error('Failed to load default tier list', err)
      alert('Failed to load default tier list')
    } finally {
      setLoading(false)
    }
  }

  if (loading || killteamsLoading) {
    return (
      <>
        <Seo title="Tier List" description="Kill Team competitive tier list with drag-and-drop ranking" />
        <div className="container">
          <Header />
          <div className="card">
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              Loading tier list...
            </div>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Seo title="Tier List" description="Kill Team competitive tier list with drag-and-drop ranking" />
        <div className="container">
          <Header />
          <div className="card">
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
              Error: {error}
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!tierListData) {
    return (
      <>
        <Seo title="Tier List" description="Kill Team competitive tier list with drag-and-drop ranking" />
        <div className="container">
          <Header />
          <div className="card">
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              No tier list data available
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Seo
        title="Tier List"
        description="Kill Team competitive tier list with drag-and-drop ranking. Create and manage your own tier lists."
      />
      <div className="container">
        <Header />
        <div className="card">
          <h1 style={{ marginTop: 0 }}>{tierListData.title || 'Tier List'}</h1>
          <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
            Drag and drop kill teams between tiers to create your custom ranking. Changes are saved automatically.
          </p>

          <TierListManager
            currentTierListId={currentTierListId}
            onTierListChange={handleTierListChange}
            onNewTierList={handleNewTierList}
            onLoadDefault={handleLoadDefault}
            isReadOnly={tierListData?.isReadOnly || false}
          />

          {tierListData && (
            <TierList
              tiers={tierListData.tiers}
              tierOrder={tierListData.tierOrder}
              killteamsMap={killteamsMap}
              onTierChange={handleTierChange}
              onRenameTier={handleRenameTier}
              onDeleteTier={handleDeleteTier}
              onAddTier={handleAddTier}
              onReorderTiers={handleReorderTiers}
              isReadOnly={tierListData.isReadOnly || false}
            />
          )}

          {tierListData.source && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #2a2f3f', color: 'var(--muted)', fontSize: '0.85rem' }}>
              Source: {tierListData.source}
              {tierListData.lastUpdated && ` • Last updated: ${new Date(tierListData.lastUpdated).toLocaleDateString()}`}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

