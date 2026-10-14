import test from 'node:test';
import assert from 'node:assert/strict';
import {bindGameVisibility} from '../dist/src/app-visibility.js';
function harness() {
  const doc=new EventTarget();doc.hidden=false;const target=new EventTarget(),changes=[];
  const hidden=bindGameVisibility(visible=>changes.push(visible),doc,target);
  const native=isActive=>{const event=new Event('tiny-legion-app-state');event.detail={isActive};target.dispatchEvent(event);};
  const web=value=>{doc.hidden=value;doc.dispatchEvent(new Event('visibilitychange'));};
  return {hidden,changes,native,web};
}
test('native background pauses even when the WebView document stays visible and resumes once',()=>{
  const h=harness();h.native(false);assert.equal(h.hidden(),true);h.native(false);h.native(true);
  assert.equal(h.hidden(),false);assert.deepEqual(h.changes,[false,true]);
});
test('native and document notifications settle and resume once regardless of order',()=>{
  for(const nativeFirst of [false,true]){
    const h=harness();if(nativeFirst){h.native(false);h.web(true);}else{h.web(true);h.native(false);}
    h.native(true);assert.equal(h.hidden(),true);h.web(false);assert.equal(h.hidden(),false);
    assert.deepEqual(h.changes,[false,true]);
  }
});
