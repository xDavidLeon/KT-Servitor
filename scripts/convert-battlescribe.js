const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Configuration
const BATTLESCRIBE_DIR = path.join(__dirname, '..', 'battlescribe');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'v1');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper function to sanitize IDs
function sanitizeId(str) {
  if (!str) return 'unknown';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// Extract text from XML node (handles xml2js array structure)
function getText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) {
    // xml2js with explicitArray wraps text in arrays
    const first = node[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      if (first._) return first._;
      // Sometimes it's an object with the text as a property
      const keys = Object.keys(first);
      if (keys.length > 0 && typeof first[keys[0]] === 'string') {
        return first[keys[0]];
      }
    }
    return '';
  }
  if (node._) return node._;
  return '';
}

// Extract attributes (handles xml2js with mergeAttrs: true)
function getAttr(node, attr) {
  if (!node || !attr) return null;
  if (Array.isArray(node)) {
    // If it's an array, check the first element
    const first = node[0];
    if (first && typeof first === 'object') {
      // With mergeAttrs: true, attributes are merged directly into the node
      if (Array.isArray(first[attr])) {
        return first[attr][0] || null;
      }
      return first[attr] || null;
    }
    return null;
  }
  // With mergeAttrs: true, attributes are merged directly
  if (node[attr]) {
    if (Array.isArray(node[attr])) {
      return node[attr][0] || null;
    }
    return node[attr];
  }
  return null;
}

// Parse operative stats from profiles (APL, MOVE, SAVE, WOUNDS)
function parseOperativeStats(profiles) {
  const stats = {
    apl: null,
    move: null,
    save: null,
    wounds: null
  };
  if (!profiles) return stats;
  
  // Handle xml2js structure: profiles can be an array or object with profile array
  let profileArray = [];
  if (Array.isArray(profiles)) {
    profiles.forEach(item => {
      if (item && typeof item === 'object') {
        if (item.profile) {
          const profs = Array.isArray(item.profile) ? item.profile : [item.profile];
          profileArray.push(...profs);
        } else {
          profileArray.push(item);
        }
      }
    });
  } else if (profiles.profile) {
    profileArray = Array.isArray(profiles.profile) ? profiles.profile : [profiles.profile];
  } else {
    profileArray = [profiles];
  }
  
  profileArray.forEach(profile => {
    if (!profile) return;
    const typeId = getAttr(profile, 'typeId');
    const typeName = getText(profile.typeName) || getAttr(profile, 'typeName');
    
    // Handle characteristics array structure
    let characteristics = [];
    if (profile.characteristics) {
      if (Array.isArray(profile.characteristics)) {
        profile.characteristics.forEach(item => {
          if (item && typeof item === 'object') {
            if (item.characteristic) {
              const chars = Array.isArray(item.characteristic) ? item.characteristic : [item.characteristic];
              characteristics.push(...chars);
            } else {
              characteristics.push(item);
            }
          }
        });
      } else if (profile.characteristics.characteristic) {
        characteristics = Array.isArray(profile.characteristics.characteristic) 
          ? profile.characteristics.characteristic 
          : [profile.characteristics.characteristic];
      } else {
        characteristics = [profile.characteristics];
      }
    }
    
    // Look for operative stats profile
    // BattleScribe uses typeName="Operative" for Kill Team operatives
    if (typeId === 'battlescribe-stats' || typeName === 'Operative' || typeName === 'Stats') {
      characteristics.forEach(char => {
        if (!char) return;
        const name = getAttr(char, 'name');
        const value = getText(char);
        if (name && value) {
          // Map BattleScribe stat names to Kill Team format
          const nameUpper = name.toUpperCase();
          if (nameUpper === 'APL' || nameUpper === 'ACTION POINT LIMIT') {
            stats.apl = parseInt(value) || value;
          } else if (nameUpper === 'M' || nameUpper === 'MOVE' || nameUpper === 'MOVEMENT') {
            stats.move = value;
          } else if (nameUpper === 'SV' || nameUpper === 'SAVE') {
            stats.save = value;
          } else if (nameUpper === 'W' || nameUpper === 'WOUNDS') {
            stats.wounds = parseInt(value) || value;
          }
          // Debug: log all characteristics found
          // console.log(`        Characteristic: ${name} = ${value}`);
        }
      });
    }
  });
  
  return stats;
}

// Normalize selectionEntries from xml2js structure
function normalizeSelectionEntries(selectionEntries) {
  if (!selectionEntries) return [];
  if (Array.isArray(selectionEntries)) {
    const normalized = [];
    selectionEntries.forEach(item => {
      if (item && typeof item === 'object') {
        // Check if it has a selectionEntry property (wrapped structure)
        if (item.selectionEntry) {
          const entries = Array.isArray(item.selectionEntry) ? item.selectionEntry : [item.selectionEntry];
          normalized.push(...entries);
        } else {
          // It's a direct entry
          normalized.push(item);
        }
      }
    });
    return normalized;
  } else if (selectionEntries.selectionEntry) {
    // It's an object with selectionEntry array
    return Array.isArray(selectionEntries.selectionEntry) 
      ? selectionEntries.selectionEntry 
      : [selectionEntries.selectionEntry];
  } else {
    // It's a single entry object
    return [selectionEntries];
  }
}

// Normalize profiles from xml2js structure
function normalizeProfiles(profiles) {
  if (!profiles) return [];
  if (Array.isArray(profiles)) {
    const normalized = [];
    profiles.forEach(item => {
      if (item && typeof item === 'object') {
        if (item.profile) {
          const profs = Array.isArray(item.profile) ? item.profile : [item.profile];
          normalized.push(...profs);
        } else {
          normalized.push(item);
        }
      }
    });
    return normalized;
  } else if (profiles.profile) {
    return Array.isArray(profiles.profile) ? profiles.profile : [profiles.profile];
  } else {
    return [profiles];
  }
}

// Normalize characteristics from xml2js structure
function normalizeCharacteristics(characteristics) {
  if (!characteristics) return [];
  if (Array.isArray(characteristics)) {
    const normalized = [];
    characteristics.forEach(item => {
      if (item && typeof item === 'object') {
        if (item.characteristic) {
          const chars = Array.isArray(item.characteristic) ? item.characteristic : [item.characteristic];
          normalized.push(...chars);
        } else {
          normalized.push(item);
        }
      }
    });
    return normalized;
  } else if (characteristics.characteristic) {
    return Array.isArray(characteristics.characteristic) 
      ? characteristics.characteristic 
      : [characteristics.characteristic];
  } else {
    return [characteristics];
  }
}

// Extract weapons with full details (ATK, HIT, DMG, WR)
// This function is recursive to handle deeply nested weapon structures
function extractWeaponsDetailed(selectionEntry, depth = 0, parentGroupName = null) {
  const weapons = [];
  if (!selectionEntry || depth > 10) return weapons; // Prevent infinite recursion
  
  // Normalize selectionEntryGroups
  let groups = [];
  if (selectionEntry.selectionEntryGroups) {
    if (Array.isArray(selectionEntry.selectionEntryGroups)) {
      selectionEntry.selectionEntryGroups.forEach(item => {
        if (item && typeof item === 'object') {
          if (item.selectionEntryGroup) {
            const groupItems = Array.isArray(item.selectionEntryGroup) ? item.selectionEntryGroup : [item.selectionEntryGroup];
            groups.push(...groupItems);
          } else {
            groups.push(item);
          }
        }
      });
    } else if (selectionEntry.selectionEntryGroups.selectionEntryGroup) {
      groups = Array.isArray(selectionEntry.selectionEntryGroups.selectionEntryGroup) 
        ? selectionEntry.selectionEntryGroups.selectionEntryGroup 
        : [selectionEntry.selectionEntryGroups.selectionEntryGroup];
    } else {
      groups = [selectionEntry.selectionEntryGroups];
    }
  }
  
  const entries = normalizeSelectionEntries(selectionEntry.selectionEntries);
  const profiles = normalizeProfiles(selectionEntry.profiles);
  
  // Helper function to extract weapon from a profile
  function extractWeaponFromProfile(profile, entryName = null, weaponTypeHint = null) {
    if (!profile) return null;
    const typeId = getAttr(profile, 'typeId');
    const typeName = getText(profile.typeName) || getAttr(profile, 'typeName');
    const profileName = getText(profile.name) || getAttr(profile, 'name');
    
    if (typeId === 'battlescribe-weapon' || typeName === 'Weapons' || profileName?.includes('⌖') || profileName?.includes('⚔')) {
      // Determine weapon type from symbols or group name
      let weaponType = weaponTypeHint;
      if (!weaponType) {
        if (profileName?.includes('⌖')) {
          weaponType = 'Ranged Weapon';
        } else if (profileName?.includes('⚔')) {
          weaponType = 'Melee Weapon';
        }
      }
      
      const weapon = {
        name: profileName?.replace(/[⌖⚔]/g, '').trim() || entryName || 'Weapon',
        type: weaponType || null, // Store weapon type
        atk: null,
        hit: null,
        dmg: null,
        specialRules: []
      };
      
      const characteristics = normalizeCharacteristics(profile.characteristics);
      characteristics.forEach(char => {
        if (!char) return;
        const charName = getAttr(char, 'name');
        const charValue = getText(char);
        if (charName && charValue) {
          const nameUpper = charName.toUpperCase();
          if (nameUpper === 'ATK' || nameUpper === 'ATTACKS') {
            weapon.atk = charValue;
          } else if (nameUpper === 'HIT') {
            weapon.hit = charValue;
          } else if (nameUpper === 'DMG' || nameUpper === 'DAMAGE') {
            weapon.dmg = charValue;
          } else if (nameUpper === 'WR' || nameUpper === 'WEAPON RULES' || nameUpper === 'SPECIAL') {
            // Parse special rules from WR field
            const rules = charValue.split(',').map(r => r.trim()).filter(r => r);
            weapon.specialRules.push(...rules);
            
            // If weapon type not yet determined, check WR field for "Range" indicator
            if (!weapon.type && charValue.toLowerCase().includes('range')) {
              weapon.type = 'Ranged Weapon';
            }
          }
        }
      });
      
      // Final fallback: if still no type determined and we have special rules, check for Range
      if (!weapon.type && weapon.specialRules.length > 0) {
        const hasRange = weapon.specialRules.some(rule => rule.toLowerCase().includes('range'));
        if (hasRange) {
          weapon.type = 'Ranged Weapon';
        } else {
          // If no range indicator, assume melee (most weapons without range are melee)
          weapon.type = 'Melee Weapon';
        }
      }
      
      // Ensure type is set (final safety check)
      if (!weapon.type) {
        // Default to melee if we can't determine (most weapons are melee)
        weapon.type = 'Melee Weapon';
      }
      
      if (weapon.name && (weapon.atk || weapon.hit || weapon.dmg)) {
        return weapon;
      }
    }
    return null;
  }
  
  // Determine weapon type from parent group name if available
  let weaponTypeFromGroup = null;
  if (parentGroupName) {
    const groupNameLower = parentGroupName.toLowerCase();
    if (groupNameLower.includes('ranged weapon')) {
      weaponTypeFromGroup = 'Ranged Weapon';
    } else if (groupNameLower.includes('melee weapon')) {
      weaponTypeFromGroup = 'Melee Weapon';
    }
  }
  
  // Process profiles directly on the entry
  profiles.forEach(profile => {
    const weapon = extractWeaponFromProfile(profile, null, weaponTypeFromGroup);
    if (weapon) weapons.push(weapon);
  });
  
  // Look for weapon groups (recursively process nested groups)
  groups.forEach(group => {
    if (!group) return;
    const groupName = getText(group.name) || getAttr(group, 'name');
    // Process all groups, not just those with "weapon" in the name, to catch nested structures
    const groupEntries = normalizeSelectionEntries(group.selectionEntries);
    groupEntries.forEach(entry => {
      if (!entry) return;
      // Recursively extract weapons from nested entries, passing group name for context
      const nestedWeapons = extractWeaponsDetailed(entry, depth + 1, groupName);
      weapons.push(...nestedWeapons);
    });
  });
  
  // Also check direct entries (recursively)
  entries.forEach(entry => {
    if (!entry) return;
    // Recursively extract weapons from nested entries
    const nestedWeapons = extractWeaponsDetailed(entry, depth + 1, parentGroupName);
    weapons.push(...nestedWeapons);
  });
  
  // Also check entryLinks for weapon references
  if (selectionEntry.entryLinks) {
    let entryLinksArray = [];
    if (Array.isArray(selectionEntry.entryLinks)) {
      selectionEntry.entryLinks.forEach(item => {
        if (item && typeof item === 'object') {
          if (item.entryLink) {
            const links = Array.isArray(item.entryLink) ? item.entryLink : [item.entryLink];
            entryLinksArray.push(...links);
          } else {
            entryLinksArray.push(item);
          }
        }
      });
    } else if (selectionEntry.entryLinks.entryLink) {
      entryLinksArray = Array.isArray(selectionEntry.entryLinks.entryLink) 
        ? selectionEntry.entryLinks.entryLink 
        : [selectionEntry.entryLinks.entryLink];
    } else {
      entryLinksArray = [selectionEntry.entryLinks];
    }
    
    entryLinksArray.forEach(link => {
      if (!link) return;
      const targetId = getAttr(link, 'targetId');
      // Note: entryLinks reference other entries by targetId, but we can't resolve them here
      // They should be handled by the sharedWeaponsMap in the main processing
    });
  }
  
  return weapons;
}

// Extract weapons from selection entries
function extractWeapons(selectionEntry) {
  const weapons = [];
  const groups = selectionEntry.selectionEntryGroups || [];
  const entries = selectionEntry.selectionEntries || [];
  
  // Look for weapon groups
  groups.forEach(group => {
    if (!group) return;
    const name = getText(group.name) || getAttr(group, 'name');
    if (name && typeof name === 'string' && (name.toLowerCase().includes('weapon') || name.toLowerCase().includes('wargear'))) {
      const groupEntries = normalizeSelectionEntries(group.selectionEntries);
      groupEntries.forEach(entry => {
        if (!entry) return;
        const weaponName = getText(entry.name) || getAttr(entry, 'name');
        if (weaponName) {
          const profiles = entry.profiles || [];
          let weaponStats = null;
          
          profiles.forEach(profile => {
            const typeId = getAttr(profile, 'typeId');
            if (typeId === 'battlescribe-weapon') {
              const characteristics = profile.characteristics || [];
              const stats = [];
              characteristics.forEach(char => {
                const charName = getAttr(char, 'name');
                const charValue = getText(char);
                if (charName && charValue && charName !== 'Name') {
                  stats.push(`${charName}${charValue}`);
                }
              });
              if (stats.length > 0) {
                weaponStats = stats.join(', ');
              }
            }
          });
          
          weapons.push({
            name: weaponName,
            stats: weaponStats
          });
        }
      });
    }
  });
  
  // Also check direct entries
  entries.forEach(entry => {
    if (!entry) return;
    const entryName = getText(entry.name) || getAttr(entry, 'name');
    const profiles = entry.profiles || [];
    profiles.forEach(profile => {
      if (!profile) return;
      const typeId = getAttr(profile, 'typeId');
      if (typeId === 'battlescribe-weapon') {
        const weaponName = getText(profile.name) || entryName;
        if (weaponName) {
          const characteristics = profile.characteristics || [];
          const stats = [];
          characteristics.forEach(char => {
            const charName = getAttr(char, 'name');
            const charValue = getText(char);
            if (charName && charValue && charName !== 'Name') {
              stats.push(`${charName}${charValue}`);
            }
          });
          weapons.push({
            name: weaponName,
            stats: stats.length > 0 ? stats.join(', ') : null
          });
        }
      }
    });
  });
  
  return weapons;
}

// Extract abilities/rules from infoLinks
function extractAbilities(selectionEntry) {
  const abilities = [];
  if (!selectionEntry) return abilities;
  const infoLinks = selectionEntry.infoLinks || [];
  
  infoLinks.forEach(link => {
    if (!link) return;
    const name = getText(link.name) || getAttr(link, 'name');
    const description = getText(link.description) || getText(link.hiddenNotes);
    if (name || description) {
      abilities.push({
        name: name || 'Ability',
        description: description || ''
      });
    }
  });
  
  return abilities;
}

// Parse a BattleScribe roster file (.bsi)
async function parseRoster(filePath) {
  // Read file as buffer first to detect format
  const buffer = fs.readFileSync(filePath);
  
  // Check if it's a ZIP file (starts with PK)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
    console.log('  Error: .bsi file appears to be compressed (ZIP format).');
    console.log('  Please extract it first or use the .cat file instead.');
    return null;
  }
  
  let xml = buffer.toString('utf8');
  
  // Remove BOM if present
  xml = xml.replace(/^\uFEFF/, '');
  
  // .bsi files can be base64-encoded XML
  // Try to detect if it's base64 encoded (no < at start, and valid base64 chars)
  if (!xml.trim().startsWith('<')) {
    const trimmed = xml.trim();
    // Check if it looks like base64 (alphanumeric, +, /, =)
    if (/^[A-Za-z0-9+\/=]+$/.test(trimmed.replace(/\s/g, ''))) {
      try {
        // Try base64 decoding
        xml = Buffer.from(trimmed, 'base64').toString('utf8');
        // Remove BOM again after decoding
        xml = xml.replace(/^\uFEFF/, '');
      } catch (e) {
        console.log('  Warning: Base64 decode failed:', e.message);
      }
    }
  }
  
  // Final check - must start with <
  if (!xml.trim().startsWith('<')) {
    console.log('  Error: File does not appear to be valid XML.');
    console.log('  First 100 characters:', xml.substring(0, 100));
    console.log('  Please ensure the file is a valid BattleScribe XML file.');
    return null;
  }
  
  const parser = new xml2js.Parser({ 
    explicitArray: true,
    mergeAttrs: true,
    explicitCharkey: false
  });
  
  const result = await parser.parseStringPromise(xml);
  const roster = result.roster;
  
  if (!roster) {
    return null;
  }
  
  // Extract catalogue reference
  const catalogueLinks = roster.catalogueLinks || [];
  if (catalogueLinks.length === 0) {
    return null;
  }
  
  // Get the first catalogue link
  const catLink = catalogueLinks[0];
  const catName = getAttr(catLink, 'name') || getText(catLink.name);
  const catId = sanitizeId(catName);
  
  // Extract forces (kill teams)
  const forces = roster.forces || [];
  if (forces.length === 0) {
    return null;
  }
  
  const force = forces[0];
  const forceName = getText(force.name) || getAttr(force, 'name') || catName;
  
  // Build faction from roster
  const faction = {
    id: `fac_${catId}`,
    name: forceName,
    tags: [],
    summary: getText(force.description) || ''
  };
  
  // Extract selections (operatives) from the force
  const operatives = [];
  const rules = [];
  const equipment = [];
  const ploys = [];
  const tacops = [];
  
  function processSelections(selections) {
    if (!selections || !Array.isArray(selections)) return;
    
    selections.forEach(selection => {
      const entryId = getAttr(selection, 'entryId');
      const entryName = getText(selection.name) || getAttr(selection, 'name');
      const entryType = getAttr(selection, 'type');
      
      // Get profiles for stats
      const profiles = selection.profiles || [];
      const hasStats = profiles.some(p => getAttr(p, 'typeId') === 'battlescribe-stats');
      
      if (hasStats || entryType === 'model' || entryType === 'unit') {
        const stats = parseStats(profiles);
        const weapons = extractWeapons(selection);
        const abilities = extractAbilities(selection);
        
        let body = formatStats(stats);
        if (weapons.length > 0) {
          const weaponList = weapons.map(w => 
            w.stats ? `${w.name} (${w.stats})` : w.name
          ).join(', ');
          body += `. Weapons: ${weaponList}.`;
        }
        if (abilities.length > 0) {
          const abilityText = abilities.map(a => 
            a.description || a.name
          ).join('. ');
          body += ` ${abilityText}.`;
        }
        
        operatives.push({
          id: `fac_${catId}_op_${sanitizeId(entryName || entryId)}`,
          type: 'operative',
          factionId: faction.id,
          title: entryName || 'Operative',
          body: body,
          tags: []
        });
      }
      
      // Recursively process nested selections
      const nestedSelections = selection.selections || [];
      processSelections(nestedSelections);
    });
  }
  
  const forceSelections = force.selections || [];
  processSelections(forceSelections);
  
  return {
    faction,
    operatives,
    rules,
    equipment,
    ploys,
    tacops
  };
}

// Parse a BattleScribe catalogue file
async function parseCatalogue(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  const parser = new xml2js.Parser({ 
    explicitArray: true,
    mergeAttrs: true,
    explicitCharkey: false
  });
  
  const result = await parser.parseStringPromise(xml);
  const catalogue = result.catalogue || result.gameSystem?.catalogue?.[0];
  
  if (!catalogue) {
    console.warn(`No catalogue found in ${filePath}`);
    return null;
  }
  
  const catalogueName = getText(catalogue.name) || getAttr(catalogue, 'name') || 'Unknown';
  const catalogueId = sanitizeId(catalogueName);
  
  console.log(`Parsing catalogue: ${catalogueName}`);
  
  // Extract faction keyword from categoryEntries
  // Handle xml2js structure: categoryEntries can be an array or object with categoryEntry array
  let categoryEntriesArray = [];
  if (catalogue.categoryEntries) {
    if (Array.isArray(catalogue.categoryEntries)) {
      catalogue.categoryEntries.forEach(item => {
        if (item && typeof item === 'object') {
          if (item.categoryEntry) {
            const entries = Array.isArray(item.categoryEntry) ? item.categoryEntry : [item.categoryEntry];
            categoryEntriesArray.push(...entries);
          } else {
            categoryEntriesArray.push(item);
          }
        }
      });
    } else if (catalogue.categoryEntries.categoryEntry) {
      categoryEntriesArray = Array.isArray(catalogue.categoryEntries.categoryEntry) 
        ? catalogue.categoryEntries.categoryEntry 
        : [catalogue.categoryEntries.categoryEntry];
    } else {
      categoryEntriesArray = [catalogue.categoryEntries];
    }
  }
  
  let factionKeyword = null;
  const archetypes = [];
  const allKeywords = [];
  
  categoryEntriesArray.forEach(catEntry => {
    const catName = getText(catEntry.name) || getAttr(catEntry, 'name');
    if (catName) {
      allKeywords.push(catName);
      // Prioritize categoryEntry that matches the faction name (case-insensitive)
      if (catName.toLowerCase() === catalogueName.toLowerCase() && !factionKeyword) {
        factionKeyword = catName.toUpperCase(); // Use all caps for faction keywords
      }
      // Look for faction keyword (usually all caps or specific pattern)
      // But skip if it's a single word that might be a role (like "Exarch", "Warrior")
      else if (catName === catName.toUpperCase() && catName.length > 3 && !factionKeyword) {
        // Prefer multi-word keywords over single words
        if (catName.includes(' ') || catName.length > 6) {
          factionKeyword = catName;
        }
      }
      // Look for archetypes
      const archetypeNames = ['Seek & Destroy', 'Security', 'Infiltration', 'Recon'];
      if (archetypeNames.some(a => catName.includes(a))) {
        const matched = archetypeNames.find(a => catName.includes(a));
        if (matched && !archetypes.includes(matched)) {
          archetypes.push(matched);
        }
      }
    }
  });
  
  // Also check categoryLinks in forceEntries for faction keyword
  const forceEntries = catalogue.forceEntries || [];
  forceEntries.forEach(forceEntry => {
    const categoryLinks = forceEntry.categoryLinks || [];
    categoryLinks.forEach(catLink => {
      const catName = getText(catLink.name) || getAttr(catLink, 'name');
      if (catName && catName === catName.toUpperCase() && catName.length > 3 && !factionKeyword) {
        factionKeyword = catName;
      }
    });
  });
  
  // Also try to extract from rule descriptions (e.g., "BATTLECLADE SERVITOR" -> "BATTLECLADE")
  // Check rule descriptions even if we have a keyword, to find better multi-word matches
  const rulesArrayForKeyword = [];
  if (catalogue.rules) {
    if (Array.isArray(catalogue.rules)) {
      catalogue.rules.forEach(item => {
        if (item && typeof item === 'object') {
          if (item.rule) {
            const ruleItems = Array.isArray(item.rule) ? item.rule : [item.rule];
            rulesArrayForKeyword.push(...ruleItems);
          } else {
            rulesArrayForKeyword.push(item);
          }
        }
      });
    } else if (catalogue.rules.rule) {
      rulesArrayForKeyword.push(...(Array.isArray(catalogue.rules.rule) ? catalogue.rules.rule : [catalogue.rules.rule]));
    } else {
      rulesArrayForKeyword.push(catalogue.rules);
    }
  }
  
  // Look for all-caps keywords in rule descriptions
  for (const rule of rulesArrayForKeyword) {
    if (!rule) continue;
    const description = getText(rule.description) || '';
    // Look for patterns like "BATTLECLADE SERVITOR" or "BLADES OF KHAINE"
    const allCapsMatch = description.match(/\b([A-Z]{4,}(?:\s+[A-Z]+)*)\b/);
    if (allCapsMatch) {
      const keyword = allCapsMatch[1];
      // Prefer multi-word keywords that match the faction name
      const keywordLower = keyword.toLowerCase();
      const factionNameLower = catalogueName.toLowerCase();
      if (keywordLower === factionNameLower || keywordLower.includes(factionNameLower) || factionNameLower.includes(keywordLower.split(/\s+/)[0])) {
        factionKeyword = keyword;
        break;
      }
      // Also check if it's a better match than what we have (multi-word vs single word)
      else if (!factionKeyword || (keyword.includes(' ') && !factionKeyword.includes(' '))) {
        const firstWord = keyword.split(/\s+/)[0];
        if (firstWord.length > 3) {
          factionKeyword = firstWord;
        }
      }
    }
  }
  
  // Extract operative selection constraints from forceEntries
  let operativeSelection = null;
  // Normalize forceEntries structure (handle xml2js with explicitArray: true)
  let forceEntriesArray = [];
  if (catalogue.forceEntries) {
    if (Array.isArray(catalogue.forceEntries)) {
      catalogue.forceEntries.forEach(item => {
        if (item && typeof item === 'object') {
          if (item.forceEntry) {
            const entries = Array.isArray(item.forceEntry) ? item.forceEntry : [item.forceEntry];
            forceEntriesArray.push(...entries);
          } else {
            forceEntriesArray.push(item);
          }
        }
      });
    } else if (catalogue.forceEntries.forceEntry) {
      forceEntriesArray = Array.isArray(catalogue.forceEntries.forceEntry)
        ? catalogue.forceEntries.forceEntry
        : [catalogue.forceEntries.forceEntry];
    } else {
      forceEntriesArray = [catalogue.forceEntries];
    }
  }
  
  for (const forceEntry of forceEntriesArray) {
    if (!forceEntry) continue;
    const categoryLinks = forceEntry.categoryLinks || [];
    
    // Find Leader and Operative categoryLinks
    let leaderMin = null;
    let leaderMax = null;
    let operativeMin = null;
    let operativeMax = null;
    
    // Handle xml2js structure - categoryLinks might be array or object
    // With explicitArray: true, categoryLinks is an array: [ { categoryLink: [...] } ]
    let categoryLinksArray = [];
    if (Array.isArray(categoryLinks)) {
      categoryLinks.forEach(item => {
        if (item && typeof item === 'object') {
          if (item.categoryLink) {
            const links = Array.isArray(item.categoryLink) ? item.categoryLink : [item.categoryLink];
            categoryLinksArray.push(...links);
          } else {
            categoryLinksArray.push(item);
          }
        }
      });
    } else if (categoryLinks && typeof categoryLinks === 'object') {
      if (categoryLinks.categoryLink) {
        categoryLinksArray = Array.isArray(categoryLinks.categoryLink)
          ? categoryLinks.categoryLink
          : [categoryLinks.categoryLink];
      } else {
        categoryLinksArray = [categoryLinks];
      }
    }
    
    for (const catLink of categoryLinksArray) {
      if (!catLink) continue;
      // Handle both attribute and property access for name
      // With explicitArray: true, name can be an array
      let catName = null;
      if (catLink.name) {
        // Check if it's an array first (explicitArray: true)
        if (Array.isArray(catLink.name)) {
          catName = catLink.name[0];
        } else if (typeof catLink.name === 'string') {
          catName = catLink.name;
        } else {
          // Try getText for nested structures
          catName = getText(catLink.name);
        }
      }
      // Fallback to getAttr
      if (!catName) catName = getAttr(catLink, 'name');
      // Final fallback to $ attributes
      if (!catName && catLink.$ && catLink.$.name) {
        catName = catLink.$.name;
      }
      if (!catName) continue;
      
      // Normalize constraints array structure
      // With explicitArray: true, constraints is an array: [ { constraint: [...] } ]
      let constraintsArray = [];
      if (catLink.constraints) {
        if (Array.isArray(catLink.constraints)) {
          catLink.constraints.forEach(item => {
            if (item && typeof item === 'object') {
              if (item.constraint) {
                // item.constraint is an array of constraint objects
                const constraints = Array.isArray(item.constraint) ? item.constraint : [item.constraint];
                constraintsArray.push(...constraints);
              } else if (item.type || (Array.isArray(item.type) && item.type[0])) {
                // It's a constraint object directly
                constraintsArray.push(item);
              }
            }
          });
        } else if (catLink.constraints.constraint) {
          constraintsArray = Array.isArray(catLink.constraints.constraint)
            ? catLink.constraints.constraint
            : [catLink.constraints.constraint];
        } else if (catLink.constraints.type || (Array.isArray(catLink.constraints.type) && catLink.constraints.type[0])) {
          // It's a single constraint object
          constraintsArray = [catLink.constraints];
        }
      }
      
      // Extract min/max from constraints
      for (const constraint of constraintsArray) {
        if (!constraint) continue;
        // With explicitArray: true and mergeAttrs: true, type/value/field can be arrays or properties
        let constraintType = constraint.type;
        let constraintValue = constraint.value;
        let constraintField = constraint.field;
        
        // Handle array values (explicitArray: true)
        if (Array.isArray(constraintType)) constraintType = constraintType[0];
        if (Array.isArray(constraintValue)) constraintValue = constraintValue[0];
        if (Array.isArray(constraintField)) constraintField = constraintField[0];
        
        // Fallback to getAttr if not found as property
        if (!constraintType) constraintType = getAttr(constraint, 'type');
        if (!constraintValue) constraintValue = getAttr(constraint, 'value');
        if (!constraintField) constraintField = getAttr(constraint, 'field');
        
        if (constraintField === 'selections' && constraintValue) {
          const value = parseInt(String(constraintValue), 10);
          if (!isNaN(value)) {
            if (catName === 'Leader') {
              if (constraintType === 'min') {
                leaderMin = value;
              } else if (constraintType === 'max') {
                // Handle -1 as "unlimited" but typically means 1 for leaders
                leaderMax = value === -1 ? 1 : value;
              }
            } else if (catName === 'Operative') {
              if (constraintType === 'min') {
                operativeMin = value;
              } else if (constraintType === 'max') {
                operativeMax = value;
              }
            }
          }
        }
      }
      
      // Check modifiers for Leader max (sometimes max is set via modifier)
      if (catName === 'Leader' && catLink.modifiers) {
        let modifiersArray = [];
        if (Array.isArray(catLink.modifiers)) {
          catLink.modifiers.forEach(item => {
            if (item && typeof item === 'object') {
              if (item.modifier) {
                const mods = Array.isArray(item.modifier) ? item.modifier : [item.modifier];
                modifiersArray.push(...mods);
              } else {
                modifiersArray.push(item);
              }
            }
          });
        } else if (catLink.modifiers.modifier) {
          modifiersArray = Array.isArray(catLink.modifiers.modifier)
            ? catLink.modifiers.modifier
            : [catLink.modifiers.modifier];
        } else {
          modifiersArray = [catLink.modifiers];
        }
        
        for (const modifier of modifiersArray) {
          if (!modifier) continue;
          const modifierType = getAttr(modifier, 'type');
          const modifierValue = getAttr(modifier, 'value');
          const modifierField = getAttr(modifier, 'field');
          
          if (modifierType === 'set' && modifierField && modifierValue) {
            const value = parseInt(modifierValue, 10);
            if (!isNaN(value) && value > 0) {
              leaderMax = value;
            }
          }
        }
      }
    }
    
    // Set defaults if not found
    if (leaderMax === null) leaderMax = 1; // Default to 1 leader
    if (leaderMin === null) leaderMin = 0;
    if (operativeMax === null && operativeMin !== null) operativeMax = operativeMin; // If only min is set, use it as max
    if (operativeMin === null && operativeMax !== null) operativeMin = 0;
    
    // Only create selection object if we found meaningful constraints
    // Always create it if we have leader info, and add operatives if we found them
    if (leaderMax !== null || operativeMin !== null || operativeMax !== null) {
      operativeSelection = {
        leader: {
          min: leaderMin || 0,
          max: leaderMax || 1
        }
      };
      
      if (operativeMin !== null || operativeMax !== null) {
        operativeSelection.operatives = {
          min: operativeMin || 0,
          max: operativeMax !== null ? operativeMax : null
        };
      }
      
      break; // Use first forceEntry found
    }
  }
  
  // Extract faction info
  const faction = {
    id: `fac_${catalogueId}`,
    name: catalogueName,
    factionKeyword: factionKeyword || allKeywords[0] || 'UNKNOWN',
    archetypes: archetypes.length > 0 ? archetypes : [],
    summary: getText(catalogue.description) || getText(catalogue.comment) || '',
    rules: [],
    strategicPloys: [],
    tacticalPloys: [],
    equipment: [],
    operatives: [],
    operativeSelection: operativeSelection
  };
  
  // Extract operatives and other content
  const operatives = [];
  const rules = [];
  const equipment = [];
  const strategicPloys = [];
  const tacticalPloys = [];
  const tacops = [];
  
  // Extract faction rules from catalogue.rules
  // Handle xml2js structure: rules can be an array, object with rule property, or single rule
  let rulesArray = [];
  if (catalogue.rules) {
    if (Array.isArray(catalogue.rules)) {
      // It's an array - could be direct rules or wrapped
      catalogue.rules.forEach(item => {
        if (item && typeof item === 'object') {
          // Check if it has a rule property (wrapped structure)
          if (item.rule) {
            const ruleItems = Array.isArray(item.rule) ? item.rule : [item.rule];
            rulesArray.push(...ruleItems);
          } else {
            // It's a direct rule
            rulesArray.push(item);
          }
        }
      });
    } else if (catalogue.rules.rule) {
      // It's an object with rule array
      rulesArray = Array.isArray(catalogue.rules.rule) 
        ? catalogue.rules.rule 
        : [catalogue.rules.rule];
    } else {
      // It's a single rule object
      rulesArray = [catalogue.rules];
    }
  }
  
  rulesArray.forEach(rule => {
    if (!rule) return;
    const ruleName = getText(rule.name) || getAttr(rule, 'name');
    const ruleDescription = getText(rule.description) || '';
    if (ruleName) {
      rules.push({
        id: `fac_${catalogueId}_rule_${sanitizeId(ruleName)}`,
        name: ruleName,
        description: ruleDescription
      });
    }
  });
  
  // Build a map of shared weapons from sharedSelectionEntries
  const sharedWeaponsMap = {};
  
  // Handle xml2js structure for sharedSelectionEntries
  let sharedEntriesArray = [];
  if (catalogue.sharedSelectionEntries) {
    if (Array.isArray(catalogue.sharedSelectionEntries)) {
      catalogue.sharedSelectionEntries.forEach(item => {
        if (item && typeof item === 'object') {
          if (item.selectionEntry) {
            const entries = Array.isArray(item.selectionEntry) ? item.selectionEntry : [item.selectionEntry];
            sharedEntriesArray.push(...entries);
          } else {
            sharedEntriesArray.push(item);
          }
        }
      });
    } else if (catalogue.sharedSelectionEntries.selectionEntry) {
      sharedEntriesArray = Array.isArray(catalogue.sharedSelectionEntries.selectionEntry) 
        ? catalogue.sharedSelectionEntries.selectionEntry 
        : [catalogue.sharedSelectionEntries.selectionEntry];
    } else {
      sharedEntriesArray = [catalogue.sharedSelectionEntries];
    }
  }
  
  sharedEntriesArray.forEach(sharedEntry => {
    if (!sharedEntry) return;
    const sharedId = getAttr(sharedEntry, 'id');
    if (!sharedId) return;
    
    const sharedName = getText(sharedEntry.name) || getAttr(sharedEntry, 'name');
    
    // Handle profiles array structure
    let profileArray = [];
    if (sharedEntry.profiles) {
      if (Array.isArray(sharedEntry.profiles)) {
        sharedEntry.profiles.forEach(item => {
          if (item && typeof item === 'object') {
            if (item.profile) {
              const profs = Array.isArray(item.profile) ? item.profile : [item.profile];
              profileArray.push(...profs);
            } else {
              profileArray.push(item);
            }
          }
        });
      } else if (sharedEntry.profiles.profile) {
        profileArray = Array.isArray(sharedEntry.profiles.profile) ? sharedEntry.profiles.profile : [sharedEntry.profiles.profile];
      } else {
        profileArray = [sharedEntry.profiles];
      }
    }
    
    // Extract weapon profiles
    profileArray.forEach(profile => {
      if (!profile) return;
      const typeName = getText(profile.typeName) || getAttr(profile, 'typeName');
      const profileName = getText(profile.name) || getAttr(profile, 'name');
      
      if (typeName === 'Weapons' || profileName?.includes('⌖') || profileName?.includes('⚔')) {
        // Determine weapon type from symbols
        let weaponType = null;
        if (profileName?.includes('⌖')) {
          weaponType = 'Ranged Weapon';
        } else if (profileName?.includes('⚔')) {
          weaponType = 'Melee Weapon';
        }
        
        const weapon = {
          name: profileName?.replace(/[⌖⚔]/g, '').trim() || sharedName || 'Weapon',
          type: weaponType || null,
          atk: null,
          hit: null,
          dmg: null,
          specialRules: []
        };
        
        // Handle characteristics array structure
        let characteristics = [];
        if (profile.characteristics) {
          if (Array.isArray(profile.characteristics)) {
            profile.characteristics.forEach(item => {
              if (item && typeof item === 'object') {
                if (item.characteristic) {
                  const chars = Array.isArray(item.characteristic) ? item.characteristic : [item.characteristic];
                  characteristics.push(...chars);
                } else {
                  characteristics.push(item);
                }
              }
            });
          } else if (profile.characteristics.characteristic) {
            characteristics = Array.isArray(profile.characteristics.characteristic) 
              ? profile.characteristics.characteristic 
              : [profile.characteristics.characteristic];
          } else {
            characteristics = [profile.characteristics];
          }
        }
        
        characteristics.forEach(char => {
          if (!char) return;
          const charName = getAttr(char, 'name');
          const charValue = getText(char);
          if (charName && charValue) {
            const nameUpper = charName.toUpperCase();
            if (nameUpper === 'ATK' || nameUpper === 'ATTACKS') {
              weapon.atk = charValue;
            } else if (nameUpper === 'HIT') {
              weapon.hit = charValue;
            } else if (nameUpper === 'DMG' || nameUpper === 'DAMAGE') {
              weapon.dmg = charValue;
            } else if (nameUpper === 'WR' || nameUpper === 'WEAPON RULES' || nameUpper === 'SPECIAL') {
              const rules = charValue.split(',').map(r => r.trim()).filter(r => r && r !== '-');
              weapon.specialRules.push(...rules);
              
              // If weapon type not yet determined, check WR field for "Range" indicator
              if (!weapon.type && charValue.toLowerCase().includes('range')) {
                weapon.type = 'Ranged Weapon';
              }
            }
          }
        });
        
        // Final fallback: if still no type determined and we have special rules, check for Range
        if (!weapon.type && weapon.specialRules.length > 0) {
          const hasRange = weapon.specialRules.some(rule => rule.toLowerCase().includes('range'));
          if (hasRange) {
            weapon.type = 'Ranged Weapon';
          } else {
            // If no range indicator, assume melee (most weapons without range are melee)
            weapon.type = 'Melee Weapon';
          }
        }
        
        // Ensure type is set (final safety check)
        if (!weapon.type) {
          // Default to melee if we can't determine (most weapons are melee)
          weapon.type = 'Melee Weapon';
        }
        
        if (weapon.name && (weapon.atk || weapon.hit || weapon.dmg)) {
          if (!sharedWeaponsMap[sharedId]) {
            sharedWeaponsMap[sharedId] = [];
          }
          sharedWeaponsMap[sharedId].push(weapon);
        }
      }
    });
  });
  
  console.log(`  Built shared weapons map with ${Object.keys(sharedWeaponsMap).length} weapon entries`);
  
  // Process sharedSelectionEntryGroups for equipment
  // Handle xml2js structure: sharedSelectionEntryGroups can be an array or object
  let sharedGroupsArray = [];
  if (catalogue.sharedSelectionEntryGroups) {
    if (Array.isArray(catalogue.sharedSelectionEntryGroups)) {
      catalogue.sharedSelectionEntryGroups.forEach(item => {
        if (item && typeof item === 'object') {
          if (item.selectionEntryGroup) {
            const groups = Array.isArray(item.selectionEntryGroup) ? item.selectionEntryGroup : [item.selectionEntryGroup];
            sharedGroupsArray.push(...groups);
          } else {
            sharedGroupsArray.push(item);
          }
        }
      });
    } else if (catalogue.sharedSelectionEntryGroups.selectionEntryGroup) {
      sharedGroupsArray = Array.isArray(catalogue.sharedSelectionEntryGroups.selectionEntryGroup) 
        ? catalogue.sharedSelectionEntryGroups.selectionEntryGroup 
        : [catalogue.sharedSelectionEntryGroups.selectionEntryGroup];
    } else {
      sharedGroupsArray = [catalogue.sharedSelectionEntryGroups];
    }
  }
  
  // Process each sharedSelectionEntryGroup
  sharedGroupsArray.forEach(group => {
    if (!group) return;
    const groupName = getText(group.name) || getAttr(group, 'name') || '';
    
    // Check if this is an equipment group
    if (groupName.toLowerCase().includes('equipment')) {
      const groupEntries = normalizeSelectionEntries(group.selectionEntries);
      groupEntries.forEach(entry => {
        if (!entry) return;
        const entryName = getText(entry.name) || getAttr(entry, 'name') || 'Unnamed';
        const entryId = sanitizeId(entryName);
        const entryType = getAttr(entry, 'type');
        
        // Extract equipment description from profiles
        let description = '';
        const profiles = normalizeProfiles(entry.profiles);
        profiles.forEach(profile => {
          if (!profile) return;
          const typeName = getText(profile.typeName) || getAttr(profile, 'typeName');
          if (typeName === 'Equipment') {
            const characteristics = normalizeCharacteristics(profile.characteristics);
            characteristics.forEach(char => {
              if (!char) return;
              const charName = getAttr(char, 'name');
              const charValue = getText(char);
              if (charName && charName.toLowerCase() === 'equipment' && charValue) {
                description = charValue;
              }
            });
          }
        });
        
        // If no description from profile, try entry description
        if (!description) {
          description = getText(entry.description) || getText(entry.rules) || '';
        }
        
        if (entryName && entryName !== 'Unnamed') {
          equipment.push({
            id: `fac_${catalogueId}_eq_${entryId}`,
            name: entryName,
            description: description
          });
        }
      });
    }
  });
  
  // Handle xml2js structure: selectionEntries can be an array containing objects with selectionEntry arrays
  // xml2js with explicitArray: true will make selectionEntries an array even if there's only one
  // But it can also be a single object with a selectionEntry array
  let selectionEntries = [];
  if (catalogue.selectionEntries) {
    // Check if it's an array (xml2js with explicitArray: true)
    if (Array.isArray(catalogue.selectionEntries)) {
      // Process each selectionEntries block
      catalogue.selectionEntries.forEach(block => {
        if (!block) return;
        // Each block might have a selectionEntry array
        if (block.selectionEntry) {
          const entries = Array.isArray(block.selectionEntry) ? block.selectionEntry : [block.selectionEntry];
          selectionEntries.push(...entries);
        } else if (block && typeof block === 'object') {
          // It might be a direct entry
          selectionEntries.push(block);
        }
      });
    } else if (catalogue.selectionEntries.selectionEntry) {
      // It's an object with selectionEntry array - this is the most common case
      const entries = Array.isArray(catalogue.selectionEntries.selectionEntry) 
        ? catalogue.selectionEntries.selectionEntry 
        : [catalogue.selectionEntries.selectionEntry];
      selectionEntries = entries;
    } else if (catalogue.selectionEntries && typeof catalogue.selectionEntries === 'object') {
      // It's a single entry object
      selectionEntries = [catalogue.selectionEntries];
    }
  }
  
  console.log(`  Found ${selectionEntries.length} selection entries to process`);
  
  // Recursive function to process entries and nested entries as operatives
  function processEntryAsOperative(entry) {
    if (!entry) return;
    
    const entryName = getText(entry.name) || getAttr(entry, 'name') || 'Unnamed';
    const entryType = getAttr(entry, 'type');
    const entryId = sanitizeId(entryName);
    
    // Check if this is an operative (usually has profiles with stats)
    const profiles = normalizeProfiles(entry.profiles);
    const hasStats = profiles.some(p => {
      if (!p) return false;
      const typeId = getAttr(p, 'typeId');
      const typeName = getText(p.typeName) || getAttr(p, 'typeName');
      // BattleScribe uses various typeIds for operatives - check both typeId and typeName
      return typeId === 'battlescribe-stats' || 
             typeName === 'Operative' || 
             typeName === 'Stats';
    });
    
    // An entry is an operative if:
    // 1. It has type="model" or type="unit"
    // 2. OR it has a profile with typeName="Operative" or typeId="battlescribe-stats"
    const isOperative = entryType === 'model' || entryType === 'unit' || hasStats;
    
    // Also check nested selectionEntries for operatives (recursively)
    const nestedEntries = normalizeSelectionEntries(entry.selectionEntries);
    nestedEntries.forEach(nestedEntry => {
      processEntryAsOperative(nestedEntry);
    });
    
    if (isOperative) {
      // This is an operative - use new structure
      const stats = parseOperativeStats(profiles);
      let weapons = extractWeaponsDetailed(entry);
      
      // Also extract weapons from entryLinks (they reference sharedSelectionEntries)
      // Handle xml2js array structure for entryLinks
      let entryLinksArray = [];
      if (entry.entryLinks) {
        if (Array.isArray(entry.entryLinks)) {
          entry.entryLinks.forEach(item => {
            if (item && typeof item === 'object') {
              if (item.entryLink) {
                const links = Array.isArray(item.entryLink) ? item.entryLink : [item.entryLink];
                entryLinksArray.push(...links);
              } else {
                entryLinksArray.push(item);
              }
            }
          });
        } else if (entry.entryLinks.entryLink) {
          entryLinksArray = Array.isArray(entry.entryLinks.entryLink) 
            ? entry.entryLinks.entryLink 
            : [entry.entryLinks.entryLink];
        } else {
          entryLinksArray = [entry.entryLinks];
        }
      }
      
      entryLinksArray.forEach(link => {
        if (!link) return;
        const targetId = getAttr(link, 'targetId');
        if (targetId && sharedWeaponsMap[targetId]) {
          // Found a weapon reference - add all weapon profiles for this target
          weapons.push(...sharedWeaponsMap[targetId]);
        }
      });
      
      // Also check selectionEntryGroups for entryLinks
      let groupsArray = [];
      if (entry.selectionEntryGroups) {
        if (Array.isArray(entry.selectionEntryGroups)) {
          entry.selectionEntryGroups.forEach(item => {
            if (item && typeof item === 'object') {
              if (item.selectionEntryGroup) {
                const groups = Array.isArray(item.selectionEntryGroup) ? item.selectionEntryGroup : [item.selectionEntryGroup];
                groupsArray.push(...groups);
              } else {
                groupsArray.push(item);
              }
            }
          });
        } else if (entry.selectionEntryGroups.selectionEntryGroup) {
          groupsArray = Array.isArray(entry.selectionEntryGroups.selectionEntryGroup) 
            ? entry.selectionEntryGroups.selectionEntryGroup 
            : [entry.selectionEntryGroups.selectionEntryGroup];
        } else {
          groupsArray = [entry.selectionEntryGroups];
        }
      }
      
      groupsArray.forEach(group => {
        if (!group || !group.entryLinks) return;
        let groupEntryLinksArray = [];
        if (Array.isArray(group.entryLinks)) {
          group.entryLinks.forEach(item => {
            if (item && typeof item === 'object') {
              if (item.entryLink) {
                const links = Array.isArray(item.entryLink) ? item.entryLink : [item.entryLink];
                groupEntryLinksArray.push(...links);
              } else {
                groupEntryLinksArray.push(item);
              }
            }
          });
        } else if (group.entryLinks.entryLink) {
          groupEntryLinksArray = Array.isArray(group.entryLinks.entryLink) 
            ? group.entryLinks.entryLink 
            : [group.entryLinks.entryLink];
        } else {
          groupEntryLinksArray = [group.entryLinks];
        }
        
        groupEntryLinksArray.forEach(link => {
          if (!link) return;
          const targetId = getAttr(link, 'targetId');
          if (targetId && sharedWeaponsMap[targetId]) {
            weapons.push(...sharedWeaponsMap[targetId]);
          }
        });
      });
      
      const abilities = extractAbilities(entry);
      
      // Extract keywords from categoryLinks
      // Normalize categoryLinks array structure (similar to entryLinks)
      let entryCategoryLinks = [];
      if (entry.categoryLinks) {
        if (Array.isArray(entry.categoryLinks)) {
          entry.categoryLinks.forEach(item => {
            if (item && typeof item === 'object') {
              if (item.categoryLink) {
                const links = Array.isArray(item.categoryLink) ? item.categoryLink : [item.categoryLink];
                entryCategoryLinks.push(...links);
              } else {
                entryCategoryLinks.push(item);
              }
            }
          });
        } else if (entry.categoryLinks.categoryLink) {
          entryCategoryLinks = Array.isArray(entry.categoryLinks.categoryLink) 
            ? entry.categoryLinks.categoryLink 
            : [entry.categoryLinks.categoryLink];
        } else {
          entryCategoryLinks = [entry.categoryLinks];
        }
      }
      
      const operativeKeywords = [];
      let operativeFactionKeyword = null;
      const factionNameLower = catalogueName.toLowerCase();
      
      entryCategoryLinks.forEach(catLink => {
        const catName = getText(catLink.name) || getAttr(catLink, 'name');
        if (catName) {
          // Check if this is a faction keyword (all caps, longer than 3 chars)
          if (catName === catName.toUpperCase() && catName.length > 3) {
            operativeFactionKeyword = catName;
          } 
          // Check if categoryLink name matches the faction name (case-insensitive)
          else if (catName.toLowerCase() === factionNameLower) {
            operativeFactionKeyword = catName; // Use the exact case from the categoryLink
          }
          // Add all other keywords (excluding the faction keyword to avoid duplication)
          else if (catName !== faction.factionKeyword && catName !== operativeFactionKeyword) {
            operativeKeywords.push(catName);
          }
        }
      });
      
      // Update faction keyword if found on operative and not already set
      if (operativeFactionKeyword && (!factionKeyword || factionKeyword === 'UNKNOWN')) {
        factionKeyword = operativeFactionKeyword;
        faction.factionKeyword = operativeFactionKeyword;
      }
      
      // Extract special rules and actions from profiles with typeName="Abilities" or "Unique Actions"
      const specialRules = [];
      const specialActions = [];
      
      profiles.forEach(profile => {
        if (!profile) return;
        const profileTypeName = getText(profile.typeName) || getAttr(profile, 'typeName');
        const profileTypeId = getAttr(profile, 'typeId');
        
        if (profileTypeName === 'Abilities' || profileTypeId === 'f887-5881-0e6d-755c') {
          // This is an ability
          const abilityName = getText(profile.name) || getAttr(profile, 'name') || 'Ability';
          const characteristics = normalizeCharacteristics(profile.characteristics);
          let abilityDescription = '';
          characteristics.forEach(char => {
            if (!char) return;
            const charName = getAttr(char, 'name');
            const charValue = getText(char);
            if (charName && (charName.toLowerCase() === 'ability' || charName.toLowerCase().includes('ability'))) {
              abilityDescription = charValue || '';
            }
          });
          if (abilityName && abilityDescription) {
            specialRules.push({
              name: abilityName,
              description: abilityDescription
            });
          }
        } else if (profileTypeName === 'Unique Actions' || profileTypeId === '8f2a-d3d6-1a0c-7fa3') {
          // This is a unique action
          const actionName = getText(profile.name) || getAttr(profile, 'name') || 'Action';
          const characteristics = normalizeCharacteristics(profile.characteristics);
          let actionDescription = '';
          characteristics.forEach(char => {
            if (!char) return;
            const charName = getAttr(char, 'name');
            const charValue = getText(char);
            if (charName && (charName.toLowerCase().includes('action') || charName.toLowerCase().includes('unique'))) {
              actionDescription = charValue || '';
            }
          });
          if (actionName && actionDescription) {
            specialActions.push({
              name: actionName,
              description: actionDescription
            });
          }
        }
      });
      
      // Also check nested selectionEntries for abilities and unique actions
      const nestedEntriesForAbilities = normalizeSelectionEntries(entry.selectionEntries);
      nestedEntriesForAbilities.forEach(nestedEntry => {
        if (!nestedEntry) return;
        const nestedProfiles = normalizeProfiles(nestedEntry.profiles);
        nestedProfiles.forEach(profile => {
          if (!profile) return;
          const profileTypeName = getText(profile.typeName) || getAttr(profile, 'typeName');
          const profileTypeId = getAttr(profile, 'typeId');
          
          if (profileTypeName === 'Abilities' || profileTypeId === 'f887-5881-0e6d-755c') {
            const abilityName = getText(profile.name) || getAttr(profile, 'name') || 'Ability';
            const characteristics = normalizeCharacteristics(profile.characteristics);
            let abilityDescription = '';
            characteristics.forEach(char => {
              if (!char) return;
              const charName = getAttr(char, 'name');
              const charValue = getText(char);
              if (charName && (charName.toLowerCase() === 'ability' || charName.toLowerCase().includes('ability'))) {
                abilityDescription = charValue || '';
              }
            });
            if (abilityName && abilityDescription) {
              specialRules.push({
              name: abilityName,
              description: abilityDescription
            });
            }
          } else if (profileTypeName === 'Unique Actions' || profileTypeId === '8f2a-d3d6-1a0c-7fa3') {
            const actionName = getText(profile.name) || getAttr(profile, 'name') || 'Action';
            const characteristics = normalizeCharacteristics(profile.characteristics);
            let actionDescription = '';
            characteristics.forEach(char => {
              if (!char) return;
              const charName = getAttr(char, 'name');
              const charValue = getText(char);
              if (charName && (charName.toLowerCase().includes('action') || charName.toLowerCase().includes('unique'))) {
                actionDescription = charValue || '';
              }
            });
            if (actionName && actionDescription) {
              specialActions.push({
              name: actionName,
              description: actionDescription
            });
            }
          }
        });
      });
      
      // Also check infoLinks
      const infoLinks = entry.infoLinks || [];
      infoLinks.forEach(link => {
        if (!link) return;
        const linkName = getText(link.name) || getAttr(link, 'name');
        const linkDescription = getText(link.description) || getText(link.hiddenNotes);
        const linkType = getAttr(link, 'type');
        
        if (linkName || linkDescription) {
          if (linkType === 'ability' || linkName?.toLowerCase().includes('action')) {
            specialActions.push({
              name: linkName || 'Action',
              description: linkDescription || ''
            });
          } else {
            specialRules.push({
              name: linkName || 'Rule',
              description: linkDescription || ''
            });
          }
        }
      });
      
      // Extract selection constraints (max times this operative can be selected)
      let maxSelections = null; // null means unlimited
      if (entry.constraints) {
        // Normalize constraints array structure
        // With explicitArray: true, constraints is: [ { constraint: [...] } ]
        let constraintsArray = [];
        if (Array.isArray(entry.constraints)) {
          entry.constraints.forEach(item => {
            if (item && typeof item === 'object') {
              if (item.constraint) {
                // item.constraint is an array of constraint objects
                const constraints = Array.isArray(item.constraint) ? item.constraint : [item.constraint];
                constraintsArray.push(...constraints);
              } else if (item.type || (Array.isArray(item.type) && item.type[0])) {
                // It's a constraint object directly
                constraintsArray.push(item);
              }
            }
          });
        } else if (entry.constraints.constraint) {
          constraintsArray = Array.isArray(entry.constraints.constraint)
            ? entry.constraints.constraint
            : [entry.constraints.constraint];
        } else if (entry.constraints.type || (Array.isArray(entry.constraints.type) && entry.constraints.type[0])) {
          // It's a single constraint object
          constraintsArray = [entry.constraints];
        }
        
        // Find constraint with scope="force" and field="selections"
        let constraintId = null;
        for (const constraint of constraintsArray) {
          if (!constraint) continue;
          let constraintType = constraint.type;
          let constraintValue = constraint.value;
          let constraintField = constraint.field;
          let constraintScope = constraint.scope;
          let constraintIdAttr = getAttr(constraint, 'id');
          
          // Handle array values (explicitArray: true)
          if (Array.isArray(constraintType)) constraintType = constraintType[0];
          if (Array.isArray(constraintValue)) constraintValue = constraintValue[0];
          if (Array.isArray(constraintField)) constraintField = constraintField[0];
          if (Array.isArray(constraintScope)) constraintScope = constraintScope[0];
          if (Array.isArray(constraintIdAttr)) constraintIdAttr = constraintIdAttr[0];
          
          // Fallback to getAttr if not found as property
          if (!constraintType) constraintType = getAttr(constraint, 'type');
          if (!constraintValue) constraintValue = getAttr(constraint, 'value');
          if (!constraintField) constraintField = getAttr(constraint, 'field');
          if (!constraintScope) constraintScope = getAttr(constraint, 'scope');
          if (!constraintIdAttr) constraintIdAttr = getAttr(constraint, 'id');
          
          // Also handle if id is in the $ attributes
          if (!constraintIdAttr && constraint.$ && constraint.$.id) {
            constraintIdAttr = constraint.$.id;
          }
          
          if (constraintField === 'selections' && constraintScope === 'force' && constraintType === 'max') {
            const value = parseInt(String(constraintValue), 10);
            if (!isNaN(value)) {
              maxSelections = value === -1 ? null : value; // -1 means unlimited
              constraintId = constraintIdAttr; // Store the constraint ID for modifier matching
            }
          }
        }
        
        // Check modifiers that might change the max value
        // Modifiers reference constraints by their ID (modifier.field = constraint.id)
        if (entry.modifiers && constraintId) {
          let modifiersArray = [];
          if (Array.isArray(entry.modifiers)) {
            entry.modifiers.forEach(item => {
              if (item && typeof item === 'object') {
                if (item.modifier) {
                  const mods = Array.isArray(item.modifier) ? item.modifier : [item.modifier];
                  modifiersArray.push(...mods);
                } else {
                  modifiersArray.push(item);
                }
              }
            });
          } else if (entry.modifiers.modifier) {
            modifiersArray = Array.isArray(entry.modifiers.modifier)
              ? entry.modifiers.modifier
              : [entry.modifiers.modifier];
          } else {
            modifiersArray = [entry.modifiers];
          }
          
          // Collect all matching modifiers and prioritize unconditional ones
          const matchingModifiers = [];
          for (const modifier of modifiersArray) {
            if (!modifier) continue;
            let modifierType = modifier.type;
            let modifierValue = modifier.value;
            let modifierField = modifier.field;
            
            // Handle array values
            if (Array.isArray(modifierType)) modifierType = modifierType[0];
            if (Array.isArray(modifierValue)) modifierValue = modifierValue[0];
            if (Array.isArray(modifierField)) modifierField = modifierField[0];
            
            // Fallback to getAttr
            if (!modifierType) modifierType = getAttr(modifier, 'type');
            if (!modifierValue) modifierValue = getAttr(modifier, 'value');
            if (!modifierField) modifierField = getAttr(modifier, 'field');
            
            // Check if this modifier sets the constraint we found (modifier.field = constraint.id)
            // modifierField might be an array, so normalize it
            const normalizedModifierField = Array.isArray(modifierField) ? modifierField[0] : modifierField;
            const normalizedConstraintId = Array.isArray(constraintId) ? constraintId[0] : constraintId;
            
            if (modifierType === 'set' && normalizedModifierField === normalizedConstraintId && modifierValue) {
              const value = parseInt(String(modifierValue), 10);
              if (!isNaN(value) && value >= 0) {
                // Check if this modifier applies unconditionally or with conditions
                let appliesUnconditionally = true;
                let hasConditionGroups = false;
                
                // Check for conditions
                if (modifier.conditions || modifier.conditionGroups) {
                  appliesUnconditionally = false;
                  
                  // Check if conditions are just "notInstanceOf default-force" (which is always true in normal play)
                  const conditions = modifier.conditions;
                  const conditionGroups = modifier.conditionGroups;
                  
                  if (conditionGroups) {
                    hasConditionGroups = true;
                  }
                  
                  if (conditions) {
                    let condsArray = [];
                    if (Array.isArray(conditions)) {
                      condsArray = conditions;
                    } else if (conditions.condition) {
                      condsArray = Array.isArray(conditions.condition) ? conditions.condition : [conditions.condition];
                    } else {
                      condsArray = [conditions];
                    }
                    
                    if (condsArray.length === 1) {
                      const cond = condsArray[0];
                      const condType = Array.isArray(cond.type) ? cond.type[0] : (cond.type || getAttr(cond, 'type'));
                      if (condType === 'notInstanceOf') {
                        // This is typically always true, so the modifier applies
                        appliesUnconditionally = true;
                      }
                    }
                  }
                }
                
                matchingModifiers.push({
                  value: value === 0 ? 0 : (value > 0 ? value : null),
                  appliesUnconditionally: appliesUnconditionally,
                  hasConditionGroups: hasConditionGroups
                });
              }
            }
          }
          
          // Prioritize unconditional modifiers, then modifiers without condition groups
          if (matchingModifiers.length > 0) {
            const unconditional = matchingModifiers.find(m => m.appliesUnconditionally);
            if (unconditional) {
              maxSelections = unconditional.value;
            } else {
              // If no unconditional modifier, use the first one without condition groups, or the first one
              const withoutGroups = matchingModifiers.find(m => !m.hasConditionGroups);
              if (withoutGroups) {
                maxSelections = withoutGroups.value;
              } else {
                maxSelections = matchingModifiers[0].value;
              }
            }
          }
        }
      }
      
      // Only add if we have at least some data (name is required)
      if (entryName && entryName !== 'Unnamed') {
        const operative = {
          id: `fac_${catalogueId}_op_${entryId}`,
          name: entryName,
          factionKeyword: operativeFactionKeyword || faction.factionKeyword,
          keywords: operativeKeywords,
          apl: stats.apl,
          move: stats.move,
          save: stats.save,
          wounds: stats.wounds,
          weapons: weapons,
          specialRules: specialRules,
          specialActions: specialActions,
          maxSelections: maxSelections // null means unlimited, number means max times
        };
        
        operatives.push(operative);
        console.log(`    ✓ Added operative: ${entryName} (APL: ${stats.apl}, Move: ${stats.move}, Save: ${stats.save}, Wounds: ${stats.wounds}, Weapons: ${weapons.length})`);
      } else {
        console.log(`    ⚠ Skipped entry with no name`);
      }
    }
  }
  
  selectionEntries.forEach(entry => {
    processEntryAsOperative(entry);
  });
  
  // Also process sharedSelectionEntries for operatives
  sharedEntriesArray.forEach(entry => {
    processEntryAsOperative(entry);
  });
  
  // Continue processing non-operative entries (equipment, ploys, etc.)
  selectionEntries.forEach(entry => {
    if (!entry) return; // Skip null/undefined entries
    
    const entryName = getText(entry.name) || getAttr(entry, 'name') || 'Unnamed';
    const entryType = getAttr(entry, 'type');
    const entryId = sanitizeId(entryName);
    
    // Check if this is an operative (usually has profiles with stats)
    const profiles = normalizeProfiles(entry.profiles);
    const hasStats = profiles.some(p => {
      if (!p) return false;
      const typeId = getAttr(p, 'typeId');
      const typeName = getText(p.typeName) || getAttr(p, 'typeName');
      // BattleScribe uses various typeIds for operatives - check both typeId and typeName
      return typeId === 'battlescribe-stats' || 
             typeName === 'Operative' || 
             typeName === 'Stats';
    });
    
    // Debug: log model entries and entries with Operative profiles
    if (entryType === 'model') {
      console.log(`    Found model entry: ${entryName} (type: ${entryType}, profiles: ${profiles.length})`);
      profiles.forEach(p => {
        if (p) {
          const typeName = getText(p.typeName) || getAttr(p, 'typeName');
          const typeId = getAttr(p, 'typeId');
          console.log(`      Profile: typeName="${typeName}", typeId="${typeId}"`);
        }
      });
    }
    
    // An entry is an operative if:
    // 1. It has type="model" or type="unit"
    // 2. OR it has a profile with typeName="Operative" or typeId="battlescribe-stats"
    const isOperative = entryType === 'model' || entryType === 'unit' || hasStats;
    
    // Skip operatives - already processed above
    if (isOperative) {
      return;
    }
    
    // Also check nested selectionEntries for operatives (recursively)
    const nestedEntries = normalizeSelectionEntries(entry.selectionEntries);
    nestedEntries.forEach(nestedEntry => {
      processEntryAsOperative(nestedEntry);
    });
    
    if (isOperative) {
      // This is an operative - use new structure
      const stats = parseOperativeStats(profiles);
      let weapons = extractWeaponsDetailed(entry);
      
      // Also extract weapons from entryLinks (they reference sharedSelectionEntries)
      // Handle xml2js array structure for entryLinks
      let entryLinksArray = [];
      if (entry.entryLinks) {
        if (Array.isArray(entry.entryLinks)) {
          entry.entryLinks.forEach(item => {
            if (item && typeof item === 'object') {
              if (item.entryLink) {
                const links = Array.isArray(item.entryLink) ? item.entryLink : [item.entryLink];
                entryLinksArray.push(...links);
              } else {
                entryLinksArray.push(item);
              }
            }
          });
        } else if (entry.entryLinks.entryLink) {
          entryLinksArray = Array.isArray(entry.entryLinks.entryLink) 
            ? entry.entryLinks.entryLink 
            : [entry.entryLinks.entryLink];
        } else {
          entryLinksArray = [entry.entryLinks];
        }
      }
      
      entryLinksArray.forEach(link => {
        if (!link) return;
        const targetId = getAttr(link, 'targetId');
        if (targetId && sharedWeaponsMap[targetId]) {
          // Found a weapon reference - add all weapon profiles for this target
          weapons.push(...sharedWeaponsMap[targetId]);
        }
      });
      
      // Also check selectionEntryGroups for entryLinks
      let groupsArray = [];
      if (entry.selectionEntryGroups) {
        if (Array.isArray(entry.selectionEntryGroups)) {
          entry.selectionEntryGroups.forEach(item => {
            if (item && typeof item === 'object') {
              if (item.selectionEntryGroup) {
                const groups = Array.isArray(item.selectionEntryGroup) ? item.selectionEntryGroup : [item.selectionEntryGroup];
                groupsArray.push(...groups);
              } else {
                groupsArray.push(item);
              }
            }
          });
        } else if (entry.selectionEntryGroups.selectionEntryGroup) {
          groupsArray = Array.isArray(entry.selectionEntryGroups.selectionEntryGroup) 
            ? entry.selectionEntryGroups.selectionEntryGroup 
            : [entry.selectionEntryGroups.selectionEntryGroup];
        } else {
          groupsArray = [entry.selectionEntryGroups];
        }
      }
      
      groupsArray.forEach(group => {
        if (!group) return;
        // Handle entryLinks in groups
        let groupEntryLinksArray = [];
        if (group.entryLinks) {
          if (Array.isArray(group.entryLinks)) {
            group.entryLinks.forEach(item => {
              if (item && typeof item === 'object') {
                if (item.entryLink) {
                  const links = Array.isArray(item.entryLink) ? item.entryLink : [item.entryLink];
                  groupEntryLinksArray.push(...links);
                } else {
                  groupEntryLinksArray.push(item);
                }
              }
            });
          } else if (group.entryLinks.entryLink) {
            groupEntryLinksArray = Array.isArray(group.entryLinks.entryLink) 
              ? group.entryLinks.entryLink 
              : [group.entryLinks.entryLink];
          } else {
            groupEntryLinksArray = [group.entryLinks];
          }
        }
        
        groupEntryLinksArray.forEach(link => {
          if (!link) return;
          const targetId = getAttr(link, 'targetId');
          if (targetId && sharedWeaponsMap[targetId]) {
            weapons.push(...sharedWeaponsMap[targetId]);
          }
        });
      });
      
      const abilities = extractAbilities(entry);
      
      // Extract keywords from categoryLinks
      // Normalize categoryLinks array structure (similar to entryLinks)
      let entryCategoryLinks = [];
      if (entry.categoryLinks) {
        if (Array.isArray(entry.categoryLinks)) {
          entry.categoryLinks.forEach(item => {
            if (item && typeof item === 'object') {
              if (item.categoryLink) {
                const links = Array.isArray(item.categoryLink) ? item.categoryLink : [item.categoryLink];
                entryCategoryLinks.push(...links);
              } else {
                entryCategoryLinks.push(item);
              }
            }
          });
        } else if (entry.categoryLinks.categoryLink) {
          entryCategoryLinks = Array.isArray(entry.categoryLinks.categoryLink) 
            ? entry.categoryLinks.categoryLink 
            : [entry.categoryLinks.categoryLink];
        } else {
          entryCategoryLinks = [entry.categoryLinks];
        }
      }
      
      const operativeKeywords = [];
      let operativeFactionKeyword = null;
      const factionNameLower = catalogueName.toLowerCase();
      
      entryCategoryLinks.forEach(catLink => {
        const catName = getText(catLink.name) || getAttr(catLink, 'name');
        if (catName) {
          // Check if this is a faction keyword (all caps, longer than 3 chars)
          if (catName === catName.toUpperCase() && catName.length > 3) {
            operativeFactionKeyword = catName;
          } 
          // Check if categoryLink name matches the faction name (case-insensitive)
          else if (catName.toLowerCase() === factionNameLower) {
            operativeFactionKeyword = catName; // Use the exact case from the categoryLink
          }
          // Add all other keywords (excluding the faction keyword to avoid duplication)
          else if (catName !== faction.factionKeyword && catName !== operativeFactionKeyword) {
            operativeKeywords.push(catName);
          }
        }
      });
      
      // Update faction keyword if found on operative and not already set
      if (operativeFactionKeyword && (!factionKeyword || factionKeyword === 'UNKNOWN')) {
        factionKeyword = operativeFactionKeyword;
        faction.factionKeyword = operativeFactionKeyword;
      }
      
      // Extract special rules and actions from profiles with typeName="Abilities" or "Unique Actions"
      const specialRules = [];
      const specialActions = [];
      
      // Helper function to extract ability/action from a profile
      function extractFromProfile(profile) {
        if (!profile) return;
        const typeName = getText(profile.typeName) || getAttr(profile, 'typeName');
        const profileName = getText(profile.name) || getAttr(profile, 'name');
        
        if (typeName === 'Abilities') {
          const characteristics = normalizeCharacteristics(profile.characteristics);
          let abilityDescription = '';
          characteristics.forEach(char => {
            if (!char) return;
            const charName = getAttr(char, 'name');
            if (charName === 'Ability') {
              abilityDescription = getText(char);
            }
          });
          if (profileName && abilityDescription) {
            specialRules.push({
              name: profileName,
              description: abilityDescription
            });
          }
        } else if (typeName === 'Unique Actions') {
          const characteristics = normalizeCharacteristics(profile.characteristics);
          let actionDescription = '';
          characteristics.forEach(char => {
            if (!char) return;
            const charName = getAttr(char, 'name');
            if (charName === 'Unique Action') {
              actionDescription = getText(char);
            }
          });
          if (profileName && actionDescription) {
            specialActions.push({
              name: profileName,
              description: actionDescription
            });
          }
        }
      }
      
      // Check profiles directly on the entry
      profiles.forEach(profile => {
        extractFromProfile(profile);
      });
      
      // Also check nested selectionEntries for abilities and unique actions
      const entries = normalizeSelectionEntries(entry.selectionEntries);
      entries.forEach(nestedEntry => {
        if (!nestedEntry) return;
        const nestedProfiles = normalizeProfiles(nestedEntry.profiles);
        nestedProfiles.forEach(profile => {
          extractFromProfile(profile);
        });
      });
      
      // Also check infoLinks
      const infoLinks = entry.infoLinks || [];
      infoLinks.forEach(link => {
        if (!link) return;
        const linkName = getText(link.name) || getAttr(link, 'name');
        const linkDescription = getText(link.description) || getText(link.hiddenNotes);
        const linkType = getAttr(link, 'type');
        
        if (linkName || linkDescription) {
          if (linkType === 'ability' || linkName?.toLowerCase().includes('action')) {
            specialActions.push({
              name: linkName || 'Action',
              description: linkDescription || ''
            });
          } else {
            specialRules.push({
              name: linkName || 'Rule',
              description: linkDescription || ''
            });
          }
        }
      });
      
      // Only add if we have at least some data (name is required)
      if (entryName && entryName !== 'Unnamed') {
        const operative = {
          id: `fac_${catalogueId}_op_${entryId}`,
          name: entryName,
          factionKeyword: operativeFactionKeyword || faction.factionKeyword,
          keywords: operativeKeywords,
          apl: stats.apl,
          move: stats.move,
          save: stats.save,
          wounds: stats.wounds,
          weapons: weapons,
          specialRules: specialRules,
          specialActions: specialActions
        };
        
        operatives.push(operative);
        console.log(`    ✓ Added operative: ${entryName} (APL: ${stats.apl}, Move: ${stats.move}, Save: ${stats.save}, Wounds: ${stats.wounds}, Weapons: ${weapons.length})`);
      } else {
        console.log(`    ⚠ Skipped entry with no name`);
      }
    } else if (entryType === 'upgrade' || (entryName && entryName.toLowerCase().includes('equipment'))) {
      // Equipment
      const description = getText(entry.description) || getText(entry.rules);
      equipment.push({
        id: `fac_${catalogueId}_eq_${entryId}`,
        name: entryName,
        description: description || ''
      });
    } else if (entryName && entryName.toLowerCase().includes('ploy')) {
      // Ploy - determine if strategic or tactical
      const description = getText(entry.description) || getText(entry.rules);
      const isStrategic = entryName.toLowerCase().includes('strategic') || 
                         entryName.toLowerCase().includes('strat');
      
      const ploy = {
        id: `fac_${catalogueId}_${isStrategic ? 'strategic' : 'tactical'}_${entryId}`,
        name: entryName,
        description: description || ''
      };
      
      if (isStrategic) {
        strategicPloys.push(ploy);
      } else {
        tacticalPloys.push(ploy);
      }
    } else if (entryName && entryName.toLowerCase().includes('tac op')) {
      // Tac Op
      const description = getText(entry.description) || getText(entry.rules);
      tacops.push({
        id: `fac_${catalogueId}_tacop_${entryId}`,
        type: 'tacop',
        factionId: faction.id,
        title: entryName,
        body: description || '',
        tags: []
      });
    } else {
      // Could be a rule or other content
      const description = getText(entry.description) || getText(entry.rules);
      if (description || entryName) {
        // Check if it's a faction rule (not equipment, ploy, or tacop)
        if (!entryName.toLowerCase().includes('equipment') && 
            !entryName.toLowerCase().includes('ploy') && 
            !entryName.toLowerCase().includes('tac op')) {
          rules.push({
            id: `fac_${catalogueId}_rule_${entryId}`,
            name: entryName || 'Rule',
            description: description || ''
          });
        }
      }
    }
  });
  
  // Update faction keyword from operatives if not found yet
  // Check categoryLinks on operatives for faction name matches
  if (!factionKeyword || factionKeyword === 'UNKNOWN') {
    for (const op of operatives) {
      if (op.factionKeyword && op.factionKeyword !== 'UNKNOWN') {
        factionKeyword = op.factionKeyword;
        break;
      }
    }
    if (factionKeyword && factionKeyword !== 'UNKNOWN') {
      faction.factionKeyword = factionKeyword;
    }
  }
  
  // Also check ability descriptions for faction keywords (e.g., "BLADES OF KHAINE" in ability text)
  // This happens after operatives are processed so we can check their specialRules
  if (factionKeyword && !factionKeyword.includes(' ') && factionKeyword.length < 8) {
    // If we have a single-word keyword that might be wrong, check for better matches
    const factionNameLower = catalogueName.toLowerCase();
    for (const op of operatives) {
      if (op.specialRules && Array.isArray(op.specialRules)) {
        for (const rule of op.specialRules) {
          if (rule.description) {
            const allCapsMatch = rule.description.match(/\b([A-Z]{4,}(?:\s+[A-Z]+)*)\b/);
            if (allCapsMatch) {
              const keyword = allCapsMatch[1];
              const keywordLower = keyword.toLowerCase();
              if (keywordLower === factionNameLower || keywordLower.includes(factionNameLower) || factionNameLower.includes(keywordLower.split(/\s+/)[0])) {
                factionKeyword = keyword;
                break;
              }
            }
          }
        }
        if (factionKeyword.includes(' ')) break;
      }
    }
  }
  
  // Final fallback: use faction name if still not found
  if (!factionKeyword || factionKeyword === 'UNKNOWN') {
    // Check if faction name matches any categoryLink on operatives
    const factionNameLower = catalogueName.toLowerCase();
    for (const op of operatives) {
      if (op.keywords && Array.isArray(op.keywords)) {
        for (const keyword of op.keywords) {
          if (keyword && keyword.toLowerCase() === factionNameLower) {
            factionKeyword = keyword.toUpperCase();
            break;
          }
        }
        if (factionKeyword) break;
      }
    }
    
    // If still not found, use the faction name itself
    if (!factionKeyword || factionKeyword === 'UNKNOWN') {
      factionKeyword = catalogueName.toUpperCase();
    }
    
    faction.factionKeyword = factionKeyword;
  } else {
    // Update faction keyword if we found a better match
    faction.factionKeyword = factionKeyword;
  }
  
  // Build final faction object with new structure
  faction.rules = rules;
  faction.strategicPloys = strategicPloys;
  faction.tacticalPloys = tacticalPloys;
  faction.equipment = equipment;
  faction.operatives = operatives;
  
  return {
    faction,
    operatives: [], // Empty - now part of faction
    rules: [], // Empty - now part of faction
    equipment: [], // Empty - now part of faction
    ploys: [], // Empty - now part of faction
    tacops
  };
}

// Main conversion function
async function convertBattleScribeFiles() {
  console.log('Starting BattleScribe conversion...\n');
  
  // Check if battlescribe directory exists
  if (!fs.existsSync(BATTLESCRIBE_DIR)) {
    console.error(`Error: BattleScribe directory not found at ${BATTLESCRIBE_DIR}`);
    console.log('\nPlease create a "battlescribe" directory in the project root and add your .cat files there.');
    console.log('You can download .cat files from: https://github.com/BSData/wh40k-killteam');
    console.log('\nNote: .cat files (catalogues) are recommended over .bsi files (rosters)');
    console.log('      as they contain complete faction data.');
    process.exit(1);
  }
  
  // Find all .cat and .bsi files
  const files = fs.readdirSync(BATTLESCRIBE_DIR)
    .filter(f => f.endsWith('.cat') || f.endsWith('.catz') || f.endsWith('.bsi'));
  
  if (files.length === 0) {
    console.error(`Error: No .cat, .catz, or .bsi files found in ${BATTLESCRIBE_DIR}`);
    process.exit(1);
  }
  
  console.log(`Found ${files.length} BattleScribe file(s)\n`);
  
  const allFactions = [];
  const allFactionData = {};
  const processedFiles = [];
  const skippedFiles = [];
  
  // Process each file - each .cat/.bsi file will generate one faction JSON file
  for (const file of files) {
    const filePath = path.join(BATTLESCRIBE_DIR, file);
    console.log(`Processing: ${file}`);
    
    try {
      // Handle .catz files (compressed)
      let xmlPath = filePath;
      if (file.endsWith('.catz')) {
        console.log('  Note: .catz files need to be extracted first (they are zip archives)');
        console.log('  Rename to .zip, extract, then rename the .cat file back');
        continue;
      }
      
      // Handle .bsi files (roster files - need to extract catalogue reference)
      let data;
      if (file.endsWith('.bsi')) {
        console.log('  Note: .bsi files are roster files. Parsing roster...');
        try {
          const rosterData = await parseRoster(xmlPath);
          if (rosterData) {
            data = rosterData;
          } else {
            console.log('  Skipping (could not extract catalogue from roster)');
            continue;
          }
        } catch (parseError) {
          console.error(`  ✗ Error parsing roster: ${parseError.message}`);
          // Try to read first few bytes to help diagnose
          const sample = fs.readFileSync(xmlPath).slice(0, 200);
          console.log('  File starts with:', sample.toString('hex').substring(0, 40));
          console.log('  As text (first 100 chars):', sample.toString('utf8').substring(0, 100).replace(/[^\x20-\x7E]/g, '.'));
          continue;
        }
      } else {
        try {
          data = await parseCatalogue(xmlPath);
        } catch (parseError) {
          console.error(`  ✗ Error parsing catalogue: ${parseError.message}`);
          console.error(`  Stack: ${parseError.stack}`);
          continue;
        }
      }
      if (data && data.faction) {
        allFactions.push(data.faction);
        // Store the complete faction object
        allFactionData[data.faction.id] = {
          faction: data.faction
        };
        processedFiles.push(file);
        const f = data.faction;
        console.log(`  ✓ Extracted: ${f.operatives.length} operatives, ${f.rules.length} rules, ${f.equipment.length} equipment, ${f.strategicPloys.length} strategic ploys, ${f.tacticalPloys.length} tactical ploys\n`);
      } else {
        skippedFiles.push(file);
        console.log(`  ⚠ No faction data extracted from ${file}\n`);
      }
    } catch (error) {
      console.error(`  ✗ Error processing ${file}:`, error.message);
      skippedFiles.push(file);
    }
  }
  
  console.log(`\nProcessed ${processedFiles.length} file(s) successfully`);
  if (skippedFiles.length > 0) {
    console.log(`Skipped ${skippedFiles.length} file(s): ${skippedFiles.join(', ')}`);
  }
  
  // Write factions.json (summary list)
  const factionsJson = allFactions.map(f => ({
    id: f.id,
    name: f.name,
    factionKeyword: f.factionKeyword,
    archetypes: f.archetypes,
    summary: f.summary
  }));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'factions.json'),
    JSON.stringify(factionsJson, null, 2)
  );
  console.log(`✓ Written factions.json (${factionsJson.length} factions)`);
  
  // Write faction-specific files with new structure (complete faction objects)
  // Write a file for EVERY faction, even if empty
  for (const [factionId, data] of Object.entries(allFactionData)) {
    // The faction object now contains all the data
    const faction = data.faction;
    
    if (faction) {
      // Remove 'fac_' prefix from filename if present
      const fileId = factionId.startsWith('fac_') ? factionId.substring(4) : factionId;
      const fileName = `faction_${fileId}.json`;
      fs.writeFileSync(
        path.join(OUTPUT_DIR, fileName),
        JSON.stringify(faction, null, 2)
      );
      const counts = `${faction.operatives.length} operatives, ${faction.rules.length} rules, ${faction.equipment.length} equipment, ${faction.strategicPloys.length} strategic ploys, ${faction.tacticalPloys.length} tactical ploys`;
      console.log(`✓ Written ${fileName} (${counts})`);
    } else {
      console.warn(`  ⚠ Warning: No faction data for ${factionId}, skipping file generation`);
    }
  }
  
  // Update manifest
  const manifestFiles = [
    { name: 'rules.json', sha256: '' },
    { name: 'units.json', sha256: '' },
    { name: 'sequence.json', sha256: '' },
    { name: 'factions.json', sha256: '' }
  ];
  
  for (const factionId of Object.keys(allFactionData)) {
    // Remove 'fac_' prefix from filename if present
    const fileId = factionId.startsWith('fac_') ? factionId.substring(4) : factionId;
    manifestFiles.push({
      name: `faction_${fileId}.json`,
      sha256: ''
    });
  }
  
  const manifest = {
    version: `1.0.${Date.now()}`,
    generated: new Date().toISOString().split('T')[0],
    files: manifestFiles
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log(`✓ Updated manifest.json\n`);
  
  console.log('\nConversion complete!');
  console.log(`\nGenerated ${allFactions.length} faction JSON file(s):`);
  for (const f of allFactions) {
    // Remove 'fac_' prefix from filename if present
    const fileId = f.id.startsWith('fac_') ? f.id.substring(4) : f.id;
    console.log(`  - faction_${fileId}.json (${f.name})`);
  }
  console.log(`\nTotal data extracted:`);
  let totalOps = 0, totalRules = 0, totalEq = 0, totalStrategic = 0, totalTactical = 0;
  for (const data of Object.values(allFactionData)) {
    const f = data.faction;
    if (f) {
      totalOps += f.operatives.length;
      totalRules += f.rules.length;
      totalEq += f.equipment.length;
      totalStrategic += f.strategicPloys.length;
      totalTactical += f.tacticalPloys.length;
    }
  }
  console.log(`  - ${totalOps} operatives`);
  console.log(`  - ${totalRules} rules`);
  console.log(`  - ${totalEq} equipment`);
  console.log(`  - ${totalStrategic} strategic ploys`);
  console.log(`  - ${totalTactical} tactical ploys`);
}

// Run conversion
convertBattleScribeFiles().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

