let GlobalPlugin;
const Parser = require('./parser');
const {CSLexer: Lexer}= require('./lexer');


class ParseCS {
    constructor() {
        GlobalPlugin = new (require('./plugin'))(this);
        this.plugin = GlobalPlugin;
    }
    parser(tokens) {
        const parser = new Parser(tokens);
        GlobalPlugin.applyToParser(parser);
        return parser;
    }
    lexer(code) {
        const lexer = new Lexer(code);
        GlobalPlugin.applyToLexer(lexer);
        return lexer;
    }
    parse(code) {
        const lexer = this.lexer(code);
        lexer.tokenize();
        const parser = this.parser(lexer.tokens);
        const result = parser.parseStatements();
        return {
            result,
            lexer,
            parser
        }
    }
    lex(code) {
        const lexer = this.lexer(code);
        lexer.tokenize();
        return {
            lexer,
            result: lexer.tokens
        }
    }
}
module.exports = ParseCS;