// components/TierListManager.js
import { useState, useRef, useEffect } from 'react'
import {
  getSavedTierLists,
  createTierList,
  deleteTierList,
  renameTierList,
  setActiveTierList,
  exportTierListToJson,
  importTierListFromJson
} from '../lib/tierlist'

export default function TierListManager({
  currentTierListId,
  onTierListChange,
  onNewTierList,
  onLoadDefault,
  isReadOnly = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [tierLists, setTierLists] = useState(() => getSavedTierLists().tierLists)
  const fileInputRef = useRef(null)
  
  // Refresh tier lists when currentTierListId changes (indicates parent has updated)
  useEffect(() => {
    const { tierLists: updatedTierLists } = getSavedTierLists()
    setTierLists(updatedTierLists)
  }, [currentTierListId])
  
  // Helper to get display name (prefer title, fallback to name)
  const getDisplayName = (tierListId) => {
    const tierList = tierLists[tierListId]
    if (!tierList) return tierListId
    return tierList.title || tierList.name || tierListId
  }

  const handleCreateNew = () => {
    const name = prompt('Enter tier list name:')
    if (name && name.trim()) {
      const newId = createTierList(name.trim())
      const { tierLists: updatedTierLists } = getSavedTierLists()
      setTierLists(updatedTierLists)
      setActiveTierList(newId)
      onNewTierList(newId)
      setIsOpen(false)
    }
  }

  const handleDelete = (tierListId) => {
    if (tierListId === 'default' || tierListId === 'merc') {
      alert('Cannot delete the default or read-only tier lists')
      return
    }
    
    const tierList = tierLists[tierListId]
    if (tierList?.isReadOnly) {
      alert('Cannot delete read-only tier lists')
      return
    }
    
    if (confirm(`Delete "${getDisplayName(tierListId)}"?`)) {
      deleteTierList(tierListId)
      const { tierLists: updatedTierLists } = getSavedTierLists()
      setTierLists(updatedTierLists)
      if (tierListId === currentTierListId) {
        setActiveTierList('default')
        onTierListChange('default')
      }
      setIsOpen(false)
    }
  }

  const handleRename = (tierListId) => {
    const currentName = getDisplayName(tierListId)
    setEditingId(tierListId)
    setEditName(currentName)
  }

  const handleSaveRename = (tierListId) => {
    const currentDisplayName = getDisplayName(tierListId)
    if (editName.trim() && editName !== currentDisplayName) {
      renameTierList(tierListId, editName.trim())
      const { tierLists: updatedTierLists } = getSavedTierLists()
      setTierLists(updatedTierLists)
      if (tierListId === currentTierListId) {
        onTierListChange(tierListId)
      }
    }
    setEditingId(null)
    setEditName('')
  }

  const handleSwitch = (tierListId) => {
    setActiveTierList(tierListId)
    onTierListChange(tierListId)
    setIsOpen(false)
  }

  const handleExport = () => {
    const json = exportTierListToJson(currentTierListId)
    if (!json) {
      alert('Failed to export tier list')
      return
    }

    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tier-list-${currentTierListId}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const jsonString = event.target.result
        const name = prompt('Enter a name for this tier list:', file.name.replace('.json', ''))
        if (!name || !name.trim()) {
          return
        }

        const result = importTierListFromJson(jsonString, name.trim())
        if (result.success) {
          const { tierLists: updatedTierLists } = getSavedTierLists()
          setTierLists(updatedTierLists)
          setActiveTierList(result.tierListId)
          onTierListChange(result.tierListId)
          setShowImport(false)
          setIsOpen(false)
          alert('Tier list imported successfully!')
        } else {
          alert(`Failed to import tier list: ${result.error}`)
        }
      } catch (err) {
        alert(`Failed to read file: ${err.message}`)
      }
    }
    reader.readAsText(file)
    e.target.value = '' // Reset input
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          onClick={() => {
            // Refresh tier lists when opening dropdown
            const { tierLists: updatedTierLists } = getSavedTierLists()
            setTierLists(updatedTierLists)
            setIsOpen(!isOpen)
          }}
          className="pill-button"
          style={{ fontSize: '0.9rem' }}
        >
          {getDisplayName(currentTierListId)} ▼
        </button>
        <button
          onClick={handleCreateNew}
          className="pill-button"
          style={{ fontSize: '0.9rem' }}
        >
          + New
        </button>
        <button
          onClick={handleExport}
          className="pill-button"
          style={{ fontSize: '0.9rem' }}
        >
          Export
        </button>
        <button
          onClick={handleImport}
          className="pill-button"
          style={{ fontSize: '0.9rem' }}
        >
          Import
        </button>
        {onLoadDefault && (
          <button
            onClick={onLoadDefault}
            disabled={isReadOnly}
            className="pill-button"
            style={{ 
              fontSize: '0.9rem',
              opacity: isReadOnly ? 0.5 : 1,
              cursor: isReadOnly ? 'not-allowed' : 'pointer'
            }}
          >
            Reset
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {isOpen && (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1000,
            minWidth: '300px',
            maxHeight: '400px',
            overflowY: 'auto',
            marginTop: '0.5rem',
            boxShadow: '0 8px 24px rgba(0,0,0,.4)'
          }}
        >
          <div style={{ padding: '0.5rem', borderBottom: '1px solid #2a2f3f' }}>
            <strong>Tier Lists</strong>
          </div>
          <div>
            {Object.entries(tierLists)
              .sort(([aId], [bId]) => {
                // Sort: default first, then merc, then others alphabetically
                if (aId === 'default') return -1
                if (bId === 'default') return 1
                if (aId === 'merc') return -1
                if (bId === 'merc') return 1
                return getDisplayName(aId).localeCompare(getDisplayName(bId))
              })
              .map(([id, tierList]) => (
              <div
                key={id}
                style={{
                  padding: '0.75rem',
                  borderBottom: '1px solid #2a2f3f',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: id === currentTierListId ? '#1a1f2b' : 'transparent'
                }}
              >
                {editingId === id ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveRename(id)
                        } else if (e.key === 'Escape') {
                          setEditingId(null)
                          setEditName('')
                        }
                      }}
                      onBlur={() => handleSaveRename(id)}
                      autoFocus
                      style={{
                        flex: 1,
                        padding: '0.25rem 0.5rem',
                        background: 'var(--panel)',
                        border: '1px solid var(--accent)',
                        borderRadius: '4px',
                        color: 'var(--text)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleSwitch(id)}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        padding: '0.25rem 0',
                        fontSize: '0.9rem'
                      }}
                    >
                      {getDisplayName(id)}
                    </button>
                    {!tierList.isReadOnly && (
                      <button
                        onClick={() => handleRename(id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          fontSize: '0.9rem'
                        }}
                        title="Rename"
                      >
                        ✏️
                      </button>
                    )}
                    {tierList.isReadOnly && (
                      <span
                        style={{
                          color: 'var(--muted)',
                          padding: '0.25rem',
                          fontSize: '0.9rem'
                        }}
                        title="Read-only tier list"
                      >
                        🔒
                      </span>
                    )}
                    {id !== 'default' && id !== 'merc' && !tierList.isReadOnly && (
                      <button
                        onClick={() => handleDelete(id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          fontSize: '0.9rem'
                        }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

