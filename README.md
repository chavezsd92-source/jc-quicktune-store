# JC QuickTune store page

Plain product page for the dual-mode B46/B48 MG1 full-flash tune.

**Live:** https://chavezsd92-source.github.io/jc-quicktune-store/

## Requirements called out on the site

- Full BIN flash (not partial)
- DME already unlocked via B48 Quickflash or similar (product does not unlock the DME)
- Stock backup before flash
- All-stock baseline figures; mods must be disclosed

## Verification

Power/torque figures presented as verified using **JC Street Dyno** and extensive datalog testing on stock hardware.

## Deploy

```powershell
git add .
git commit -m "Update store page"
git push
```

GitHub Pages serves from `main` root.
