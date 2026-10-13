using System;

namespace TinyLegion.Domain.Account
{
    public sealed class RuleException : Exception
    {
        public string Code { get; }

        public RuleException(string code) : base(code)
        {
            Code = code;
        }
    }
}
