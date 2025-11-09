# KT Servitor
KT Servitor is a free web-based app for running your Kill Team 2024 games, review game and faction rules and check operative stats.

## Run
```bash
npm i
npm run dev
# open http://localhost:3000
```

## Build PWA
```bash
npm run build
npm start
```

## Deploy to Netlify

### Option 1: Deploy via Netlify UI
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Netlify](https://app.netlify.com) and click "Add new site" → "Import an existing project"
3. Connect your repository
4. Netlify will automatically detect the `netlify.toml` configuration
5. Click "Deploy site"

### Option 2: Deploy via Netlify CLI
```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy (first time - will create site)
netlify deploy --prod

# Or deploy a draft
netlify deploy
```

The `netlify.toml` file is already configured with:
- Build command: `npm run build`
- Next.js plugin: `@netlify/plugin-nextjs` (handles Next.js routing automatically)
- Node version: 18

## Update data

### Manual editing
- Edit files in `public/data/v1/*.json`
- Update `version` in `public/data/v1/manifest.json`
- Optionally compute new SHA-256 for each file (the app checks integrity)

### Using BattleScribe data files

You can automatically populate factions and operatives from BattleScribe data files:

1. **Get BattleScribe files:**
   - **Recommended**: Download `.cat` (catalogue) files from [BSData/wh40k-killteam](https://github.com/BSData/wh40k-killteam)
     - These contain all faction data, operatives, weapons, etc.
     - Look for files like `2024 - Intercession Squad.cat` in the repository
   - **Alternative**: Use `.bsi` (roster) files exported from BattleScribe
     - Note: Roster files only contain the specific units in your list, not all available options
     - Some .bsi files may be in compressed/binary format and may not work

2. **Prepare files:**
   - Create a `battlescribe` directory in the project root
   - Place your `.cat` files in that directory
   - Note: `.catz` files are compressed archives - extract them first (rename to `.zip`, extract, then use the `.cat` file)

3. **Run conversion:**
   ```bash
   npm install  # Install xml2js dependency if not already installed
   npm run convert-battlescribe
   ```

4. **The script will:**
   - Parse all `.cat` files in the `battlescribe` directory
   - Extract factions, operatives (with stats, weapons, abilities), rules, equipment, ploys, and tac ops
   - Generate JSON files in `public/data/v1/`
   - Update the manifest.json automatically

The conversion script extracts:
- **Factions**: Name, tags, and summary
- **Operatives**: Stats (M, WS, BS, A, W, Sv), weapons with profiles, and special abilities
- **Rules**: Faction-specific rules
- **Equipment**: Available equipment items
- **Ploys**: Strategic and tactical ploys
- **Tac Ops**: Tactical operations
