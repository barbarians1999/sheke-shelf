const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const dir=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(dir,'app.js'),'utf8');
function setup(){
 const handlers={}, events={}, focused=[];
 const nodes={};
 const document={activeElement:null,body:{classList:{remove(){}}},querySelector:s=>nodes[s]};
 function node(id){return nodes[id]={isConnected:true,hidden:false,value:'哲学',addEventListener:(e,f)=>handlers[id+':'+e]=f,focus(opts){document.activeElement=this;focused.push([id,opts]);},blur(){if(document.activeElement===this)document.activeElement=null;}}}
 const search=node('#book-search'), trigger=node('opener');
 ['#back-button','#previous-chapter','#next-chapter','#shelf-tools','.brand'].forEach(node);
 let filters=0;
 const context={document,search,activeBookTrigger:trigger,readerView:{hidden:false},shelfView:{hidden:true},history:{replaceState(){}},location:{pathname:'/'},setContentsCollapsed(){},setReaderControlsVisible(){},window:{addEventListener:(e,f)=>events[e]=f},showChapter(){},activeIndex:0,filterBooks(){filters++;}};
 const c=vm.createContext(context);
 vm.runInContext(code.slice(code.indexOf('document.querySelector("#back-button").addEventListener'),code.indexOf('loadBooks().catch')),c);
 vm.runInContext(code.slice(code.indexOf('search.addEventListener("input"'),code.indexOf('contentsToggle.addEventListener("click"')),c);
 return {context:c,handlers,events,search,trigger,document,focused,getFilters:()=>filters};
}
test('return to shelf repeatedly restores opener, not search, and keeps query',()=>{
 const s=setup();for(let i=0;i<5;i++){s.handlers['#back-button:click']();assert.equal(s.document.activeElement,s.trigger);assert.equal(s.context.readerView.hidden,true);assert.equal(s.context.shelfView.hidden,false);assert.equal(s.search.value,'哲学');}
 assert(s.focused.every(([id,opts])=>id==='opener'&&opts.preventScroll));
});
test('disconnected opener falls back to homepage link, never text input',()=>{
 const s=setup();s.trigger.isConnected=false;s.handlers['#back-button:click']();assert.equal(s.focused.at(-1)[0],'.brand');
});
test('navigation clears search editing focus without losing search query',()=>{
 const s=setup();s.search.focus();s.events.pagehide();assert.equal(s.document.activeElement,null);
 s.search.focus();s.events.pageshow({persisted:true});assert.equal(s.document.activeElement,null);assert.equal(s.search.value,'哲学');
});
test('ordinary load and active manual search are not blurred; input still filters',()=>{
 const s=setup();assert.equal(s.document.activeElement,null);
 s.search.focus();s.events.pageshow({persisted:false});assert.equal(s.document.activeElement,s.search);
 s.handlers['#book-search:input']();assert.equal(s.getFilters(),1);
 s.trigger.focus();s.events.pagehide();s.events.pageshow({persisted:true});assert.equal(s.document.activeElement,s.trigger);
});
test('search has no autofocus, stays keyboard reachable, and does not prohibit zoom',()=>{
 const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 const input=html.match(/<input id="book-search"[^>]*>/)[0];
 assert(!/autofocus|tabindex="-1"|disabled|readonly/.test(input));
 assert(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(html));
 const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
 assert.match(css,/\.tools input\s*\{[^}]*font-size: max\(1rem, 16px\)/);
 assert(!/search\.focus\(/.test(code));
 assert.match(code,/openBook\(book, button\)/);
 assert.match(code,/activeBookTrigger = trigger/);
});
