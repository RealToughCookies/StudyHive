import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const uid = 'aaaaaaaa-1234-4234-8234-aaaaaaaaaaaa'
let owner: number
async function user(sql: string, params: unknown[] = []) {
  await db.exec('set role authenticated')
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid])
    return (await db.query<any>(sql,params)).rows
  } finally { await db.exec('reset role') }
}
async function upload(name: string) {
  return user("insert into storage.objects(bucket_id,name) values ('study-files',$1)",[`${owner}/${name}`])
}
before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage,public to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
  `)
  for (const name of ['20260909000000_cloud_foundation','20260914000000_pro_services','20260916000000_account_deletion'])
    await db.exec(await readFile(`supabase/migrations/${name}.sql`,'utf8'))
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'storage@example.test',now())",[uid])
  owner=(await user('select id from public.users'))[0].id
  for(let i=0;i<27;i++) await upload(`existing-${i}.txt`)
  await db.exec(await readFile('supabase/migrations/20260922000000_storage_limits.sql','utf8'))
})
after(() => db.close())

test('migration inventories existing over-limit accounts without removing their files',async()=>{
  assert.deepEqual(await user('select * from public.my_file_usage()'),[{file_count:27,file_limit:25,max_file_bytes:10485760}])
  assert.equal((await user('select * from storage.objects')).length,27)
  await assert.rejects(upload('blocked.txt'),/file limit has been reached/)
})
test('deleting files releases capacity and attachments and AI paths share the same limit',async()=>{
  await user("delete from storage.objects where name like '%existing-0.txt' or name like '%existing-1.txt' or name like '%existing-2.txt'")
  await upload('ai/source.txt')
  await assert.rejects(upload('attachment.txt'),/file limit has been reached/)
  assert.equal((await user('select * from public.my_file_usage()'))[0].file_count,25)
})
test('failed bulk uploads and duplicate inserts roll back capacity increments',async()=>{
  await user("delete from storage.objects where name=$1",[`${owner}/ai/source.txt`])
  await assert.rejects(user("insert into storage.objects(bucket_id,name) values ('study-files',$1),('study-files',$2)",[`${owner}/batch1`,`${owner}/batch2`]),/file limit/)
  assert.equal((await user('select * from public.my_file_usage()'))[0].file_count,24)
  await assert.rejects(upload('existing-3.txt'),/unique/)
  assert.equal((await user('select * from public.my_file_usage()'))[0].file_count,24)
  await upload('last-slot.txt')
})
test('clients cannot forge usage, call the trigger or inspect another account usage',async()=>{
  await assert.rejects(user('update public.file_usage set file_count=0'),/permission denied/)
  await assert.rejects(user('select * from public.file_usage'),/permission denied/)
  await assert.rejects(user('select public.track_study_file_capacity()'),/permission denied/)
  await assert.rejects(user("insert into storage.objects(bucket_id,name) values('study-files','999999/forged.txt')"),/Invalid study file owner|deletion is in progress|row-level security/)
  await db.exec('set role anon')
  try { await assert.rejects(db.query('select * from public.my_file_usage()'),/permission denied/) }
  finally { await db.exec('reset role') }
})
test('active Pro capacity ends at 100 and expiry preserves files but blocks new uploads',async()=>{
  await db.query("update public.users set subscription_tier='premium',subscription_expires_at=now()+interval '1 day' where id=$1",[owner])
  for(let i=25;i<100;i++) await upload(`pro-${i}.txt`)
  await assert.rejects(upload('over-pro.txt'),/file limit/)
  await db.query("update public.users set subscription_expires_at=now()-interval '1 second' where id=$1",[owner])
  assert.deepEqual((await user('select * from public.my_file_usage()'))[0],{file_count:100,file_limit:25,max_file_bytes:10485760})
  assert.equal((await user('select * from storage.objects')).length,100)
  await assert.rejects(upload('expired.txt'),/file limit/)
})
test('metadata updates do not double count and privileged moves cannot escape quota accounting',async()=>{
  await db.query("update storage.objects set metadata='{}' where name=$1",[`${owner}/last-slot.txt`])
  assert.equal((await user('select * from public.my_file_usage()'))[0].file_count,100)
  await assert.rejects(db.query("update storage.objects set bucket_id='other' where name=$1",[`${owner}/last-slot.txt`]),/Moving files/)
  await db.query("insert into storage.objects(bucket_id,name) values('other','unrelated.txt')")
  assert.equal((await user('select * from public.my_file_usage()'))[0].file_count,100)
})
test('account deletion can remove over-limit files and cascades the private counter',async()=>{
  await db.query('select public.begin_account_deletion($1,$2)',[owner,'bbbbbbbb-1234-4234-8234-bbbbbbbbbbbb'])
  await assert.rejects(upload('late.txt'),/deletion is in progress/)
  // Simulate Storage API byte removal before Auth deletion, as production does.
  await db.query("delete from storage.objects where bucket_id='study-files'")
  assert.equal((await user('select * from public.my_file_usage()'))[0].file_count,0)
  await db.query('delete from auth.users where id=$1',[uid])
  assert.equal((await db.query('select * from public.file_usage')).rows.length,0)
  assert.deepEqual(await user('select * from public.my_file_usage()'),[])
})
