# KT Servitor
KT Servitor is a free web-based app for running your Kill Team 2024 games, review game and faction rules and check operative stats.

A live website is available at [https://ktservitor.xdavidleon.com/](https://ktservitor.xdavidleon.com/).

You can deploy your own version of the site by downloading this repository and following these instructions.

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
- Node version: 20

## Custom Domain Setup

To use a custom domain (e.g., `ktservitor.your-domain.com`):

1. **In Netlify Dashboard:**
   - Go to your site → **Site configuration** → **Domain management**
   - Click **Add custom domain**
   - Enter your domain: `ktservitor.your-domain.com`
   - Click **Verify**

2. **Configure DNS:**
   - Netlify will provide DNS records to add
   - For a subdomain, add a **CNAME** record:
     - **Name/Host**: `ktservitor`
     - **Value/Target**: `your-site-name.netlify.app` (or the provided Netlify domain)
     - **TTL**: 3600 (or default)
   - Alternatively, use Netlify's nameservers if managing the entire domain

3. **SSL Certificate:**
   - Netlify automatically provisions a free SSL certificate via Let's Encrypt
   - This usually completes within a few minutes after DNS propagation

4. **Verify:**
   - Once DNS propagates (can take up to 48 hours, usually much faster)
   - Your site will be accessible at `https://ktservitor.xdavidleon.com`

**Note:** The app uses relative paths, so it works automatically with any domain without code changes.

## Update data

### Manual editing
- Edit files in `public/data/v1/*.json`
- Update `version` in `public/data/v1/manifest.json`
- Optionally compute new SHA-256 for each file (the app checks integrity)

### Kill Team dataset (preferred)

The app now consumes the community-maintained dataset from [vjosset/killteamjson](https://github.com/vjosset/killteamjson). On first load the in-browser updater (`lib/update.js`) downloads the latest `kt24_v*.json`, verifies it and stores it locally for search.

To use a different data source when self-hosting:
- Host your JSON dataset somewhere reachable over HTTPS.
- Update `KILLTEAM_JSON_URL` in `lib/update.js` to point to it.
- Redeploy or rebuild so clients pick up the new URL.
