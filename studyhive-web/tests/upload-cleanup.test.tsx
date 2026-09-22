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
    create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
  `)
  for (const name of ['20260909000000_cloud_foundation','20260914000000_pro_services','20260916000000_account_deletion'])
    await db.exec(await readFile(`supabase/migrations/${name}.sql`,'utf8'))
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'storage@example.test',now())",[uid])
  owner=(await user('select id from public.users'))[0].id
  await db.exec(await readFile('supabase/migrations/20260922000000_storage_limits.sql','utf8'))
  await db.exec(await readFile('supabase/migrations/20260922010000_upload_cleanup.sql','utf8'))
})
after(() => db.close())


async function age(name: string) {
 await db.query("update storage.objects set created_at=now()-interval '2 days' where name=$1",[`${owner}/${name}`])
}
const claim=async()=> (await db.query<any>('select * from public.claim_unused_uploads($1)',[owner])).rows.map(r=>r.path)
test('cleanup selects only old unregistered objects in the verified workspace',async()=>{
 await upload('attached.txt');await age('attached.txt')
 await upload('abandoned.txt');await age('abandoned.txt')
 await upload('ai/abandoned.txt');await age('ai/abandoned.txt')
 await upload('recent.txt')
 const [note]=await user("insert into public.notes(title,content) values('Saved','Keep') returning id")
 await user("insert into public.note_attachments(note_id,filename,original_name,file_type,file_size) values($1,$2,'attached.txt','text/plain',10)",[note.id,`${owner}/attached.txt`])
 await db.query("insert into storage.objects(bucket_id,name,created_at) values('other','unrelated',now()-interval '3 days')")
 const other='bbbbbbbb-1234-4234-8234-bbbbbbbbbbbb'
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'other@example.test',now())",[other])
 const foreign=(await db.query<any>('select id from public.users where auth_user_id=$1',[other])).rows[0].id
 await db.query("insert into storage.objects(bucket_id,name,created_at) values('study-files',$1,now()-interval '3 days')",[`${foreign}/private.txt`])
 assert.deepEqual((await claim()).sort(),[`${owner}/abandoned.txt`,`${owner}/ai/abandoned.txt`].sort())
 assert.equal((await user('select * from public.my_file_usage()'))[0].file_count,4,'claim must not fake byte deletion or release quota')
})
test('clients cannot choose another owner, forge cleanup records or attach a claimed upload',async()=>{
 await assert.rejects(user('select * from public.claim_unused_uploads($1)',[owner]),/permission denied/)
 await assert.rejects(user('select * from public.upload_cleanup'),/permission denied/)
 const [note]=await user('select id from public.notes limit 1')
 await assert.rejects(user("insert into public.note_attachments(note_id,filename,original_name,file_type,file_size) values($1,$2,'lost.txt','text/plain',10)",[note.id,`${owner}/abandoned.txt`]),/being removed/)
 await assert.rejects(user("insert into public.note_attachments(note_id,filename,original_name,file_type,file_size) values($1,$2,'missing.txt','text/plain',10)",[note.id,`${owner}/missing.txt`]),/Upload this file/)
})
test('failed cleanup can retry, but retired paths cannot be reused after removal',async()=>{
 assert.equal((await claim()).length,2)
 // Production uses Storage.remove() for bytes; simulate successful metadata deletion.
 await user('delete from storage.objects where name=$1',[`${owner}/abandoned.txt`])
 assert.deepEqual(await claim(),[`${owner}/ai/abandoned.txt`])
 await assert.rejects(upload('abandoned.txt'),/retired/)
 await user('delete from storage.objects where name=$1',[`${owner}/ai/abandoned.txt`])
 assert.deepEqual(await claim(),[])
 assert.equal((await user('select * from public.my_file_usage()'))[0].file_count,2)
 await upload('new-name.txt')
})
test('cleanup batches are bounded and repeated batches eventually release all old orphan slots',async()=>{
 await db.query("update public.users set subscription_tier='premium',subscription_expires_at=now()+interval '1 day' where id=$1",[owner])
 for(let i=0;i<65;i++){await upload(`batch-${i}.txt`);await age(`batch-${i}.txt`)}
 const first=await claim();assert.equal(first.length,50)
 for(const path of first) await user('delete from storage.objects where name=$1',[path])
 const second=await claim();assert.equal(second.length,15)
 for(const path of second) await user('delete from storage.objects where name=$1',[path])
 assert.deepEqual(await claim(),[])
})
test('active AI jobs block cleanup and account deletion cascades cleanup receipts',async()=>{
 await db.query("insert into public.ai_jobs(id,user_id,fingerprint,kind) values($1,$2,'test','notes')",['cccccccc-1234-4234-8234-cccccccccccc',owner])
 await assert.rejects(claim(),/Wait for your AI generation/)
 await db.query("update public.ai_jobs set status='failed' where user_id=$1",[owner])
 assert.deepEqual(await claim(),[])
 await db.query("delete from storage.objects where bucket_id='study-files' and split_part(name,'/',1)=$1",[String(owner)])
 await db.query('delete from auth.users where id=$1',[uid])
 assert.equal((await db.query('select * from public.upload_cleanup')).rows.length,0)
})
