// Binary response path shared by audio and Unity Web artifacts.
export function binaryResponse(file, request) {
 const bytes=Uint8Array.from(atob(file.body),char=>char.charCodeAt(0));
 const headers={'Content-Type':file.type,'Cache-Control':file.cache??'public, max-age=86400','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
 if(file.encoding)headers['Content-Encoding']=file.encoding;
 const range=request.headers.get('Range');
 if(range&&request.method==='GET') {
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  let start=match?.[1]?Number(match[1]):0,end=match?.[2]?Number(match[2]):bytes.length-1;
  if(match&&!match[1]&&match[2]){start=Math.max(0,bytes.length-Number(match[2]));end=bytes.length-1;}
  end=Math.min(end,bytes.length-1);
  if(!match||(!match[1]&&!match[2])||start>end||start>=bytes.length)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${bytes.length}`}});
  return new Response(bytes.slice(start,end+1),{status:206,headers:{...headers,'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${bytes.length}`}});
 }
 return new Response(request.method==='HEAD'?null:bytes,{headers:{...headers,'Content-Length':String(bytes.length)}});
}
