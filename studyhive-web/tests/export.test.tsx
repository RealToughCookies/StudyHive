import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { buildAccountExport, EXPORT_TABLES } from '../src/services/accountExport'
import { useStore } from '../src/store'

const profile = { id: 41, auth_user_id: 'alice', email_confirmed_at: '2026-01-01', username: 'Alice', email: 'alice@example.test', subscription_tier: 'free', password: 'never-export' }
afterEach(() => useStore.getState().setUser(null))
function fixture() {
  useStore.getState().setUser(profile as any)
  const rows: Record<string, any[]> = { users: [profile] }
  const reads: string[] = [], downloads: string[] = []
  let hook = async (_table: string) => {}
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'alice', email_confirmed_at: '2026-01-01' } }, error: null }) },
    from(table: string) {
      reads.push(table)
      const filters: [string, unknown][] = []
      let cursor: unknown, key = 'id'
      const query: any = {
        select() { return query },
        eq(name: string, value: unknown) { filters.push([name, value]); return query },
        order(name: string) { key = name; return query },
        limit() { return query },
        gt(_name: string, value: unknown) { cursor = value; return query },
        async single() { await hook(table); return { data: rows[table]?.find(r => filters.every(([k,v]) => r[k] === v)), error: null } },
        async then(resolve: any, reject: any) {
          try {
            await hook(table)
            const data = (rows[table] || []).filter(r => filters.every(([k,v]) => r[k] === v) && (cursor === undefined || r[key] > cursor)).sort((a,b) => a[key] < b[key] ? -1 : 1).slice(0,2)
            return resolve({ data, error: null })
          } catch (e) { return reject(e) }
        },
      }
      return query
    },
    storage: { from(bucket: string) {
      assert.equal(bucket, 'study-files')
      return { download: async (path: string) => { downloads.push(path); return { data: new Blob(['attachment bytes'], { type: 'text/plain' }), error: null } } }
    } },
  }
  return { client: client as any, rows, reads, downloads, setHook: (next: typeof hook) => { hook = next } }
}

test('Free accounts export every page, scheduling history and exact attachment bytes without credentials', async () => {
  const f = fixture()
  f.rows.notes = Array.from({length:5}, (_,i) => ({ id: i+1, user_id: 41, title: 'Note', content: '<p>private text</p>' }))
  f.rows.notes.push({ id: 99, user_id: 42, content: 'other account' })
  f.rows.note_attachments = [{ id: 1, user_id: 41, note_id: 1, filename: '41/file.txt', original_name: 'lecture.txt', file_size: 16, file_type: 'text/plain' }]
  f.rows.settings = [{ id: 1, user_id: 41, theme: 'blue', openai_api_key: 'never-export' }]
  f.rows.card_reviews = [{ card_id: 1, user_id: 41, due_at: '2026-10-01', interval_days: 4, revision: 1 }]
  const result = await buildAccountExport({}, f.client)
  const raw = await result.blob.text(), data = JSON.parse(raw)
  assert.equal(data.tables.notes.length, 5)
  assert.equal(data.tables.card_reviews[0].interval_days, 4)
  assert.equal(Buffer.from(data.files[0].data,'base64').toString(), 'attachment bytes')
  assert.equal(raw.includes('never-export'), false)
  assert.equal(raw.includes('other account'), false)
  assert.equal(result.files, 1)
  assert.equal(Object.keys(data.tables).length, Object.keys(EXPORT_TABLES).length+1)
  assert.equal(f.reads.includes('billing_customers'), false)
  assert.equal(f.reads.includes('pro_config'), false)
  assert.deepEqual(f.downloads, ['41/file.txt'])
})

test('logout followed by login as the same account invalidates an in-flight export', async () => {
  const f = fixture()
  f.setHook(async table => {
    if (table === 'notes') { useStore.getState().setUser(null); useStore.getState().setUser(profile as any) }
  })
  await assert.rejects(buildAccountExport({},f.client), /account changed/)
  assert.equal(f.reads.includes('flashcards'), false)
})

test('export cancellation discards collected data before downloading files', async () => {
  const f=fixture(), controller=new AbortController()
  f.setHook(async table => { if(table === 'notes') controller.abort() })
  await assert.rejects(buildAccountExport({signal:controller.signal},f.client), /cancelled/)
  assert.deepEqual(f.downloads,[])
})

test('missing attachment fails the whole export rather than reporting a complete download', async () => {
  const f=fixture()
  f.rows.note_attachments=[{id:1,user_id:41,filename:'41/missing.txt',file_size:3}]
  f.client.storage.from=() => ({download:async()=>({data:null,error:new Error('not found')})})
  await assert.rejects(buildAccountExport({},f.client), /No partial export/)
})

test('foreign and traversal attachment paths are rejected before storage access', async () => {
  for(const path of ['42/secret.txt','41/../42/secret.txt','41/./file.txt','41/a\\b.txt']) {
    const f=fixture()
    f.rows.note_attachments=[{id:1,user_id:41,filename:path,file_size:3}]
    await assert.rejects(buildAccountExport({},f.client), /invalid private path/)
    assert.deepEqual(f.downloads,[])
  }
})

test('large exports stop without returning a partial file', async () => {
  const f=fixture()
  f.rows.notes=[{id:1,user_id:41,content:'a'.repeat(5000)}]
  await assert.rejects(buildAccountExport({maxBytes:2000},f.client), /50 MB/)
})

test('unverified authentication and a mismatched profile cannot export', async () => {
  const f=fixture()
  f.client.auth.getUser=async()=>({data:{user:{id:'alice',email_confirmed_at:null}},error:null})
  await assert.rejects(buildAccountExport({},f.client), /verified account/)
  assert.deepEqual(f.reads,[])
  f.client.auth.getUser=async()=>({data:{user:{id:'bob',email_confirmed_at:'2026-01-01'}},error:null})
  await assert.rejects(buildAccountExport({},f.client), /verify your account profile/)
})

test('a table request failure never produces a successful export', async () => {
  const f=fixture()
  f.setHook(async table=>{if(table==='quizzes') throw new Error('connection lost')})
  await assert.rejects(buildAccountExport({},f.client), /connection lost/)
  assert.deepEqual(f.downloads,[])
})
