import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { deleteAccount } from '../src/services/accountDeletion'
import { useStore } from '../src/store'
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>')
Object.assign(globalThis, { window: dom.window, document: dom.window.document })
const user={id:7,username:'Test',email:'alice@example.test',subscription_tier:'free'}
afterEach(()=>useStore.getState().logout())
function fixture() {
 useStore.getState().setUser(user as any)
 const calls:any[]=[]
 let wrongPassword=false, hook=()=>{}, result:any={deleted:true}, verifiedId='alice', ownerId='alice'
 const client:any={
  auth:{getUser:async()=>({data:{user:{id:'alice',email:user.email,email_confirmed_at:'2026-01-01'}}}),signOut:async(options:any)=>{calls.push(['signOut',options]);return {error:null}}},
  from:()=>{const query:any={select:()=>query,eq:()=>query,single:async()=>({data:{auth_user_id:ownerId}})};return query},
  functions:{invoke:async(name:string,options:any)=>{calls.push([name,options]);return {data:result,error:null}}},
 }
 const temporary:any={auth:{signInWithPassword:async(credentials:any)=>{assert.equal(credentials.email,user.email);hook();return wrongPassword?{error:{message:'bad'}}:{data:{user:{id:verifiedId},session:{access_token:'fresh-password-token'}}}},signOut:async()=>{calls.push(['temporarySignOut']);return {error:null}}}}
 return {client,temporary,calls,setWrong:()=>wrongPassword=true,setHook:(value:()=>void)=>hook=value,setResult:(value:any)=>result=value,setIdentity:(value:string)=>verifiedId=value,setOwner:(value:string)=>ownerId=value}
}
test('deletion uses an isolated password session and never sends password or owner ID to the function',async()=>{
 const f=fixture()
 await deleteAccount('private-password','DELETE',f.client,()=>f.temporary)
 const call=f.calls.find(c=>c[0]==='delete-account')
 assert.deepEqual(call[1],{body:{action:'delete',confirmation:'DELETE'},headers:{Authorization:'Bearer fresh-password-token'}})
 assert.equal(JSON.stringify(f.calls).includes('private-password'),false)
 assert.equal(useStore.getState().currentUser,null)
 assert.ok(f.calls.some(c=>c[0]==='temporarySignOut'))
})
test('wrong password, mismatched identity and account changes cannot dispatch deletion',async()=>{
 for(const mutate of [(f:any)=>f.setWrong(),(f:any)=>f.setIdentity('bob'),(f:any)=>f.setOwner('bob'),(f:any)=>f.setHook(()=>{useStore.getState().setUser(null);useStore.getState().setUser(user as any)})]) {
  const f=fixture();mutate(f)
  await assert.rejects(deleteAccount('password','DELETE',f.client,()=>f.temporary),/verification failed|account changed/)
  assert.ok(!f.calls.some(c=>c[0]==='delete-account'))
 }
})
test('a partial deletion keeps the main session available for retry and reports incomplete cleanup',async()=>{
 const f=fixture();f.setResult({pending:true,message:'Some files remain. Retry deletion.'})
 await assert.rejects(deleteAccount('password','DELETE',f.client,()=>f.temporary),/Some files remain/)
 assert.equal(useStore.getState().currentUser?.id,7)
 assert.ok(!f.calls.some(c=>c[0]==='signOut'))
 assert.ok(f.calls.some(c=>c[0]==='temporarySignOut'))
})
test('typed confirmation is required before requesting password verification',async()=>{
 const f=fixture()
 await assert.rejects(deleteAccount('password','delete',f.client,()=>{throw new Error('must not run')}),/type DELETE/)
 assert.deepEqual(f.calls,[])
})
