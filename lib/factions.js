export const FACTION_LABELS = {
  IMP: 'Imperium',
  CHAOS: 'Chaos',
  SPEC: 'Spec Ops',
  HBR: 'Homebrew'
}

export const FACTION_ORDER = ['Imperium', 'Chaos', 'Xenos', 'Spec Ops', 'Homebrew']

export function getFactionName(factionId) {
  if (!factionId) return 'Xenos'
  const normalized = String(factionId).toUpperCase()
  return FACTION_LABELS[normalized] || 'Xenos'
}
