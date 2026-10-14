import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {binaryResponse} from '../server/static-response.js';
import {versionArtifactUrls} from '../scripts/unity/artifact-urls.mjs';
test('Unity wasm keeps binary bytes and streaming MIME with gzip/HEAD',async()=>{
 const bytes=Buffer.from([0,97,115,109,1,0,0,0]);const compressed=gzipSync(bytes);
 const file={body:compressed.toString('base64'),type:'application/wasm',binary:true,encoding:'gzip'};
 const response=binaryResponse(file,new Request('https://game.test/unity/Build/game.wasm'));
 assert.equal(response.headers.get('Content-Type'),'application/wasm');assert.equal(response.headers.get('Content-Encoding'),'gzip');
 assert.deepEqual(gunzipSync(Buffer.from(await response.arrayBuffer())),bytes);
 const head=binaryResponse(file,new Request('https://game.test/unity/Build/game.wasm',{method:'HEAD'}));
 assert.equal(Number(head.headers.get('Content-Length')),compressed.length);assert.equal((await head.arrayBuffer()).byteLength,0);
});
test('binary range clips end and rejects invalid offsets',async()=>{
 const file={body:Buffer.from('binary').toString('base64'),type:'application/octet-stream',binary:true};
 const response=binaryResponse(file,new Request('https://game.test/game.data',{headers:{Range:'bytes=2-99'}}));
 assert.equal(response.status,206);assert.equal(response.headers.get('Content-Range'),'bytes 2-5/6');assert.equal(await response.text(),'nary');
 assert.equal(binaryResponse(file,new Request('https://game.test/game.data',{headers:{Range:'bytes=8-9'}})).status,416);
});
test('Unity artifact revalidation returns no body and a changed build returns current bytes',async()=>{
 const file={body:Buffer.from('new build').toString('base64'),type:'application/octet-stream',binary:true,etag:'"new"',cache:'public, max-age=0, must-revalidate'};
 const cached=binaryResponse(file,new Request('https://game.test/game.data',{headers:{'If-None-Match':'"old", "new"'}}));
 assert.equal(cached.status,304);assert.equal((await cached.arrayBuffer()).byteLength,0);
 assert.equal(cached.headers.get('ETag'),'"new"');
 const changed=binaryResponse(file,new Request('https://game.test/game.data',{headers:{'If-None-Match':'"old"'}}));
 assert.equal(changed.status,200);assert.equal(await changed.text(),'new build');
 assert.match(changed.headers.get('Cache-Control'),/must-revalidate/);
});
test('a changed Unity build gets distinct browser cache URLs for all linked artifacts',()=>{
 const html='<script src="Build/game.loader.js"></script><script>const config={dataUrl:\'Build/game.data\',codeUrl:\'Build/game.wasm\',frameworkUrl:\'Build/game.framework.js\'};</script>';
 const hashes=Object.fromEntries(['game.loader.js','game.data','game.wasm','game.framework.js'].map(name=>['/unity/Build/'+name,'first']));
 const oldBuild=versionArtifactUrls(html,hashes);
 assert.equal((oldBuild.match(/\?v=first/g)||[]).length,4);
 hashes['/unity/Build/game.wasm']='second';
 const nextBuild=versionArtifactUrls(html,hashes);
 assert.match(nextBuild,/game\.wasm\?v=second/);assert.doesNotMatch(nextBuild,/game\.wasm\?v=first/);
 assert.match(nextBuild,/game\.data\?v=first/);
 assert.throws(()=>versionArtifactUrls(html,{}),/Missing Unity artifact/);
});
