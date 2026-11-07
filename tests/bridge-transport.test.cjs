const {test}=require('node:test');
const assert=require('node:assert/strict');

test('bridge accepts only the pinned sandbox within its own iframe',async()=>{
 const {createBridgeTransport}=await import('../src/bridgeTransport.js');
 let listener, sent;
 const outer={}; const remote={parent:{parent:outer},postMessage:(message,origin)=>{sent={message,origin};}};
 const host={setTimeout,clearTimeout,crypto:{randomUUID:()=> 'id-1'},addEventListener:(_,fn)=>listener=fn,removeEventListener:()=>{}};host.top=host;
 const frame={contentWindow:outer,credentialless:false,remove(){}};
 const doc={createElement:()=>frame,body:{appendChild(){}}};
 const origin='https://n-abc-0lu-script.googleusercontent.com';
 const request=createBridgeTransport({url:'https://script.google.com/macros/s/example/exec',sandboxOrigin:origin,hostWindow:host,hostDocument:doc,timeoutMs:1000});
 assert.equal(frame.credentialless,true);
 listener({origin:'https://evil.example',source:remote,data:{type:'vivo-ready'}});
 listener({origin,source:{parent:null},data:{type:'vivo-ready'}});
 listener({origin,source:remote,data:{type:'vivo-ready'}});
 const response=request({credential:'token',action:'identityStatus'});
 await Promise.resolve();
 assert.equal(sent.origin,origin);assert.equal(sent.message.token,'token');
 listener({origin,source:{parent:outer},data:{type:'vivo-response',id:'id-1',result:{ok:true,data:'spoof'}}});
 listener({origin,source:remote,data:{type:'vivo-response',id:'id-1',result:{ok:true,data:'verified'}}});
 assert.equal(await response,'verified');
 request.close();
});
