#!/usr/bin/env python3
"""Run only the isolated restore-test frontend on loopback port 5174."""
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
env = {k: v for k, v in os.environ.items() if not k.startswith('VITE_')}
env.update(VITE_DATA_MODE='cloud',
           VITE_SUPABASE_URL='https://llhttvndnusoalbcvfzr.supabase.co',
           VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_omgxEgviI5Za1XQAkSf09w_OtFWMkll',
           VITE_TURNSTILE_SITE_KEY='')
raise SystemExit(subprocess.call(['node', 'node_modules/vite/bin/vite.js', '--config', 'scripts/vite.restore.config.ts'], cwd=root, env=env))
