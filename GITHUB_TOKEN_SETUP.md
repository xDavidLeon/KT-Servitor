# GitHub Token Setup Guide

This guide will help you set up a GitHub Personal Access Token to increase API rate limits from **60 requests/hour** to **5,000 requests/hour**.

## Why Use a GitHub Token?

The GitHub API has rate limits:
- **Without token**: 60 requests per hour per IP address
- **With token**: 5,000 requests per hour per authenticated user

This is especially important when:
- Running the app on localhost (all requests come from the same IP)
- Multiple developers are working on the same network
- The app needs to fetch many team files

## Step 1: Create a GitHub Personal Access Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Fill in the form:
   - **Note**: `KT-Servitor API Access` (or any descriptive name)
   - **Expiration**: Choose your preference (90 days, 1 year, or no expiration)
   - **Scopes**: **No scopes needed!** For public repositories, you don't need any permissions. Leave all checkboxes unchecked.
4. Click **"Generate token"** at the bottom
5. **Copy the token immediately** - you won't be able to see it again!

## Step 2: Set Up for Local Development

### Option A: Using .env.local file (Recommended)

1. Copy the example file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` and replace `your_github_token_here` with your actual token:
   ```
   GITHUB_TOKEN=ghp_your_actual_token_here
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

### Option B: Using Environment Variable (Windows PowerShell)

```powershell
$env:GITHUB_TOKEN="ghp_your_actual_token_here"
npm run dev
```

### Option C: Using Environment Variable (Windows CMD)

```cmd
set GITHUB_TOKEN=ghp_your_actual_token_here
npm run dev
```

## Step 3: Set Up for Production (Netlify)

If you're deploying to Netlify, you need to set the environment variable in Netlify's dashboard:

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Click **"Add variable"**
4. Set:
   - **Key**: `GITHUB_TOKEN`
   - **Value**: Your GitHub token
5. Click **"Save"**
6. Redeploy your site (or it will use the new variable on the next deployment)

## Step 4: Verify It's Working

1. Start your dev server: `npm run dev`
2. Open the browser console (F12)
3. Navigate to the Kill Teams page
4. Check the console logs - you should see successful API calls
5. If you see rate limit errors, the token might not be set correctly

## Security Notes

- ✅ The `.env.local` file is already in `.gitignore` - it won't be committed
- ✅ The token only needs access to public repositories (no special permissions)
- ✅ You can revoke the token anytime from GitHub settings
- ❌ Never commit your token to git
- ❌ Never share your token publicly

## Troubleshooting

### Token not working?
- Make sure you restarted the dev server after setting the token
- Check that the token is set correctly: `console.log(process.env.GITHUB_TOKEN)` in the API route (remove after testing!)
- Verify the token hasn't expired in GitHub settings

### Still getting rate limited?
- Check if the token is actually being used (look for `Authorization` header in network tab)
- Make sure you're using the API proxy route (should see `/api/github-proxy` in network requests)
- The cache should help - wait a bit and try again (cache lasts 1 hour)

## Rate Limit Information

- **Without token**: 60 requests/hour
- **With token**: 5,000 requests/hour
- **Cache duration**: 1 hour (reduces API calls significantly)

The app will automatically use cached data if rate limited, so it should continue working even without a token, just with slower updates.

