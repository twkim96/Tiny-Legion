mergeInto(LibraryManager.library, {
 TL_Hosted: function(){return globalThis.TINY_LEGION_SERVER===true?1:0;},
 TL_TestLogin: function(){return globalThis.TINY_LEGION_TEST_LOGIN===true?1:0;},
 TL_Session: function(){var value='';try{value=sessionStorage.getItem('tiny-legion.game-session')||'';}catch(_){}return stringToNewUTF8(value);},
 TL_StoreSession: function(ptr){try{sessionStorage.setItem('tiny-legion.game-session',UTF8ToString(ptr));}catch(_){}},
 TL_Download: function(name,text){var blob=new Blob([UTF8ToString(text)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=UTF8ToString(name);a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);},
 TL_Import: function(target){var receiver=UTF8ToString(target),input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=function(){var file=input.files[0];if(!file)return;if(file.size>1000000){SendMessage(receiver,'ImportFailure','저장 파일은 1MB까지 불러올 수 있습니다');return;}file.text().then(function(text){SendMessage(receiver,'ImportFromBrowser',text);}).catch(function(){SendMessage(receiver,'ImportFailure','저장 파일을 읽지 못했습니다');});};input.click();}
});
