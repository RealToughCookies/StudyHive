import { cleanUnusedUploads } from './upload-cleanup.ts';
const assert=(value:unknown)=>{if(!value)throw Error('Assertion failed')};
Deno.test('cleanup fails closed for foreign, malformed or oversized batches and preserves errors for retry',async()=>{
 for(const rows of [[{path:'8/private.txt'}],[{path:'7/../secret'}],[{}],null,Array.from({length:51},(_,i)=>({path:`7/${i}`}))]){
  let removed=false;
  const db={rpc:async()=>({data:rows,error:null}),storage:{from:()=>({remove:()=>{removed=true}})}};
  let failed=false;try{await cleanUnusedUploads(db,7)}catch{failed=true}
  assert(failed && !removed);
 }
 const empty={rpc:async()=>({data:[],error:null})};
 assert((await cleanUnusedUploads(empty,7)).removed===0);
});
