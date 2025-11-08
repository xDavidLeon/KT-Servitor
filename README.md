# KT-Servitor
KT Servitor is a reference web app for Kill Team

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

## Update data
- Edit files in `public/data/v1/*.json`
- Update `version` in `public/data/v1/manifest.json`
- Optionally compute new SHA-256 for each file (the app checks integrity)
