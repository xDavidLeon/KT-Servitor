# Data Structure Schema

## Faction Structure

```json
{
  "id": "fac_angels_of_death",
  "name": "Angels of Death",
  "factionKeyword": "ANGEL OF DEATH",
  "archetypes": ["Seek & Destroy", "Security"],
  "summary": "Elite Space Marines...",
  "rules": [
    {
      "id": "fac_angels_of_death_rule_1",
      "name": "And They Shall Know No Fear",
      "description": "Ignore certain modifiers..."
    }
  ],
  "strategicPloys": [
    {
      "id": "fac_angels_of_death_strategic_1",
      "name": "Oath of the Moment",
      "description": "Choose a target..."
    }
  ],
  "tacticalPloys": [
    {
      "id": "fac_angels_of_death_tactical_1",
      "name": "Tactical Ploy",
      "description": "..."
    }
  ],
  "equipment": [
    {
      "id": "fac_angels_of_death_eq_1",
      "name": "Astartes Amulet",
      "description": "One operative only..."
    }
  ],
  "operatives": [
    {
      "id": "fac_angels_of_death_op_sergeant",
      "name": "Intercession Sergeant",
      "factionKeyword": "ANGEL OF DEATH",
      "keywords": ["Leader", "Sergeant"],
      "apl": 3,
      "move": "6\"",
      "save": "3+",
      "wounds": 15,
      "weapons": [
        {
          "name": "Bolt rifle",
          "atk": "4",
          "hit": "3+",
          "dmg": "4/5",
          "specialRules": ["Range 30\"", "P1"]
        }
      ],
      "specialRules": [
        {
          "name": "And They Shall Know No Fear",
          "description": "Ignore modifiers to APL loss..."
        }
      ],
      "specialActions": [
        {
          "name": "Shoot",
          "description": "Make a shooting attack..."
        }
      ]
    }
  ]
}
```

## Operative Structure

```json
{
  "id": "fac_angels_of_death_op_sergeant",
  "name": "Intercession Sergeant",
  "factionKeyword": "ANGEL OF DEATH",
  "keywords": ["Leader", "Sergeant"],
  "apl": 3,
  "move": "6\"",
  "save": "3+",
  "wounds": 15,
  "weapons": [
    {
      "name": "Bolt rifle",
      "atk": "4",
      "hit": "3+",
      "dmg": "4/5",
      "specialRules": ["Range 30\"", "P1"]
    }
  ],
  "specialRules": [],
  "specialActions": []
}
```

## Tac Ops Structure

```json
{
  "archetypes": [
    {
      "name": "Seek & Destroy",
      "tacops": [
        {
          "id": "tacop_seek_1",
          "name": "Tac Op Name",
          "description": "..."
        }
      ]
    }
  ]
}
```

