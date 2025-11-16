// components/TierList.js
import { useState } from 'react'
import React from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Helper function to get kill team initials from killteamId
function getKillTeamInitials(killteamId) {
  if (!killteamId) return '??'
  // Extract the part after the last dash (e.g., "AEL-BOK" -> "BOK")
  const parts = killteamId.split('-')
  if (parts.length > 1) {
    return parts[parts.length - 1]
  }
  // Fallback: use first 3 characters
  return killteamId.substring(0, 3).toUpperCase()
}

function KillTeamCard({ killteam, isDragging = false }) {
  const [imageError, setImageError] = useState(false)
  const imagePath = `/img/teams/${killteam.killteamId}.jpg`
  const initials = getKillTeamInitials(killteam.killteamId)

  return (
    <Link
      href={`/killteams/${killteam.killteamId}`}
      className="card"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        marginBottom: '0.5rem',
        padding: 0,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        transition: 'opacity 0.2s',
        overflow: 'hidden',
        borderRadius: '8px',
        width: '100px',
        height: '100px',
        position: 'relative'
      }}
      title={killteam.killteamName}
    >
      {!imageError ? (
        <img
          src={imagePath}
          alt={killteam.killteamName}
          style={{
            objectFit: 'cover',
            width: '100%',
            height: '100%',
            display: 'block'
          }}
          onError={() => setImageError(true)}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--panel)',
            border: '2px solid var(--accent)',
            color: 'var(--accent)',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          {initials}
        </div>
      )}
    </Link>
  )
}

function SortableKillTeamCard({ killteam, isReadOnly = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: killteam.killteamId, disabled: isReadOnly })

  const [imageError, setImageError] = useState(false)
  const imagePath = `/img/teams/${killteam.killteamId}.jpg`
  const initials = getKillTeamInitials(killteam.killteamId)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Link
        href={`/killteams/${killteam.killteamId}`}
        className="card"
        style={{
          display: 'block',
          textDecoration: 'none',
          color: 'inherit',
          padding: 0,
          cursor: isReadOnly ? 'pointer' : 'grab',
          position: 'relative',
          flexShrink: 0,
          width: '100px',
          height: '100px',
          overflow: 'hidden',
          borderRadius: '8px'
        }}
        {...(isReadOnly ? {} : { ...attributes, ...listeners })}
        title={killteam.killteamName}
      >
        {!imageError ? (
          <img
            src={imagePath}
            alt={killteam.killteamName}
            style={{
              objectFit: 'cover',
              width: '100%',
              height: '100%',
              display: 'block'
            }}
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--panel)',
              border: '2px solid var(--accent)',
              color: 'var(--accent)',
              fontSize: '1.5rem',
              fontWeight: 'bold'
            }}
          >
            {initials}
          </div>
        )}
      </Link>
    </div>
  )
}

// Drop zone component for placing tiers between other tiers
function DropZoneBetweenTiers({ beforeTier, afterTier, isDraggingTier, isReadOnly, draggedTierName, tierOrder }) {
  // Use index-based ID to avoid issues with special characters in tier names
  // Store the actual tier names in data attributes for easy retrieval
  const dropZoneId = `drop-zone-${beforeTier || 'start'}-${afterTier || 'end'}`
  
  // Check if dropping here would result in the same position
  let wouldBeSamePosition = false
  if (draggedTierName && tierOrder) {
    const sourceIndex = tierOrder.indexOf(draggedTierName)
    let targetIndex
    
    if (afterTier === null) {
      // Insert at the end
      targetIndex = tierOrder.length
    } else {
      // Insert before the "afterTier"
      targetIndex = tierOrder.indexOf(afterTier)
      if (targetIndex === -1) {
        targetIndex = tierOrder.length
      }
    }
    
    // Check if the position would be the same
    // Same position if: sourceIndex === targetIndex (dropping before itself) or sourceIndex === targetIndex - 1 (dropping after itself)
    if (sourceIndex !== -1 && targetIndex !== -1) {
      wouldBeSamePosition = sourceIndex === targetIndex || sourceIndex === targetIndex - 1
    }
  }
  
  const { setNodeRef, isOver } = useDroppable({
    id: dropZoneId,
    disabled: isReadOnly || !isDraggingTier || wouldBeSamePosition
  })

  if (!isDraggingTier) return null

  return (
    <div
      ref={setNodeRef}
      data-before-tier={beforeTier || null}
      data-after-tier={afterTier || null}
      style={{
        height: isOver && !wouldBeSamePosition ? '16px' : '12px',
        backgroundColor: isOver && !wouldBeSamePosition ? 'var(--accent)' : 'rgba(251, 146, 60, 0.3)',
        borderRadius: '4px',
        transition: 'height 0.2s, background-color 0.2s',
        margin: '0.1rem 0',
        minHeight: '12px',
        position: 'relative',
        zIndex: isOver && !wouldBeSamePosition ? 10 : 1,
        cursor: wouldBeSamePosition ? 'not-allowed' : 'pointer',
        opacity: wouldBeSamePosition ? 0.3 : 1
      }}
    />
  )
}

function SortableTierColumn({ tierName, killteams, onRename, onDeleteTier, canDelete, isReadOnly = false, isDragging = false, isTierBeingDragged = false, backgroundColor }) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(tierName)
  const {
    setNodeRef: setDroppableRef,
    isOver
  } = useDroppable({
    id: `tier-${tierName}`,
    disabled: isReadOnly || isTierBeingDragged  // Disable droppable when a tier is being dragged
  })
  
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition
  } = useSortable({
    id: `tier-column-${tierName}`,
    disabled: isReadOnly || isTierBeingDragged  // Disable sortable when any tier is being dragged
  })
  
  const style = {
    transform: isTierBeingDragged ? 'none' : CSS.Transform.toString(transform), // Disable transform when tier is being dragged
    transition: isTierBeingDragged ? 'none' : transition, // Disable transition when tier is being dragged
    opacity: isDragging ? 0.5 : 1
  }
  
  // Combine refs
  const setNodeRef = (node) => {
    setDroppableRef(node)
    setSortableRef(node)
  }

  const handleRename = () => {
    if (editName.trim() && editName !== tierName) {
      onRename(tierName, editName.trim())
    } else {
      setEditName(tierName)
    }
    setIsEditingName(false)
  }

  // Calculate background color with opacity for better contrast
  const baseBgColor = backgroundColor || 'var(--panel)'
  const bgColorWithOpacity = backgroundColor
    ? backgroundColor.replace('rgb(', 'rgba(').replace(')', ', 0.15)')
    : 'var(--panel)'
  const bgColorOnHover = backgroundColor
    ? backgroundColor.replace('rgb(', 'rgba(').replace(')', ', 0.25)')
    : 'rgba(251, 146, 60, 0.1)'
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        margin: '0.1rem 0',
        gap: '0.25rem'
      }}
    >
      {canDelete && !isReadOnly && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDeleteTier(tierName)
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: '0',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            alignSelf: 'center'
          }}
          aria-label="Delete tier"
          title="Delete tier"
        >
          ×
        </button>
      )}
      <div
        ref={setNodeRef}
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          border: isOver ? '2px solid var(--accent)' : '1px solid #2a2f3f',
          backgroundColor: isOver ? bgColorOnHover : bgColorWithOpacity,
          transition: 'border-color 0.2s, background-color 0.2s',
          minHeight: '80px',
          flex: 1,
          ...style
        }}
      >
          <div
            style={{
              padding: '0.15rem 0.15rem',
              borderRight: '1px solid #2a2f3f',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.25rem',
              width: 'auto',
              minWidth: '40px',
              flexShrink: 0,
              cursor: isReadOnly ? 'default' : 'grab',
              userSelect: 'none'
            }}
            {...(isReadOnly ? {} : { ...attributes, ...listeners })}
          >
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto', justifyContent: 'center', position: 'relative' }}
          onClick={(e) => e.stopPropagation()}
        >
          {isEditingName ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename()
                } else if (e.key === 'Escape') {
                  setEditName(tierName)
                  setIsEditingName(false)
                }
              }}
              autoFocus
              style={{
                flex: 1,
                padding: '0.15rem 0.25rem',
                background: 'var(--panel)',
                border: '1px solid var(--accent)',
                borderRadius: '4px',
                color: 'var(--text)',
                fontSize: '1rem',
                fontWeight: 'bold',
                textAlign: 'center'
              }}
            />
          ) : (
            <h3
              style={{
                margin: 0,
                fontSize: '1.2rem',
                fontWeight: 'bold',
                cursor: isReadOnly ? 'default' : 'pointer',
                flex: 1,
                textAlign: 'center',
                userSelect: 'none'
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (!isReadOnly) setIsEditingName(true)
              }}
              title={isReadOnly ? undefined : "Click to rename"}
            >
              {tierName}
            </h3>
          )}
        </div>
      </div>
      <div
        style={{
          padding: '0.05rem 0.05rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: '0.25rem',
          minHeight: '60px',
          alignItems: 'center',
          justifyContent: killteams.length === 0 ? 'center' : 'flex-start'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {killteams.length === 0 ? (
          <div
            style={{
              color: 'var(--muted)',
              textAlign: 'center',
              padding: '0.05rem',
              fontSize: '0.9rem',
              width: '100%'
            }}
          >
            Drop kill teams here
          </div>
        ) : (
          <SortableContext items={killteams.map(kt => kt.killteamId)} strategy={horizontalListSortingStrategy} disabled={isReadOnly}>
            {killteams.map((killteam) => (
              <SortableKillTeamCard
                key={killteam.killteamId}
                killteam={killteam}
                isReadOnly={isReadOnly}
              />
            ))}
          </SortableContext>
        )}
      </div>
      </div>
    </div>
  )
}

export default function TierList({
  tiers,
  tierOrder,
  killteamsMap,
  onTierChange,
  onRenameTier,
  onDeleteTier,
  onAddTier,
  onReorderTiers,
  isReadOnly = false
}) {
  const [activeId, setActiveId] = useState(null)
  const [draggedTier, setDraggedTier] = useState(null)
  const [draggedTierName, setDraggedTierName] = useState(null)
  
  // Get tier order - use tierOrder prop if available, otherwise use Object.keys(tiers)
  const orderedTierNames = tierOrder || Object.keys(tiers)

  // Get all kill teams that are not in any tier
  const getUnassignedKillteams = () => {
    const assignedIds = new Set()
    Object.values(tiers).forEach(tierIds => {
      tierIds.forEach(id => assignedIds.add(id))
    })
    
    return Object.values(killteamsMap).filter(kt => 
      !assignedIds.has(kt.killteamId) && 
      kt.factionId !== 'SPEC' && 
      kt.factionID !== 'SPEC'
    )
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Get kill team objects for each tier
  const getKillteamsForTier = (tierName) => {
    const killteamIds = tiers[tierName] || []
    return killteamIds
      .map(id => killteamsMap[id])
      .filter(kt => kt && kt.factionId !== 'SPEC' && kt.factionID !== 'SPEC')
  }

  const [overDropZone, setOverDropZone] = useState(null)

  const handleDragStart = (event) => {
    // Prevent dragging if read-only
    if (isReadOnly) {
      event.preventDefault()
      return
    }
    
    const { active } = event
    const activeId = active.id
    
    // Check if dragging a tier column (starts with "tier-column-")
    if (activeId.startsWith('tier-column-')) {
      const tierName = activeId.replace('tier-column-', '')
      setDraggedTierName(tierName)
      setOverDropZone(null)
      return
    }
    
    // Otherwise, it's a kill team
    setActiveId(activeId)
    
    // Find which tier this kill team belongs to
    for (const [tierName, killteamIds] of Object.entries(tiers)) {
      if (killteamIds.includes(activeId)) {
        setDraggedTier(tierName)
        break
      }
    }
  }

  const handleDragOver = (event) => {
    if (!draggedTierName) return
    
    const { over } = event
    // Only track drop zones, ignore tier columns
    if (over?.id && over.id.startsWith('drop-zone-')) {
      setOverDropZone(over.id)
    } else if (over?.id && over.id.startsWith('tier-column-')) {
      // Ignore tier columns - don't update overDropZone
      // This prevents visual reordering when dragging over tier columns
      setOverDropZone(null)
    } else {
      setOverDropZone(null)
    }
  }

  const handleDragEnd = (event) => {
    // Prevent drag end if read-only
    if (isReadOnly) {
      setActiveId(null)
      setDraggedTier(null)
      setDraggedTierName(null)
      setOverDropZone(null)
      return
    }
    
    const { active, over } = event
    const activeId = active.id
    // Use over?.id if available, otherwise fall back to the last hovered drop zone
    const overId = over?.id || overDropZone

    // Handle tier column reordering
    if (activeId.startsWith('tier-column-')) {
      const sourceTierName = activeId.replace('tier-column-', '')
      
      // Only allow dropping on drop zones, not on tier columns
      if (overId && overId.startsWith('drop-zone-')) {
        // Extract tier names from drop zone ID: "drop-zone-{beforeTier}-{afterTier}"
        const dropZoneId = overId.replace('drop-zone-', '')
        let afterTier = null
        
        // Parse the drop zone ID to get before and after tier
        // Format: "beforeTier-afterTier" or "beforeTier-end" or "start-afterTier" or "null-afterTier"
        if (dropZoneId.endsWith('-end')) {
          // Insert at the end (format: "beforeTier-end")
          afterTier = null
        } else if (dropZoneId.startsWith('start-')) {
          // Insert at the beginning (format: "start-afterTier")
          const afterPart = dropZoneId.substring(6) // Remove "start-"
          afterTier = afterPart === 'end' ? null : afterPart
        } else if (dropZoneId.startsWith('null-')) {
          // Insert at the beginning (format: "null-afterTier")
          const afterPart = dropZoneId.substring(5) // Remove "null-"
          afterTier = afterPart === 'end' ? null : afterPart
        } else {
          // Find the matching tier names by checking each tier
          // Try longest match first to handle tier names that might be substrings of others
          const sortedTiers = [...orderedTierNames].sort((a, b) => b.length - a.length)
          for (const tier of sortedTiers) {
            if (dropZoneId.startsWith(tier + '-')) {
              const afterPart = dropZoneId.substring(tier.length + 1)
              // Check if it's "end"
              if (afterPart === 'end') {
                afterTier = null
              } else {
                // Find the tier that matches the after part
                for (const otherTier of orderedTierNames) {
                  if (dropZoneId === tier + '-' + otherTier) {
                    afterTier = otherTier
                    break
                  }
                }
              }
              break
            }
          }
        }
        
        if (onReorderTiers) {
          const sourceIndex = orderedTierNames.indexOf(sourceTierName)
          let targetIndex
          
          if (afterTier === null) {
            // Insert at the end
            targetIndex = orderedTierNames.length
          } else {
            // Insert before the "afterTier"
            targetIndex = orderedTierNames.indexOf(afterTier)
            if (targetIndex === -1) {
              // Fallback: insert at the end if tier not found
              targetIndex = orderedTierNames.length
            }
          }
          
          // Only reorder if the position actually changes
          if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
            // Remove from source position
            const newTierOrder = [...orderedTierNames]
            newTierOrder.splice(sourceIndex, 1)
            
            // Adjust target index if source was before target
            const adjustedTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
            
            // Insert at target position
            newTierOrder.splice(adjustedTargetIndex, 0, sourceTierName)
            onReorderTiers(newTierOrder)
          }
        }
      }
      
      // Reset drag state
      setDraggedTierName(null)
      setOverDropZone(null)
      return
    }

    setActiveId(null)
    setDraggedTier(null)
    setDraggedTierName(null)

    if (!over) return

    const overIdFinal = over.id

    // Find source tier (null if from unassigned)
    let sourceTier = null
    for (const [tierName, killteamIds] of Object.entries(tiers)) {
      if (killteamIds.includes(activeId)) {
        sourceTier = tierName
        break
      }
    }

    // Check if dropping on a tier column (droppable) - check this FIRST
    if (overIdFinal && overIdFinal.startsWith('tier-') && !overIdFinal.startsWith('tier-column-')) {
      const targetTier = overIdFinal.replace('tier-', '')
      
      if (sourceTier && targetTier !== sourceTier) {
        // Moving from one tier to another
        const newSourceIds = tiers[sourceTier].filter(id => id !== activeId)
        const newTargetIds = [...(tiers[targetTier] || []), activeId]
        
        onTierChange(sourceTier, newSourceIds)
        onTierChange(targetTier, newTargetIds)
      } else if (!sourceTier) {
        // Moving from staging area to tier
        const newTargetIds = [...(tiers[targetTier] || []), activeId]
        onTierChange(targetTier, newTargetIds)
      } else {
        // Same tier, do nothing
      }
      return
    }

    // Check if dropping on another kill team in a tier
    // First, find which tier the target kill team belongs to
    let targetTier = null
    for (const [tierName, killteamIds] of Object.entries(tiers)) {
      if (killteamIds.includes(overIdFinal)) {
        targetTier = tierName
        break
      }
    }

    if (targetTier && targetTier !== sourceTier) {
      // Moving to different tier (dropped on a kill team in another tier)
      const newSourceIds = sourceTier ? tiers[sourceTier].filter(id => id !== activeId) : []
      const targetKillteams = getKillteamsForTier(targetTier)
      const targetIndex = targetKillteams.findIndex(kt => kt.killteamId === overIdFinal)
      
      // Insert at the position of the target kill team
      const newTargetIds = [...(tiers[targetTier] || [])]
      newTargetIds.splice(targetIndex + 1, 0, activeId)
      
      if (sourceTier) {
        onTierChange(sourceTier, newSourceIds)
      }
      onTierChange(targetTier, newTargetIds)
      return
    }

    // Check if dropping on staging area (unassigned) - either directly or on a kill team in staging area
    if (overIdFinal === 'staging-area') {
      if (sourceTier) {
        // Moving from tier to staging area
        const newSourceIds = tiers[sourceTier].filter(id => id !== activeId)
        onTierChange(sourceTier, newSourceIds)
      }
      // If already unassigned, do nothing
      return
    }

    // Check if dropping on a kill team that's unassigned (in staging area)
    // Only check this if we haven't found the target in any tier above
    if (!targetTier && sourceTier) {
      // Check if overIdFinal is a valid killteamId and not in any tier (unassigned)
      const isTargetUnassigned = killteamsMap[overIdFinal] && !Object.values(tiers).some(tierIds => tierIds.includes(overIdFinal))
      if (isTargetUnassigned) {
        // Moving from tier to staging area (dropped on an unassigned kill team)
        const newSourceIds = tiers[sourceTier].filter(id => id !== activeId)
        onTierChange(sourceTier, newSourceIds)
        return
      }
    }

    // Check if dropping on another kill team (same tier reorder)
    if (sourceTier) {
      const sourceKillteams = getKillteamsForTier(sourceTier)
      const sourceIndex = sourceKillteams.findIndex(kt => kt.killteamId === activeId)
      const overIndex = sourceKillteams.findIndex(kt => kt.killteamId === overIdFinal)

      if (sourceIndex !== -1 && overIndex !== -1 && sourceIndex !== overIndex) {
        // Reordering within same tier
        const newOrder = arrayMove(sourceKillteams.map(kt => kt.killteamId), sourceIndex, overIndex)
        onTierChange(sourceTier, newOrder)
      }
    }
  }


  const activeKillteam = activeId ? killteamsMap[activeId] : null
  const activeTier = draggedTierName ? {
    tierName: draggedTierName,
    killteams: getKillteamsForTier(draggedTierName)
  } : null
  const unassignedKillteams = getUnassignedKillteams()
  
  // Staging area droppable (always enabled when not read-only, so teams can be dropped there)
  const { setNodeRef: setStagingNodeRef, isOver: isStagingOver } = useDroppable({
    id: 'staging-area',
    disabled: isReadOnly
  })

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div>
        <SortableContext items={orderedTierNames.map(tier => `tier-column-${tier}`)} strategy={verticalListSortingStrategy} disabled={isReadOnly || !!draggedTierName}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0'
            }}
          >
            {orderedTierNames.map((tierName, index) => {
              const killteams = getKillteamsForTier(tierName)
              // Calculate gradient position: 0 (first tier) = green, 1 (last tier) = red
              const totalTiers = orderedTierNames.length
              const gradientPosition = totalTiers > 1 ? index / (totalTiers - 1) : 0
              
              // Interpolate between green (rgb(34, 197, 94)) and red (rgb(239, 68, 68))
              const red = Math.round(34 + (239 - 34) * gradientPosition)
              const green = Math.round(197 - (197 - 68) * gradientPosition)
              const blue = Math.round(94 - (94 - 68) * gradientPosition)
              const backgroundColor = `rgb(${red}, ${green}, ${blue})`
              
              return (
                <React.Fragment key={tierName}>
                  {/* Drop zone before each tier */}
                  {index === 0 ? (
                    <DropZoneBetweenTiers
                      beforeTier={null}
                      afterTier={tierName}
                      isDraggingTier={!!draggedTierName}
                      isReadOnly={isReadOnly}
                      draggedTierName={draggedTierName}
                      tierOrder={orderedTierNames}
                    />
                  ) : (
                    <DropZoneBetweenTiers
                      beforeTier={orderedTierNames[index - 1]}
                      afterTier={tierName}
                      isDraggingTier={!!draggedTierName}
                      isReadOnly={isReadOnly}
                      draggedTierName={draggedTierName}
                      tierOrder={orderedTierNames}
                    />
                  )}
                  <SortableTierColumn
                    tierName={tierName}
                    killteams={killteams}
                    onRename={onRenameTier}
                    onDeleteTier={onDeleteTier}
                    canDelete={true}
                    isReadOnly={isReadOnly}
                    isDragging={draggedTierName === tierName}
                    isTierBeingDragged={!!draggedTierName}
                    backgroundColor={backgroundColor}
                  />
                  {/* Drop zone after the last tier */}
                  {index === orderedTierNames.length - 1 && (
                    <DropZoneBetweenTiers
                      beforeTier={tierName}
                      afterTier={null}
                      isDraggingTier={!!draggedTierName}
                      isReadOnly={isReadOnly}
                      draggedTierName={draggedTierName}
                      tierOrder={orderedTierNames}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </SortableContext>
        {onAddTier && !isReadOnly && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <button
              onClick={onAddTier}
              className="pill-button"
              style={{
                padding: '1rem 2rem',
                fontSize: '1rem'
              }}
            >
              + Add Tier
            </button>
          </div>
        )}
        
        {/* Staging area for unassigned kill teams */}
        <div
          ref={setStagingNodeRef}
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            margin: '0.1rem 0',
            border: isStagingOver ? '2px solid var(--accent)' : '1px solid #2a2f3f',
            backgroundColor: isStagingOver ? 'rgba(251, 146, 60, 0.1)' : 'var(--panel)',
            transition: 'border-color 0.2s, background-color 0.2s',
            minHeight: '120px'
          }}
        >
          <div
            style={{
              padding: '0.25rem 0.5rem',
              borderRight: '1px solid #2a2f3f',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              width: 'auto',
              minWidth: '80px',
              flexShrink: 0
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: 'var(--muted)'
              }}
            >
              Unassigned
            </h3>
          </div>
          <div
            style={{
              padding: '0.15rem 0.25rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: '0.25rem',
              minHeight: '60px',
              alignItems: 'center',
              justifyContent: unassignedKillteams.length === 0 ? 'center' : 'flex-start'
            }}
          >
            {unassignedKillteams.length === 0 ? (
              <div
                style={{
                  color: 'var(--muted)',
                  textAlign: 'center',
                  padding: '1rem',
                  fontSize: '0.9rem',
                  width: '100%',
                  pointerEvents: 'none'
                }}
              >
                Drop kill teams here
              </div>
            ) : (
              <SortableContext items={unassignedKillteams.map(kt => kt.killteamId)} strategy={horizontalListSortingStrategy} disabled={isReadOnly}>
                {unassignedKillteams.map((killteam) => (
                  <SortableKillTeamCard
                    key={killteam.killteamId}
                    killteam={killteam}
                    isReadOnly={isReadOnly}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeTier ? (
          <div
            style={{
              opacity: 0.9,
              transform: 'rotate(2deg)',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            <div
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'stretch',
                border: '2px solid var(--accent)',
                backgroundColor: 'var(--panel)',
                minHeight: '60px',
                minWidth: '400px'
              }}
            >
              <div
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRight: '1px solid #2a2f3f',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.25rem',
                  width: 'auto',
                  minWidth: '80px',
                  flexShrink: 0,
                  backgroundColor: 'var(--accent)',
                  color: 'var(--bg)'
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                    textAlign: 'center'
                  }}
                >
                  {activeTier.tierName}
                </h3>
              </div>
              <div
                style={{
                  padding: '0.15rem 0.25rem',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: '0.25rem',
                  alignItems: 'flex-start'
                }}
              >
                {activeTier.killteams.slice(0, 3).map((killteam) => (
                  <div
                    key={killteam.killteamId}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg)',
                      border: '1px solid #2a2f3f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      color: 'var(--muted)'
                    }}
                  >
                    {killteam.killteamName.substring(0, 2)}
                  </div>
                ))}
                {activeTier.killteams.length > 3 && (
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg)',
                      border: '1px solid #2a2f3f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      color: 'var(--muted)'
                    }}
                  >
                    +{activeTier.killteams.length - 3}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeKillteam ? (
          <div
            style={{
              opacity: 0.8,
              transform: 'rotate(5deg)'
            }}
          >
            <KillTeamCard killteam={activeKillteam} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

