using System;
using System.IO;
using System.Text;
using TinyLegion.Domain.Services;

static class SaveFileReadChecks
{
    public static void Run()
    {
        const string json="{\"version\":1,\"levels\":{},\"gold\":100,\"name\":\"동료\"}";
        using(var file=new MemoryStream(Encoding.UTF8.GetBytes("\uFEFF"+json)))
        {
            string read=SaveDocument.ReadUtf8(file);
            if(read!=json||(double)SaveDocument.Parse(read)["gold"]!=100)throw new Exception("Save UTF-8/BOM contents changed");
        }
        using(var file=new MemoryStream(new byte[]{0xff}))
        {
            try { SaveDocument.ReadUtf8(file);throw new Exception("Invalid UTF-8 import accepted"); }
            catch(ArgumentException error) { if(!error.Message.Contains("UTF-8"))throw; }
        }
        using(var file=new ReadProbe(true,3000000))
        {
            ExpectOversize(file);
            if(file.ReadBytes!=0)throw new Exception("Known oversized save was read before rejection");
        }
        using(var file=new ReadProbe(false,3000000))
        {
            ExpectOversize(file);
            if(file.ReadBytes>=file.TotalBytes)throw new Exception("Unseekable oversized save was fully consumed");
        }
        Console.WriteLine("Save file UTF-8/BOM validation and bounded stream reads passed");
    }
    static void ExpectOversize(Stream file)
    {
        try { SaveDocument.ReadUtf8(file);throw new Exception("Oversized save accepted"); }
        catch(ArgumentException error) { if(!error.Message.Contains("1MB"))throw; }
    }
    sealed class ReadProbe : Stream
    {
        readonly bool seekable;
        public long ReadBytes { get; private set; }
        public readonly long TotalBytes;
        public ReadProbe(bool seekable,long length){this.seekable=seekable;TotalBytes=length;}
        public override bool CanRead=>true;
        public override bool CanWrite=>false;
        public override bool CanSeek=>seekable;
        public override long Length=>seekable?TotalBytes:throw new NotSupportedException();
        public override long Position { get=>ReadBytes;set=>throw new NotSupportedException(); }
        public override int Read(byte[] buffer,int offset,int count)
        {int read=(int)Math.Min(count,TotalBytes-ReadBytes);Array.Clear(buffer,offset,read);ReadBytes+=read;return read;}
        public override void Flush(){}
        public override long Seek(long offset,SeekOrigin origin)=>throw new NotSupportedException();
        public override void SetLength(long value)=>throw new NotSupportedException();
        public override void Write(byte[] buffer,int offset,int count)=>throw new NotSupportedException();
    }
}
