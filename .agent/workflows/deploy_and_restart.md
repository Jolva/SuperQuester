---
description: Deploy changes and restart server
---

# Deploy and Restart Server

This workflow deploys addon changes and restarts the Bedrock server.

## Steps

// turbo-all
1. **Run cache buster** (auto-kills running server)
```bash
python tools/cache_buster.py
```

2. **Start server**
```bash
start_server.bat
```

## What it does

- Validates all JSON files
- Bumps pack versions
- Generates new UUIDs
- Updates RP dependency to match BP version
- Deploys to world folder
- Clears client cache
- Kills running server automatically
- Starts fresh server instance

## Quick deploy

Just run: `python tools/cache_buster.py && start_server.bat`
