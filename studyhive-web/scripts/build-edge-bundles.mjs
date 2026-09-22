import { build } from 'esbuild'
// Dashboard-ready single-file modules. Secrets are read by Deno at runtime, never embedded.
for (const name of ['pro-service', 'stripe-webhook', 'delete-account']) {
  await build({
    entryPoints: [`supabase/functions/${name}/index.ts`],
    outfile: `dist-edge/${name}/index.ts`, bundle: true, format: 'esm', platform: 'neutral',
    target: 'es2022', external: ['npm:*'],
  })
}
console.log('Prepared dashboard modules in dist-edge/. Deploy only after applying the required migrations, including storage limits and upload cleanup. See docs/STORAGE_LIMITS.md.')
