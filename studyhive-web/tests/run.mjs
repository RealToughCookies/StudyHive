import { build } from 'esbuild'
import { mkdtemp, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const dir = await mkdtemp('.studyhive-tests-')
try {
  const entries = ['tests/regressions.test.tsx', 'tests/audit.test.tsx']
  await build({
    entryPoints: entries, outdir: dir, outExtension: { '.js': '.mjs' },
    bundle: true, platform: 'node', format: 'esm', packages: 'external',
    define: { 'import.meta.env.BASE_URL': JSON.stringify(path.resolve('public') + '/') },
  })
  const result = spawnSync(process.execPath, ['--test', ...entries.map(entry => path.join(dir, path.basename(entry).replace('.tsx', '.mjs')))], { stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally {
  await rm(dir, { recursive: true, force: true })
}
