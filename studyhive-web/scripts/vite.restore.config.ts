import { defineConfig, mergeConfig } from 'vite'
import base from '../vite.config'

export default mergeConfig(base, defineConfig({
  envDir: false,
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  plugins: [{
    name: 'restore-test-label',
    transformIndexHtml(html: string) {
      return {
        html: html.replace(/<title>.*?<\/title>/, '<title>RESTORE TEST — StudyHive</title>'),
        tags: [{ tag: 'div', attrs: { style: 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#92400e;color:white;text-align:center;padding:6px;font:14px sans-serif;pointer-events:none' }, children: 'RESTORE TEST • Separate test database • Billing and AI unavailable', injectTo: 'body' }],
      }
    },
  }],
}))
