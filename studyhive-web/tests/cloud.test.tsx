import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { readCloudConfig } from '../src/services/cloud/client'
import { EXPORT_TABLES } from '../src/services/accountExport'

const db = new PGlite()
const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
let aliceId: number, bobId: number
async function asUser<T = any>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec('set role authenticated')
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid])
    return (await db.query<T>(sql, params)).rows
  } finally { await db.exec('reset role') }
}

before(async () => {
  // Only Supabase-owned auth/storage infrastructure is substituted. All application tables,
  // policies, grants, triggers and RPCs below come from the actual deployment migration.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, storage, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id bigint generated always as identity primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
  `)
  await db.exec(await readFile('supabase/migrations/20260909000000_cloud_foundation.sql', 'utf8'))
  await db.exec(await readFile('supabase/migrations/20260914000000_pro_services.sql', 'utf8'))
  await db.exec(await readFile('supabase/migrations/20260916000000_account_deletion.sql', 'utf8'))
  await db.query(`insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
    ($1,'alice@example.test','{"username":"Alice","subscription_tier":"premium"}',now()),
    ($2,'bob@example.test','{"username":"Bob"}',now())`, [alice, bob])
  aliceId = (await asUser(alice, 'select id from public.users'))[0].id
  bobId = (await asUser(bob, 'select id from public.users'))[0].id
})
after(() => db.close())

test('export fields match the deployed schema and are readable only for the current owner', async () => {
  for (const [table, fields] of Object.entries(EXPORT_TABLES)) {
    const rows = await asUser(alice, `select ${fields} from public.${table}`)
    assert.ok(rows.every(row => row.user_id === aliceId), table)
    assert.deepEqual(await asUser(bob, `select ${fields} from public.${table} where user_id = $1`, [aliceId]), [])
  }
})

test('cloud configuration fails closed and refuses privileged keys', () => {
  assert.throws(() => readCloudConfig({}), /Connect a Supabase/)
  assert.equal(readCloudConfig({ VITE_DATA_MODE: 'local' }), null)
  assert.throws(() => readCloudConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_bad' }), /publishable key/)
  assert.throws(() => readCloudConfig({ VITE_SUPABASE_URL: 'http://example.com', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }), /HTTPS/)
})

test('signup creates a free private profile and default settings, ignoring forged tier metadata', async () => {
  const profiles = await asUser(alice, 'select * from public.users')
  assert.equal(profiles.length, 1)
  assert.equal(profiles[0].username, 'Alice')
  assert.equal(profiles[0].subscription_tier, 'free')
  assert.equal((await asUser(alice, 'select * from public.settings')).length, 1)
  await assert.rejects(asUser(alice, 'delete from public.settings'), /permission denied/)
  await assert.rejects(asUser(alice, "update public.users set subscription_tier = 'premium'"), /permission denied/)
  await assert.rejects(asUser(alice, 'insert into public.users(auth_user_id,username,email) values ($1,\'X\',\'x\')', [bob]), /permission denied/)
})

test('notes are isolated for reads, direct ID edits, deletes and forged owners', async () => {
  const [note] = await asUser(alice, "insert into public.notes(title,content) values ('Private','Alice only') returning *")
  assert.equal((await asUser(bob, 'select * from public.notes where id = $1', [note.id])).length, 0)
  assert.equal((await asUser(bob, "update public.notes set content='stolen' where id=$1 returning id", [note.id])).length, 0)
  assert.equal((await asUser(bob, 'delete from public.notes where id=$1 returning id', [note.id])).length, 0)
  await assert.rejects(asUser(bob, "insert into public.notes(user_id,title,content) values ($1,'Forged','x')", [aliceId]), /row-level security/)
  await assert.rejects(asUser(alice, 'update public.notes set user_id=$1 where id=$2', [bobId, note.id]), /row-level security/)
  assert.equal((await asUser(alice, 'select content from public.notes where id=$1', [note.id]))[0].content, 'Alice only')
})

test('foreign keys cannot link materials to another account; deleting own class retains notes', async () => {
  const [cls] = await asUser(alice, "insert into public.classes(name) values ('Biology') returning id")
  await assert.rejects(asUser(bob, "insert into public.notes(class_id,title,content) values ($1,'Bad reference','x')", [cls.id]), /foreign key/)
  const [note] = await asUser(alice, "insert into public.notes(class_id,title,content) values ($1,'Lecture','x') returning id", [cls.id])
  await asUser(alice, 'delete from public.classes where id=$1', [cls.id])
  assert.equal((await asUser(alice, 'select class_id from public.notes where id=$1', [note.id]))[0].class_id, null)
})

test('deck creation is atomic and manual cards remain available to free users', async () => {
  const before = await asUser(alice, 'select id from public.flashcard_decks')
  await assert.rejects(asUser(alice, "select public.create_flashcard_deck('Incomplete', $1)", [JSON.stringify([{front:'valid',back:'valid'}, {front:'',back:'bad'}])]), /check constraint/)
  assert.equal((await asUser(alice, 'select id from public.flashcard_decks')).length, before.length)
  const [created] = await asUser(alice, "select public.create_flashcard_deck('Manual', $1) as id", [JSON.stringify([{front:'Q',back:'A'}])])
  assert.equal((await asUser(alice, 'select * from public.flashcards where deck_id=$1', [created.id])).length, 1)
  assert.equal((await asUser(bob, 'select * from public.flashcards where deck_id=$1', [created.id])).length, 0)
  await assert.rejects(asUser(alice, 'update public.flashcard_decks set spaced_repetition_enabled=true where id=$1', [created.id]), /row-level security/)
})

test('free users cannot create quizzes and Pro expires on the server', async () => {
  await assert.rejects(asUser(bob, "insert into public.quizzes(title,questions) values ('Quiz','[]')"), /row-level security/)
  await db.query("update public.users set subscription_tier='premium',subscription_expires_at=now()+interval '1 day' where id=$1", [bobId])
  assert.equal((await asUser(bob, 'select public.has_pro() as allowed'))[0].allowed, true)
  await asUser(bob, "insert into public.quizzes(title,questions) values ('Quiz','[]')")
  await db.query("update public.users set subscription_expires_at=now()-interval '1 second' where id=$1", [bobId])
  assert.equal((await asUser(bob, 'select public.has_pro() as allowed'))[0].allowed, false)
  await assert.rejects(asUser(bob, "insert into public.quizzes(title,questions) values ('Expired','[]')"), /row-level security/)
  assert.equal((await asUser(bob, 'select * from public.quizzes')).length, 1)
})

test('concurrent note saves reject stale revisions without destroying either saved version', async () => {
  const [note] = await asUser(alice, "insert into public.notes(title,content) values ('Original','v1') returning *")
  const [saved] = await asUser(alice, "select * from public.save_note($1,1,'New','v2')", [note.id])
  assert.equal(saved.revision, 2)
  await assert.rejects(asUser(alice, "select * from public.save_note($1,1,'Stale','overwritten')", [note.id]), /changed on another device/)
  await assert.rejects(asUser(bob, "select * from public.save_note($1,2,'Stolen','bad')", [note.id]), /changed on another device/)
  assert.equal((await asUser(alice, 'select content from public.notes where id=$1', [note.id]))[0].content, 'v2')
})

test('private file policies reject cross-account downloads, uploads, deletes and public access', async () => {
  const name = `${aliceId}/document.pdf`
  await asUser(alice, "insert into storage.objects(bucket_id,name) values ('study-files',$1)", [name])
  assert.equal((await asUser(alice, 'select * from storage.objects where name=$1', [name])).length, 1)
  assert.equal((await asUser(bob, 'select * from storage.objects where name=$1', [name])).length, 0)
  await assert.rejects(asUser(bob, "insert into storage.objects(bucket_id,name) values ('study-files',$1)", [name]), /row-level security/)
  assert.equal((await asUser(bob, 'delete from storage.objects where name=$1 returning id', [name])).length, 0)
  const bucket = (await db.query<any>("select * from storage.buckets where id='study-files'")).rows[0]
  assert.equal(bucket.public, false)
  assert.equal(bucket.file_size_limit, 10485760)
  await db.exec('set role anon')
  try { await assert.rejects(db.query('select * from public.notes'), /permission denied/) }
  finally { await db.exec('reset role') }
})

test('unverified accounts cannot access study data even if a token is issued', async () => {
  const uid = '33333333-3333-4333-8333-333333333333'
  await db.query("insert into auth.users(id,email) values ($1,'unverified@example.test')", [uid])
  assert.equal((await asUser(uid, 'select * from public.settings')).length, 0)
  await assert.rejects(asUser(uid, "insert into public.notes(title,content) values ('Blocked','x')"), /null value|row-level security/)
})


test('scheduled review is opt-in, isolated, durable and rejects duplicate/stale ratings', async () => {
 await db.query("update public.users set subscription_tier='premium',subscription_expires_at=now()+interval '1 day' where id=$1",[aliceId])
 const [deck]=await asUser(alice,"select public.create_flashcard_deck('Scheduled', $1) as id",[JSON.stringify([{front:'Q',back:'A'}])])
 const [card]=await asUser(alice,'select id from public.flashcards where deck_id=$1',[deck.id])
 await assert.rejects(asUser(alice,"select public.review_flashcard($1,'good',0)",[card.id]),/Enable spaced repetition/)
 await asUser(alice,'update public.flashcard_decks set spaced_repetition_enabled=true where id=$1',[deck.id])
 await assert.rejects(asUser(bob,"select public.review_flashcard($1,'good',0)",[card.id]),/Pro is required/)
 const [review]=await asUser(alice,"select * from public.review_flashcard($1,'good',0)",[card.id])
 assert.equal(review.interval_days,1)
 assert.equal(review.revision,1)
 assert.equal((await asUser(alice,'select * from public.due_flashcards($1)',[deck.id])).length,0)
 await assert.rejects(asUser(alice,"select public.review_flashcard($1,'easy',0)",[card.id]),/another device/)
 assert.equal((await asUser(bob,'select * from public.card_reviews')).length,0)
 await assert.rejects(asUser(alice,'update public.card_reviews set interval_days=365'),/permission denied/)
 await db.query("update public.users set subscription_expires_at=now()-interval '1 day' where id=$1",[aliceId])
 await asUser(alice,'update public.flashcard_decks set spaced_repetition_enabled=false where id=$1',[deck.id])
 await asUser(alice,"update public.flashcards set front='Still editable' where id=$1",[card.id])
})

test('AI reservations enforce quota and save results atomically without double charging', async () => {
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 await db.exec('update public.pro_config set monthly_generations=1')
 await assert.rejects(db.query("select public.reserve_ai_job($1,$2,'hash','notes')",[aliceId,id]),/Pro is required/)
 await db.query("update public.users set subscription_tier='premium',subscription_expires_at=now()+interval '1 day' where id=$1",[aliceId])
 await assert.rejects(asUser(alice,"select public.reserve_ai_job($1,$2,'hash','notes')",[aliceId,id]),/permission denied/)
 await db.query("select public.reserve_ai_job($1,$2,'hash','notes')",[aliceId,id])
 await assert.rejects(db.query("select public.reserve_ai_job($1,$2,'hash','notes')",[aliceId,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']),/allowance/)
 const [result]=(await db.query<any>("select * from public.finish_ai_job($1,$2,'Generated','<p>body</p>',null)",[aliceId,id])).rows
 assert.equal(result.status,'completed')
 const replay=(await db.query<any>("select * from public.reserve_ai_job($1,$2,'hash','notes')",[aliceId,id])).rows[0]
 assert.equal(replay.artifact_id,result.artifact_id)
 assert.equal((await asUser(alice,'select public.ai_allowance() as usage'))[0].usage.used,1)
 assert.equal((await asUser(bob,'select * from public.ai_jobs')).length,0)
 await assert.rejects(asUser(alice,"update public.ai_jobs set status='failed'"),/permission denied/)
})

test('failed AI save rolls back artifact and failed attempts do not consume allowance', async()=>{
 const id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
 await db.exec('update public.pro_config set monthly_generations=2')
 await db.query("select public.reserve_ai_job($1,$2,'hash2','flashcards')",[aliceId,id])
 const before=(await asUser(alice,'select id from public.flashcard_decks')).length
 await assert.rejects(db.query("select public.finish_ai_job($1,$2,'Broken','',$3)",[aliceId,id,JSON.stringify([{front:'Q',back:'A'},{front:'',back:'A'}])]),/check constraint/)
 assert.equal((await asUser(alice,'select id from public.flashcard_decks')).length,before)
 await db.query("update public.ai_jobs set status='failed' where id=$1",[id])
 assert.equal((await asUser(alice,'select public.ai_allowance() as usage'))[0].usage.used,1)
})

test('billing synchronization rejects forged clients and stale lease holders',async()=>{
 await db.query("insert into public.billing_customers(user_id,customer_id) values($1,'cus_test')",[aliceId])
 const token='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
 await assert.rejects(asUser(alice,"select public.claim_billing_sync('cus_test',$1)",[token]),/permission denied/)
 assert.equal((await db.query<any>("select public.claim_billing_sync('cus_test',$1) as ok",[token])).rows[0].ok,true)
 assert.equal((await db.query<any>("select public.claim_billing_sync('cus_test',$1) as ok",['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'])).rows[0].ok,false)
 await assert.rejects(db.query("select public.apply_billing_sync('cus_test',$1,now()+interval '1 day')",['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee']),/lock expired/)
 await db.query("select public.apply_billing_sync('cus_test',$1,null)",[token])
 assert.equal((await asUser(alice,'select public.has_pro() as pro'))[0].pro,false)
})

test('deletion is server-only, pauses for active work and blocks new writes while keeping retry access', async () => {
 const token='ffffffff-ffff-4fff-8fff-ffffffffffff'
 await assert.rejects(asUser(alice,'select public.begin_account_deletion($1,$2)',[aliceId,token]),/permission denied/)
 await assert.rejects(asUser(alice,'select * from public.account_deletions'),/permission denied/)
 await db.query("select public.claim_billing_sync('cus_test',$1)",[token])
 await assert.rejects(db.query('select public.begin_account_deletion($1,$2)',[aliceId,token]),/still processing/)
 await db.query("select public.apply_billing_sync('cus_test',$1,now()+interval '1 day')",[token])
 await db.exec('update public.pro_config set monthly_generations=10')
 await db.query("select public.reserve_ai_job($1,$2,'last','notes')",[aliceId,token])
 await assert.rejects(db.query('select public.begin_account_deletion($1,$2)',[aliceId,token]),/still processing/)
 await db.query("update public.ai_jobs set created_at=now()-interval '11 minutes' where id=$1",[token])
 await asUser(alice,"insert into storage.objects(bucket_id,name) values ('study-files',$1)",[`${aliceId}/ai/retained.txt`])
 await asUser(bob,"insert into storage.objects(bucket_id,name) values ('study-files',$1)",[`${bobId}/private.txt`])
 const [cls]=await asUser(alice,"insert into public.classes(name) values ('Cascade class') returning id")
 const [note]=await asUser(alice,"insert into public.notes(class_id,title,content) values ($1,'Cascade note','x') returning id",[cls.id])
 await asUser(alice,"select public.create_flashcard_deck('Cascade deck',$1,$2,$3)",[JSON.stringify([{front:'Q',back:'A'}]),cls.id,note.id])
 await db.query('select public.begin_account_deletion($1,$2)',[aliceId,token])
 await assert.rejects(db.query('select public.begin_account_deletion($1,$2)',[aliceId,token]),/already processing/)
 assert.equal((await asUser(alice,'select * from public.settings')).length,1)
 await assert.rejects(asUser(alice,"insert into public.notes(title,content) values ('new','blocked')"),/deletion is in progress/)
 await assert.rejects(asUser(alice,"update public.notes set title='blocked'"),/deletion is in progress/)
 await assert.rejects(asUser(alice,"insert into storage.objects(bucket_id,name) values ('study-files',$1)",[`${aliceId}/late.txt`]),/deletion is in progress/)
 await assert.rejects(db.query("select public.claim_billing_sync('cus_test',$1)",[token]),/deletion is in progress/)
 await assert.rejects(db.query("select public.finish_ai_job($1,$2,'Late AI','body',null)",[aliceId,token]),/deletion is in progress/)
 await assert.rejects(asUser(alice,'select * from public.deletion_file_batch($1,$2)',[aliceId,token]),/permission denied/)
 await assert.rejects(db.query('select * from public.deletion_file_batch($1,$2)',[bobId,token]),/lease expired/)
 const files=(await db.query<any>('select * from public.deletion_file_batch($1,$2)',[aliceId,token])).rows
 assert.ok(files.some(f=>f.name===`${aliceId}/ai/retained.txt`))
 assert.ok(files.every(f=>f.name.startsWith(`${aliceId}/`)))
 await asUser(bob,"insert into public.notes(title,content) values ('Other account','still works')")
})

test('deleting Auth cascades every application table and old tokens cannot access study data', async () => {
 // Mock storage service deletion of bytes completed; now exercise actual FK cascades.
 await db.query("delete from storage.objects where split_part(name,'/',1)=$1",[String(aliceId)])
 await db.query('delete from auth.users where id=$1',[alice])
 for (const table of ['users',...Object.keys(EXPORT_TABLES),'billing_customers','account_deletions','ai_jobs']) {
  const key=table==='users'?'id':'user_id'
  assert.equal((await db.query(`select * from public.${table} where ${key}=$1`,[aliceId])).rows.length,0,table)
 }
 assert.deepEqual(await asUser(alice,'select * from public.notes'),[])
 await assert.rejects(asUser(alice,"insert into public.notes(title,content) values ('Old token','blocked')"),/deletion is in progress|null value|row-level security/)
 assert.equal((await asUser(bob,"select * from public.notes where title='Other account'")).length,1)
 assert.equal((await asUser(bob,'select * from storage.objects')).length,1)
})
