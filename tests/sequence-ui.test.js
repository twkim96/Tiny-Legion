import test from 'node:test';
import assert from 'node:assert/strict';
import {moveSequenceItem, insertionIndex, bindSequenceDrag} from '../dist/src/sequence-ui.js';
const rects = Array.from({length:10}, (_, i) => ({left:i%5*100,right:i%5*100+90,top:Math.floor(i/5)*60,bottom:Math.floor(i/5)*60+50}));
function surface() {
  const events = {};
  const cards = rects.map((rect,index) => ({
    dataset:{sequenceSlot:String(index)}, style:{removeProperty(){}}, classList:{add(){},remove(){}},
    getBoundingClientRect:()=>rect, closest(selector){return selector==='button'?null:this;},
    setPointerCapture(){this.captured=true;},hasPointerCapture(){return this.captured;},releasePointerCapture(){this.captured=false;},
  }));
  const moves = [];
  const container = {querySelectorAll:()=>cards,addEventListener(type,handler){events[type]=handler;},getBoundingClientRect:()=>({left:0,right:500,top:0,bottom:110})};
  bindSequenceDrag(container,(from,to)=>moves.push([from,to]));
  const send = (type, extra={}) => events[type]({target:cards[0],button:0,pointerId:1,isPrimary:true,clientX:40,clientY:20,preventDefault(){},...extra});
  return {moves,send,cards};
}
test('moving between slots inserts and shifts instead of swapping, including empty and duplicate slots',()=>{
  const draft=['sheep','squirrel','rabbit',null,'sheep'];
  moveSequenceItem(draft,0,2);
  assert.deepEqual(draft,['squirrel','rabbit','sheep',null,'sheep']);
  moveSequenceItem(draft,4,0);
  assert.deepEqual(draft,['sheep','squirrel','rabbit','sheep',null]);
  moveSequenceItem(draft,4,1);
  assert.deepEqual(draft,['sheep',null,'squirrel','rabbit','sheep']);
  assert.equal(moveSequenceItem(draft,-1,2),false);
});
test('insertion boundaries cover both rows, their ends and movement in either direction',()=>{
  assert.deepEqual(insertionIndex(rects,0,210,20),{to:1,before:2});
  assert.deepEqual(insertionIndex(rects,0,499,90),{to:9,before:10});
  assert.deepEqual(insertionIndex(rects,8,0,20),{to:0,before:0});
  assert.deepEqual(insertionIndex(rects,8,110,80),{to:6,before:6});
});
for (const pointerType of ['mouse','touch']) test(`${pointerType} drag inserts only after a valid drop; cancellation and outside release preserve the draft`,()=>{
  const c=surface();
  c.send('pointerdown',{pointerType});c.send('pointermove',{clientX:210});
  assert.deepEqual(c.moves,[]);
  c.send('pointerup',{clientX:210});
  assert.deepEqual(c.moves,[[0,1]]);
  c.send('pointerdown',{pointerType});c.send('pointermove',{clientX:499,clientY:90});c.send('pointercancel');
  assert.equal(c.moves.length,1);
  c.send('pointerdown',{pointerType});c.send('pointermove',{clientX:499,clientY:90});c.send('pointerup',{clientX:600});
  assert.equal(c.moves.length,1);
  c.send('pointerdown',{target:{closest:()=>({})}});
  c.send('pointermove',{clientX:210});c.send('pointerup',{clientX:210});
  assert.equal(c.moves.length,1);
});
