// lexer.js

class CSLexer {
    constructor(code) {
      this.code = code;
      this.tokens = [];
      this.position = 0;
  
      // Define regex for each token type
      this.tokenTypes = [
        { type: 'WHITESPACE', regex: /^\s+/, ignore: true },
        { type: 'COMMENT_SINGLE', regex: /^\/\/.*/, ignore: true },
        { type: 'COMMENT_MULTI', regex: /^\/\*[\s\S]*?\*\//, ignore: true },
      
        // Interpolated strings must come before STRING to avoid incorrect matching
        { type: 'INTERPOLATED_STR', regex: /^\$"(?:\\.|[^"\\]|{[^}]*})*"/ },
      
        { type: 'KEYWORD', regex: /^(class|public|virtual|readonly|sealed|abstract|private|protected|static|void|float|int|string|if|else|for|while|return|new|using|namespace|var|bool|true|false|this|base|override|using|namespace)\b/ },
        { type: 'IDENTIFIER', regex: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
        { type: 'NUMBER', regex: /^\d+(\.\d+)?/ },
        { type: 'STRING', regex: /^"(?:\\.|[^"\\])*"/ },
        { type: 'CHAR', regex: /^'(?:\\.|[^'\\])'/ },
        { type: 'SYMBOL', regex: /^(?:\+\+|--|[{}()[\].,;:+\-*/%&|^!<>=~?])/ },
      ];
      
    }
    static exports = {
      TokenTypes: {
        str: 'STRING',
        num: 'NUMBER',
        id: 'IDENTIFIER',
        keyword: 'KEYWORD',
        sym: 'SYMBOL',
        chr: 'CHAR',
        templatestr: 'INTERPOLATED_STR'
      }
    }
    tokenize() {
      while (this.position < this.code.length) {
        const slice = this.code.slice(this.position);
        let matched = false;
  
        for (const { type, regex, ignore } of this.tokenTypes) {
          const match = regex.exec(slice);
          if (match) {
            matched = true;
            if (!ignore) {
              this.tokens.push({ type, value: match[0], position: this.position});
            }
            this.position += match[0].length;
            break;
          }
        }
  
        if (!matched) {
          throw new Error(`Unexpected token at position ${this.position}: "${this.code[this.position]}"`);
        }
      }
  
      return this.tokens;
    }
  }
module.exports = {
  CSLexer,
  TokenTypes: CSLexer.exports.TokenTypes
}