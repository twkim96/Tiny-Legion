// Binary response path shared by audio and Unity Web artifacts.
export function binaryResponse(file, request) {
 const headers={'Content-Type':file.type,'Cache-Control':file.cache??'public, max-age=86400','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
 // Workers otherwise gzip a body that we already compressed at build time.
 const encodeBody=file.encoding?'manual':'automatic';
 if(file.encoding)headers['Content-Encoding']=file.encoding;
 if(file.etag) {
  headers.ETag=file.etag;
  if(['GET','HEAD'].includes(request.method)&&request.headers.get('If-None-Match')?.split(',').some(tag=>tag.trim()===file.etag||tag.trim()==='*'))return new Response(null,{status:304,headers,encodeBody});
 }
 const length=file.body.length/4*3-(file.body.endsWith('==')?2:file.body.endsWith('=')?1:0);
 if(request.method==='HEAD')return new Response(null,{headers:{...headers,'Content-Length':String(length)},encodeBody});
 // Index the decoded string directly: Uint8Array.from(string, mapper) can
 // materialize a huge intermediate iterable array for Unity's binary files.
 const decoded=atob(file.body),bytes=new Uint8Array(decoded.length);
 for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
 const range=request.headers.get('Range');
 if(range&&request.method==='GET') {
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  let start=match?.[1]?Number(match[1]):0,end=match?.[2]?Number(match[2]):bytes.length-1;
  if(match&&!match[1]&&match[2]){start=Math.max(0,bytes.length-Number(match[2]));end=bytes.length-1;}
  end=Math.min(end,bytes.length-1);
  if(!match||(!match[1]&&!match[2])||start>end||start>=bytes.length)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${bytes.length}`},encodeBody});
  return new Response(bytes.slice(start,end+1),{status:206,headers:{...headers,'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${bytes.length}`},encodeBody});
 }
 return new Response(bytes,{headers:{...headers,'Content-Length':String(bytes.length)},encodeBody});
}
