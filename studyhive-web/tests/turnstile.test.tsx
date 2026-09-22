import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { JSDOM } from 'jsdom'
import Turnstile from '../src/components/Auth/Turnstile'
let dom:JSDOM, root:ReturnType<typeof create>|undefined
beforeEach(()=>{
 dom=new JSDOM('<html><head></head><body></body></html>')
 Object.assign(globalThis,{window:dom.window,document:dom.window.document})
})
afterEach(()=>{act(()=>root?.unmount());root=undefined;dom.window.close()})
function mount(tokens:string[]){
 root=create(<Turnstile siteKey="test-site-key" onToken={token=>tokens.push(token)} />,{createNodeMock:()=>document.createElement('div')})
}
test('widget expiry and failure clear tokens; unmount removes widget and ignores late callbacks',async()=>{
 let callbacks:any,removed:string[]=[];const tokens:string[]=[]
 window.turnstile={render:(_el,options)=>{callbacks=options;return 'widget-id'},remove:id=>{removed.push(id)}}
 await act(async()=>mount(tokens))
 act(()=>callbacks.callback('valid'))
 assert.equal(tokens.at(-1),'valid')
 act(()=>callbacks['expired-callback']())
 assert.equal(tokens.at(-1),'')
 act(()=>callbacks.callback('new-valid'))
 act(()=>callbacks['error-callback']())
 assert.equal(tokens.at(-1),'')
 assert.ok(JSON.stringify(root!.toJSON()).includes('Verification failed'))
 act(()=>root!.unmount());root=undefined
 callbacks.callback('too-late')
 assert.equal(tokens.at(-1),'')
 assert.deepEqual(removed,['widget-id'])
})
test('script load failure leaves verification blocked and retry can load a fresh widget',async()=>{
 const tokens:string[]=[]
 await act(async()=>mount(tokens))
 const script=document.querySelector('script')!
 assert.equal(script.src,'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')
 await act(async()=>script.dispatchEvent(new dom.window.Event('error')))
 assert.equal(tokens.at(-1),'')
 assert.ok(JSON.stringify(root!.toJSON()).includes('Verification could not load'))
 let options:any
 window.turnstile={render:(_el,value)=>{options=value;return 'retry'},remove:()=>{}}
 await act(async()=>root!.root.findByType('button').props.onClick())
 act(()=>options.callback('retry-valid'))
 assert.equal(tokens.at(-1),'retry-valid')
})
