# ParseCS

**ParseCS** is a C# parsing library written in pure JavaScript, featuring a basic plugin system. It requires no external dependencies beyond those used by Webpack.

* Roughly supports C# versions between **6.0 and 7.0**.
* **Note:** `for` loops are **not** currently supported.

---

## Installation Guide

1. Open a terminal.

2. Navigate to your project’s root directory:

   ```bash
   cd path/to/your/project
   ```

3. Install the package via npm:

   ```bash
   npm install @isuckatbeingsocial/parse-cs
   ```

4. Build the parser module:

   ```bash
   cd ./node_modules/@isuckatbeingsocial/parse-cs  
   npm install  
   npm run build  
   cd ../../../
   ```

5. Require ParseCS in your project:

   ```js
   const ParseCS = require('@isuckatbeingsocial/parse-cs');
   const parser = new ParseCS();
   ```

---

## Usage

### Parsing C# Code

```js
const result = parser.parse(`
public class MyClass
{
    public int myField;

    public void MyMethod()
    {
        // Parsed code goes here.
    }
}
`);

const ast = result.result;

// Alternatively, to access lexer and parser:
const { lexer, parser: innerParser, result: ast2 } = parser.parse('...');
```

---

## Writing Plugins

```js
const plugins = parser.plugin;

const MyParseCSPlugin = function() {
    return {
        extensions: {
            my_extension: {
                lex: (Lexer) => {
                    // Called for every new lexer using this plugin.
                    Lexer.tokenTypes.push({
                        ignore: true, // If true, the token is not added to the final token list.
                        regex: 'your-regex-here',
                        type: 'MY_TOKEN_TYPE'
                    });

                    // Register custom token type
                    Lexer.constructor.exports.TokenTypes.mytoken = 'MY_TOKEN_TYPE';
                },
                parse: (Parser, TokenTypes) => {
                    Parser.ParseMyToken = function() {
                        this.index(1); // Skip the token
                        return { type: 'MyTokenExpression', value: null };
                    };

                    Parser.expressionExtensions.push(function() {
                        const isMyToken = this.expect(TokenTypes.mytoken, undefined, {
                            throw: false,
                            errorMessage: null
                        });

                        return isMyToken ? Parser.ParseMyToken() : false;
                    });
                }
            }
        }
    };
};

// Register the plugin
plugins.instantiate(MyParseCSPlugin);
```

You can now parse code with your custom plugin logic enabled.

---

