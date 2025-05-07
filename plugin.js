const {TokenTypes} = require('./lexer');

class Plugin {
    constructor(target) {
        this.target = target;
        this.plugins = [];
    }
    instantiate(plugin) {
        this.plugins.push(plugin(this.target)); /*
            {
                extensions: {
                    "my_extension": {
                        lex: (Lexer) => {
                            // called on each lexer made thats using your plugin.
                            Lexer.tokenTypes.push({
                                ignore: true, // wether or not its added to the token list, true means it isnt false means it is.
                                regex: 'regex that matches it would go here, but idk much regex so.'
                                type: 'MY_TOKEN_TYPE'
                            });
                            Lexer.constructor.exports.TokenTypes.mytoken = 'MY_TOKEN_TYPE'; // add it to the TokenTypes parser util
                        },
                        parse: (Parser, TokenTypes) => { // second arg is TokenTypes parser util, which can be aliases for your token types.
                            Parser.ParseMyToken = function() {
                                // implement, for now this will just skip it.
                                index(1);
                                return {type: 'MyTokenExpression', value: null};
                            }
                            Parser.expressionExtensions.push(function() { // the "this" context is set to the parser.
                                const isMyToken = this.expect(TokenTypes.mytoken, undefined, {
                                    throw: false, // we are just using this expect call to check wether to parse it as our token
                                    errorMessage: null
                                })
                                return isMyToken ? Parser.ParseMyToken() : false; // returning a truthy/defined value makes the parser stop checking, return false if it isnt the token the extension checks for.
                            })
                        }
                    }
                }
            }
        */
    }
    applyToLexer(lexer) {
        for (const plugin of this.plugins) {
            for (const ext in plugin.extensions) {
                plugin.extensions[ext].lex?.(lexer);
            }
        }
    }
    
    applyToParser(parser) {
        for (const plugin of this.plugins) {
            for (const ext in plugin.extensions) {
                plugin.extensions[ext].parse?.(parser, TokenTypes);
            }
        }
    }
    
}
module.exports = Plugin;