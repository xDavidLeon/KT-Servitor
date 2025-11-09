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

// Extract weapons with full details (ATK, HIT, DMG, WR)
function extractWeaponsDetailed(selectionEntry) {
  const weapons = [];
  if (!selectionEntry) return weapons;
  
  const groups = selectionEntry.selectionEntryGroups || [];
  const entries = selectionEntry.selectionEntries || [];
  const profiles = selectionEntry.profiles || [];
  
  // Process profiles directly on the entry
  profiles.forEach(profile => {
    if (!profile) return;
    const typeId = getAttr(profile, 'typeId');
    const typeName = getText(profile.typeName) || getAttr(profile, 'typeName');
    const profileName = getText(profile.name) || getAttr(profile, 'name');
    
    if (typeId === 'battlescribe-weapon' || typeName === 'Weapons' || profileName?.includes('⌖') || profileName?.includes('⚔')) {
      const weapon = {
        name: profileName?.replace(/[⌖⚔]/g, '').trim() || 'Weapon',
        atk: null,
        hit: null,
        dmg: null,
        specialRules: []
      };
      
      const characteristics = profile.characteristics || [];
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
          }
        }
      });
      
      if (weapon.name && (weapon.atk || weapon.hit || weapon.dmg)) {
        weapons.push(weapon);
      }
    }
  });
  
  // Look for weapon groups
  groups.forEach(group => {
    if (!group) return;
    const name = getText(group.name) || getAttr(group, 'name');
    if (name && typeof name === 'string' && (name.toLowerCase().includes('weapon') || name.toLowerCase().includes('wargear'))) {
      const groupEntries = group.selectionEntries || [];
      groupEntries.forEach(entry => {
        if (!entry) return;
        const entryProfiles = entry.profiles || [];
        entryProfiles.forEach(profile => {
          if (!profile) return;
          const typeId = getAttr(profile, 'typeId');
          const typeName = getText(profile.typeName) || getAttr(profile, 'typeName');
          const profileName = getText(profile.name) || getAttr(profile, 'name');
          
          if (typeId === 'battlescribe-weapon' || typeName === 'Weapons' || profileName?.includes('⌖') || profileName?.includes('⚔')) {
            const weapon = {
              name: profileName?.replace(/[⌖⚔]/g, '').trim() || getText(entry.name) || 'Weapon',
              atk: null,
              hit: null,
              dmg: null,
              specialRules: []
            };
            
            const characteristics = profile.characteristics || [];
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
                  const rules = charValue.split(',').map(r => r.trim()).filter(r => r);
                  weapon.specialRules.push(...rules);
                }
              }
            });
            
            if (weapon.name && (weapon.atk || weapon.hit || weapon.dmg)) {
              weapons.push(weapon);
            }
          }
        });
      });
    }
  });
  
  // Also check direct entries
  entries.forEach(entry => {
    if (!entry) return;
    const entryProfiles = entry.profiles || [];
    entryProfiles.forEach(profile => {
      if (!profile) return;
      const typeId = getAttr(profile, 'typeId');
      const typeName = getText(profile.typeName) || getAttr(profile, 'typeName');
      const profileName = getText(profile.name) || getAttr(profile, 'name');
      
      if (typeId === 'battlescribe-weapon' || typeName === 'Weapons' || profileName?.includes('⌖') || profileName?.includes('⚔')) {
        const weapon = {
          name: profileName?.replace(/[⌖⚔]/g, '').trim() || getText(entry.name) || 'Weapon',
          atk: null,
          hit: null,
          dmg: null,
          specialRules: []
        };
        
        const characteristics = profile.characteristics || [];
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
              const rules = charValue.split(',').map(r => r.trim()).filter(r => r);
              weapon.specialRules.push(...rules);
            }
          }
        });
        
        if (weapon.name && (weapon.atk || weapon.hit || weapon.dmg)) {
          weapons.push(weapon);
        }
      }
    });
  });
  
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
      const groupEntries = group.selectionEntries || [];
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
  const categoryEntries = catalogue.categoryEntries || [];
  let factionKeyword = null;
  const archetypes = [];
  const allKeywords = [];
  
  categoryEntries.forEach(catEntry => {
    const catName = getText(catEntry.name) || getAttr(catEntry, 'name');
    if (catName) {
      allKeywords.push(catName);
      // Look for faction keyword (usually all caps or specific pattern)
      if (catName === catName.toUpperCase() && catName.length > 3 && !factionKeyword) {
        factionKeyword = catName;
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
    operatives: []
  };
  
  // Extract operatives and other content
  const operatives = [];
  const rules = [];
  const equipment = [];
  const strategicPloys = [];
  const tacticalPloys = [];
  const tacops = [];
  
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
        const weapon = {
          name: profileName?.replace(/[⌖⚔]/g, '').trim() || sharedName || 'Weapon',
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
            }
          }
        });
        
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
  
  // Handle xml2js structure: selectionEntries can be an array containing objects with selectionEntry arrays
  let selectionEntries = [];
  if (catalogue.selectionEntries) {
    if (Array.isArray(catalogue.selectionEntries)) {
      // It's an array - could be direct entries or wrapped
      catalogue.selectionEntries.forEach(item => {
        if (item && typeof item === 'object') {
          // Check if it has a selectionEntry property (wrapped structure)
          if (item.selectionEntry) {
            const entries = Array.isArray(item.selectionEntry) ? item.selectionEntry : [item.selectionEntry];
            selectionEntries.push(...entries);
          } else {
            // It's a direct entry
            selectionEntries.push(item);
          }
        }
      });
    } else if (catalogue.selectionEntries.selectionEntry) {
      // It's an object with selectionEntry array
      const entries = Array.isArray(catalogue.selectionEntries.selectionEntry) 
        ? catalogue.selectionEntries.selectionEntry 
        : [catalogue.selectionEntries.selectionEntry];
      selectionEntries = entries;
    } else {
      // It's a single entry object
      selectionEntries = [catalogue.selectionEntries];
    }
  }
  
  console.log(`  Found ${selectionEntries.length} selection entries to process`);
  
  selectionEntries.forEach(entry => {
    if (!entry) return; // Skip null/undefined entries
    
    const entryName = getText(entry.name) || getAttr(entry, 'name') || 'Unnamed';
    const entryType = getAttr(entry, 'type');
    const entryId = sanitizeId(entryName);
    
    // Check if this is an operative (usually has profiles with stats)
    const profiles = entry.profiles || [];
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
      const entryCategoryLinks = entry.categoryLinks || [];
      const operativeKeywords = [];
      entryCategoryLinks.forEach(catLink => {
        const catName = getText(catLink.name) || getAttr(catLink, 'name');
        if (catName && catName !== faction.factionKeyword) {
          operativeKeywords.push(catName);
        }
      });
      
      // Extract special rules and actions from profiles with typeName="Abilities"
      const specialRules = [];
      const specialActions = [];
      profiles.forEach(profile => {
        if (!profile) return;
        const typeName = getText(profile.typeName) || getAttr(profile, 'typeName');
        if (typeName === 'Abilities') {
          const abilityName = getText(profile.name) || getAttr(profile, 'name');
          const characteristics = profile.characteristics || [];
          let abilityDescription = '';
          characteristics.forEach(char => {
            const charName = getAttr(char, 'name');
            if (charName === 'Ability') {
              abilityDescription = getText(char);
            }
          });
          if (abilityName && abilityDescription) {
            specialRules.push({
              name: abilityName,
              description: abilityDescription
            });
          }
        }
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
          factionKeyword: faction.factionKeyword,
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
      const fileName = `faction_${factionId}.json`;
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
    manifestFiles.push({
      name: `faction_${factionId}.json`,
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
    console.log(`  - faction_${f.id}.json (${f.name})`);
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

