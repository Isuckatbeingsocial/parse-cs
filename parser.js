
/*
  TokenTypes: {
    str: 'STRING',
    num: 'NUMBER',
    id: 'IDENTIFIER',
    keyword: 'KEYWORD',
    sym: 'SYMBOL', // includes operators like +-/* etc
    chr: 'CHAR'
  }

*/
const { TokenTypes } = require('./lexer');

class CSParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
        this.errors = [];
        this.expressionExtensions = [];
    }
    clear() {
        this.tokens = [];
        this.pos = 0;
        this.errors = [];
    }
    next() {
        this.pos++;
        return this.tokens[this.pos];
    }
    index(num) {
        this.pos += num;
        return this.tokens[this.pos];
    }
    consume() {
        const t = this.tokens[this.pos];
        this.pos++;
        return t;
    }
    expect(type, value, opts) {
        const current = this.tokens[this.pos];
    
        const match = (
            type && value
                ? current?.type === type && current?.value === value
                : type
                    ? current?.type === type
                    : value
                        ? current?.value === value
                        : false
        );
    
        if (!match && opts?.throw) {
            const formattedMessage = opts.errorMessage
                .replace(/%POS/g, current?.position || 'UNKNOWN')
                .replace(/%TYPE/g, current?.type || 'NULL')
                .replace(/%VAL/g, current?.value || 'NULL');
    
            this.errors.push(formattedMessage);
        }
    
        return match;
    }
    
    curr() {
        return this.tokens[this.pos];
    }
    parseNum() {
        const token = this.curr();
        this.expect(TokenTypes.num);
    }
    parseArgs() {
        const args = [];
        this.expect(TokenTypes.sym, '(', {
            throw: true,
            errorMessage: 'Expected opening parenthesis for argument list at %POS, got %TYPE: %VAL.'
        });
        this.consume(); // skip '('

        while (this.curr() && this.curr().value !== ')') {
            const expr = this.parseExpression();
            if (!expr) break;
            args.push(expr);
            if (this.curr().value === ',') {
                this.consume(); // skip ','
            } else {
                break;
            }
        }

        this.expect(TokenTypes.sym, ')', {
            throw: true,
            errorMessage: 'Expected closing parenthesis for argument list at %POS, got %TYPE: %VAL.'
        });
        this.consume(); // skip ')'

        return args;
    }
    parseTypeList() {
        const types = [];

        while (this.curr()) {
            const typeNode = this.parseType();
            if (!typeNode) {
                this.errors.push(`Expected a type inside type list at ${this.curr()?.position || 'UNKNOWN'}, got ${this.curr()?.type || 'NULL'}: ${this.curr()?.value || 'NULL'}`);
                break;
            }
            types.push(typeNode);

            const curr = this.curr();
            if (curr?.value === ',') {
                this.consume(); // Skip comma and continue parsing more types
            } else {
                break; // No more comma, assume type list ends
            }
        }

        return types;
    }
    parseType() {
        let curr = this.curr();
        if (!curr) return null;

        const isKeyword = curr.type === 'KEYWORD';
        const type = isKeyword ? curr : this.parseExpression();
        if (type === curr) this.index(1); // Move forward if we just used curr directly

        const node = {
            type: 'TypeExpression',
            simple: isKeyword,
            name: type.value,
            generics: []
        };

        // Handle generic types like List<int>
        if (this.curr() && this.curr().value === '<') {
            this.index(1); // skip '<'
            node.generics = this.parseTypeList();
            this.expect(TokenTypes.sym, '>', {
                throw: true,
                errorMessage: 'Expected > to close type list at %POS got %TYPE: %VAL'
            });
        }

        return node;
    }
    parseClass() {
        console.log(this.curr(), this.tokens[this.pos + 1])
        if (!this.expect(TokenTypes.keyword, 'class', {
            throw: true,
            errorMessage: 'Expected "class" keyword at %POS, got %TYPE: %VAL'
        })) return null;
    
        this.consume(); // consume 'class'
    
        if (!this.expect(TokenTypes.id, undefined, {
            throw: true,
            errorMessage: 'Expected class name identifier at %POS, got %TYPE: %VAL'
        })) return null;
    
        const nameToken = this.consume(); // class name
    
        const classNode = {
            type: 'ClassDeclaration',
            name: nameToken.value,
            generics: [],
            baseTypes: [],
            body: []
        };
    
        // Parse optional generic type parameters: class MyClass<T, U>
        if (this.curr()?.value === '<') {
            this.consume(); // skip '<'
            while (this.curr() && this.curr().value !== '>') {
                if (!this.expect(TokenTypes.id, undefined, {
                    throw: true,
                    errorMessage: 'Expected identifier in generic parameter list at %POS, got %TYPE: %VAL'
                })) return null;
                const typeParam = this.consume().value;
                classNode.generics.push(typeParam);
    
                if (this.curr()?.value === ',') {
                    this.consume(); // skip comma
                } else {
                    break;
                }
            }
            this.expect(TokenTypes.sym, '>', {
                throw: true,
                errorMessage: 'Expected ">" to close generic parameter list at %POS, got %TYPE: %VAL'
            });
            this.consume(); // skip '>'
        }
    
        // Parse base class / interfaces: class MyClass : BaseClass, IInterface
        if (this.curr()?.value === ':') {
            this.consume(); // skip ':'
            while (this.curr()) {
                const baseType = this.parseType();
                if (!baseType) break;
                classNode.baseTypes.push(baseType);
    
                if (this.curr()?.value === ',') {
                    this.consume(); // skip comma
                } else {
                    break;
                }
            }
        }
    
        // Parse class body
        if (!this.expect(TokenTypes.sym, '{', {
            throw: true,
            errorMessage: 'Expected "{" to start class body at %POS, got %TYPE: %VAL'
        })) return null;
        this.consume(); // skip '{'
    
        while (this.curr() && this.curr().value !== '}') {
            const member = this.parseMember();
            if (member) {
                classNode.body.push(member);
            } else {
                this.index(1); // ensure forward progress on parse error
            }
        }
    
        this.expect(TokenTypes.sym, '}', {
            throw: true,
            errorMessage: 'Expected "}" to close class body at %POS, got %TYPE: %VAL'
        });
        this.consume(); // skip '}'
    
        return classNode;
    }
    
    parseMember() {
        const node = {
            type: 'ClassMember',
            modifiers: [],
            returnType: null,
            name: null,
            parameters: [],
            body: null,
            kind: 'unknown'
        };

        // Parse modifiers: public, private, static, etc.
        const modifierSet = new Set(['public', 'private', 'protected', 'internal', 'static', 'abstract', 'override', 'virtual', 'readonly', 'sealed', 'async']);
        while (this.curr()?.type === TokenTypes.keyword && modifierSet.has(this.curr().value)) {
            node.modifiers.push(this.curr().value);
            this.consume();
        }

        // Parse return type (e.g., int, void, List<T>)
        const returnType = this.parseType();
        if (!returnType) {
            this.errors.push(`Expected a valid return type for class/namespace member at ${this.curr()?.position || 'UNKNOWN'}`);
            return null;
        }
        node.returnType = returnType;

        // Parse member name (identifier)
        if (!this.expect(TokenTypes.id, undefined, {
            throw: true,
            errorMessage: `Expected identifier for class/namespace member name at %POS got %TYPE: %VAL`
        })) return null;

        const nameToken = this.consume();
        node.name = nameToken.value;

        // If it's a method (has parentheses)
        if (this.curr()?.value === '(') {
            node.kind = 'method';
            node.parameters = this.parseArgs();

            // Expect method body or semicolon (e.g., abstract/interface)
            if (this.curr()?.value === '{') {
                this.consume(); // consume '{'
                const nodes = [];
                let braceCount = 1;

                while (this.curr() && braceCount > 0) {
                    const tok = this.curr();
                    if (tok.value === '{') braceCount++;
                    else if (tok.value === '}') braceCount--;

                    if (braceCount > 0) {
                        const expr = this.parseExpression();
                        nodes.push(expr);
                        if (this.curr()?.value == ';') {
                            // skip ;s
                            this.index(1);
                        }
                        if (this.curr() === tok) this.index(1); // ensure forward progress
                    }
                }

                if (this.curr()?.value === '}') this.consume(); // consume closing brace

                node.body = {
                    type: 'BlockStatement',
                    nodes
                };
            } else if (this.curr()?.value === ';') {
                this.consume(); // semicolon for abstract/interface method
                node.body = null;
            } else {
                this.errors.push(`Expected '{' or ';' after method declaration at ${this.curr()?.position || 'UNKNOWN'}`);
                return null;
            }
        }
        // If it's a field (ends in semicolon)
        else if (this.curr()?.value === ';') {
            node.kind = 'field';
            this.consume();
        } else {
            this.errors.push(`Unexpected token after class/namespace member name at ${this.curr()?.position}: ${this.curr()?.type} "${this.curr()?.value}"`);
            return null;
        }

        return node;
    }


    parseIdentifier() {
        const token = this.curr();
        if (!this.expect(TokenTypes.id)) return;

        const Node = {
            type: "AccessExpression",
            target: token,
            body: []
        };
        this.index(1);

        while (true) {
            const currToken = this.curr();
            if (currToken?.value === '.') {
                this.index(1);
                const identifier = this.curr();
                this.expect(TokenTypes.id, undefined, {
                    throw: true,
                    errorMessage: 'Expected identifier after dot in access expression at %POS got %TYPE: %VAL.'
                });
                Node.body.push({ type: "DotAccess", property: identifier });
                this.index(1);
            } else if (currToken?.value === '[') {
                this.index(1); // Skip '['
                const expr = this.parseExpression();
                const node = { type: "BracketAccess", expression: expr };
                this.expect(TokenTypes.sym, ']', {
                    throw: true,
                    errorMessage: 'Expected closing bracket in access expression at %POS, got %TYPE: %VAL.'
                });
                this.index(1); // Skip ']'
                Node.body.push(node);
            } else if (currToken?.value === '(') {
                // Function call on base or access expression
                const args = this.parseArgs();
                Node.body.push({ type: "CallExpression", arguments: args }); // states the previous access should call the result given.
            } else {
                break;
            }
        }

        return Node;
    }
    parseUsing() {
        if (!this.expect(TokenTypes.keyword, 'using', {
            throw: true,
            errorMessage: 'Expected "using" keyword at %POS, got %TYPE: %VAL.'
        })) return null;
    
        this.consume(); // consume 'using'
    
        const usingNode = {
            type: 'UsingExpression',
            alias: null,
            static: false,
            target: null
        };
    
        // Handle "static" keyword
        if (this.curr()?.value === 'static') {
            usingNode.static = true;
            this.consume();
        }
    
        // Handle alias assignment: using Foo = System.IO.File;
        if (this.curr()?.type === TokenTypes.id && this.tokens[this.pos + 1]?.value === '=') {
            usingNode.alias = this.consume().value; // alias name
            this.consume(); // skip '='
        }
    
        // Parse target (namespace or type)
        const target = this.parseIdentifier();
        if (!target) {
            this.errors.push(`Expected namespace or type target in using directive at ${this.curr()?.position || 'UNKNOWN'}`);
            return null;
        }
    
        usingNode.target = target;
    
        this.expect(TokenTypes.sym, ';', {
            throw: true,
            errorMessage: 'Expected ";" after using directive at %POS, got %TYPE: %VAL.'
        });
        this.consume(); // skip ';'
    
        return usingNode;
    }
    parseNamespace() {
        if (!this.expect(TokenTypes.keyword, 'namespace', {
            throw: true,
            errorMessage: 'Expected "namespace" keyword at %POS, got %TYPE: %VAL'
        })) return null;
    
        this.consume(); 
    
        const node = {
            type: 'NamespaceDeclaration',
            name: this.parseIdentifier(), 
            body: []
        };
    
        // Check for optional semicolon after a single-line namespace (e.g., "namespace namespace.test;")
        if (this.curr()?.value === ';') {
            this.consume(); // consume ';'
            return node;
        }
    
        this.expect(TokenTypes.sym, '{', {
            throw: true,
            errorMessage: 'Expected "{" to start namespace body at %POS, got %TYPE: %VAL'
        });
        this.consume(); 
    
        // Parse everything inside the namespace body (e.g., using statements, classes, etc.)
        while (this.curr() && this.curr().value !== '}') {
            const nextToken = this.curr();
            let decl = null;
    
            decl = this.parseMember();
    
            if (decl) node.body.push(decl);
        }
    
        this.expect(TokenTypes.sym, '}', {
            throw: true,
            errorMessage: 'Expected "}" to close namespace body at %POS, got %TYPE: %VAL'
        });
        this.consume(); 
    
        return node;
    }
    parseAssignment() {
        const left = this.parseExpression(0); // Left-hand side of the assignment
    
        // Check if the next token is an assignment operator (e.g., '=' or ':=')
        const token = this.curr();
        if (token && token.type === TokenTypes.sym && (token.value === '=' || token.value === ':=')) {
            this.consume(); // consume the assignment operator
    
            const right = this.parseExpression(0); // Right-hand side of the assignment
            return {
                type: 'AssignmentExpression',
                operator: token.value,
                left,
                right
            };
        }
    
        return left; // If it's not an assignment, just return the left-hand side expression
    }
    parseTemplateLit() {
        if (!this.expect(TokenTypes.templatestr)) return;
    
        const Node = {
            type: 'TemplateLiteralExpression',
            template: null,
            replacees: []
        };
    
        const literal = this.curr().value; // e.g., $"a b c {d}"
        const replacees = [];
    
        // Match all contents inside {curly braces}, including the braces
        const regex = /\{[^}]*\}/g;
        let match;
        while ((match = regex.exec(literal)) !== null) {
            replacees.push(match[0]); // match[0] includes the curly braces
        }
    
        Node.template = literal;
        Node.replacees = replacees;
        return Node;
    }    
    
    parseExpression(minPrecedence = 0) {
        let token = this.curr();

        // --- Prefix unary operators ---
        const unaryOperators = ['-', '+', '!', '~', '++', '--'];
        let left;
        if (token && token.type === TokenTypes.sym && unaryOperators.includes(token.value)) {
            const operator = token.value;
            this.consume();
            const argument = this.parseExpression(this.getUnaryPrecedence(operator));
            left = {
                type: 'UnaryExpression',
                operator,
                argument,
                prefix: true
            };
        } else {
            // --- Primary expressions ---
            if (token.type === TokenTypes.num || token.type === TokenTypes.str || token.type === TokenTypes.chr) {
                left = { type: token.type, value: token.value };
                this.consume();
            } else if (token.type === TokenTypes.id) {
                left = this.parseIdentifier();
                while (true) {
                    token = this.curr();
                    if (token && token.type === TokenTypes.sym && (token.value === '++' || token.value === '--')) {
                        const operator = token.value;
                        this.consume();
                        left = {
                            type: 'UnaryExpression',
                            operator,
                            argument: left,
                            prefix: false
                        };
                    } else {
                        break;
                    }
                }
                if (this.curr()?.value == '=') {
                    this.index(1);
                    const id = left;
                    left = {
                        type: 'AssignmentExpression',
                        left: id,
                        right: this.parseExpression()
                    }
                }
                this.consume();
            } else if (token.type === TokenTypes.sym && token.value === '(') {
                this.consume();
                left = this.parseExpression();
                this.expect(TokenTypes.sym, ')', {
                    throw: true,
                    errorMessage: 'Expected closing parenthesis at %POS, found %TYPE: %VAL'
                });
                this.consume();
            } else if (this.expect(TokenTypes.keyword, 'class')) {
                left = this.parseClass();
            } else if (this.expect(TokenTypes.keyword, 'using') ) {
                left = this.parseUsing();
            } else if (this.expect(TokenTypes.keyword, 'namespace') ) {
                left = this.parseNamespace();
            } else if (this.expect(TokenTypes.templatestr)) {
                left = this.parseTemplateLit();
            } else if (this.expect(TokenTypes.keyword, 'if')) {
                left = this.parseIf();
            } else if (this.expect(TokenTypes.keyword, 'while')) {
                left = this.parseWhile();
            } else {
                let didMatch = false;
                for (let expressionExtension of this.expressionExtensions) {
                    const result = expressionExtension.apply(this);
                    if (result) didMatch = true;
                    left = result; // assuming it returns a valid node.
                }
                if (!didMatch) {
                    this.errors.push(`Unexpected token at ${token.position}: ${token.type} "${token.value}"`);
                    return null;
                }
            }
        }

        // --- Binary operator loop ---
        while (true) {
            const next = this.curr();

            if (next && next.type === TokenTypes.sym && this.getPrecedence(next.value) >= minPrecedence) {
                const op = next.value;
                const precedence = this.getPrecedence(op);
                this.consume();
                let right = this.parseExpression(precedence + 1);
                left = {
                    type: 'BinaryExpression',
                    operator: op,
                    left,
                    right
                };
            } else {
                break;
            }
        }

        return left;
    }
    parseBlock(endChar) {
        console.log("Block started!");
        const Node = {
            type: 'BlockStatement',
            body: []
        }
        while (this.pos < this.tokens.length) {
            console.log(this.curr());
            Node.body.push(this.parseExpression());
            console.log(this.curr());
            if (this.curr()?.value == ';') {
                // skip ;s
                this.index(1);
            }
            if (this.curr()?.value == endChar) {
                break;
            }
        }
        return Node;
    }
    parseIf() {
        if (!this.expect(TokenTypes.keyword, 'if', {
            throw: true,
            errorMessage: 'Expected "if" keyword at %POS, got %TYPE: %VAL.'
        })) return null;
    
        this.consume(); // consume 'if'
    
        this.expect(TokenTypes.sym, '(', {
            throw: true,
            errorMessage: 'Expected "(" after "if" at %POS, got %TYPE: %VAL.'
        });
        this.consume(); // consume '('
    
        const condition = this.parseExpression();
    
        this.expect(TokenTypes.sym, ')', {
            throw: true,
            errorMessage: 'Expected ")" after if condition at %POS, got %TYPE: %VAL.'
        });
        this.consume(); // consume ')'
        this.expect(TokenTypes.sym, '{', {
            throw: true,
            errorMessage: 'Expected "{" to start statement body at %POS, got %TYPE: %VAL'
        })
        this.index(1);
        const consequent = this.parseBlock('}');
        this.index(1);
        const ifNode = {
            type: 'IfStatement',
            condition,
            consequent,
            alternate: null
        };
    
        let current = ifNode;
    
        // Parse else-if and else branches
        while (this.curr()?.type === TokenTypes.keyword && this.curr().value === 'else') {
            console.log(this.curr());
            this.consume(); // consume 'else'
    
            if (this.curr()?.type === TokenTypes.keyword && this.curr().value === 'if') {
                this.consume(); // consume 'if'
    
                this.expect(TokenTypes.sym, '(', {
                    throw: true,
                    errorMessage: 'Expected "(" after "else if" at %POS, got %TYPE: %VAL.'
                });
                this.consume(); // consume '('
    
                const elseIfCondition = this.parseExpression();
    
                this.expect(TokenTypes.sym, ')', {
                    throw: true,
                    errorMessage: 'Expected ")" after else-if condition at %POS, got %TYPE: %VAL.'
                });
                this.consume(); // consume ')'
                this.expect(TokenTypes.sym, '{', {
                    throw: true,
                    errorMessage: 'Expected "{" to start statement body at %POS, got %TYPE: %VAL'
                })
                const elseIfBlock = this.parseBlock('}');
                this.index(1);
                const elseIfNode = {
                    type: 'IfStatement',
                    condition: elseIfCondition,
                    consequent: elseIfBlock,
                    alternate: null
                };
                current.alternate = elseIfNode;
                current = elseIfNode;
            } else {
                // Just "else"
                this.expect(TokenTypes.sym, '{', {
                    throw: true,
                    errorMessage: 'Expected "{" to start statement body at %POS, got %TYPE: %VAL'
                })
                const elseBlock = this.parseBlock('}');
                this.index(1);
                current.alternate = {
                    type: 'ElseStatement',
                    body: elseBlock
                };
                break;
            }
        }
    
        return ifNode;
    }

    parseWhile() {
        if (!this.expect(TokenTypes.keyword, 'while', {
            throw: true,
            errorMessage: 'Expected "while" keyword at %POS, got %TYPE: %VAL.'
        })) return null;
        this.consume(); // consume 'while'
    
        this.expect(TokenTypes.sym, '(', {
            throw: true,
            errorMessage: 'Expected "(" after "while" at %POS, got %TYPE: %VAL.'
        });
        this.consume(); // consume '('
    
        const condition = this.parseExpression();
    
        this.expect(TokenTypes.sym, ')', {
            throw: true,
            errorMessage: 'Expected ")" after while condition at %POS, got %TYPE: %VAL.'
        });
        this.consume(); // consume ')'
        this.expect(TokenTypes.sym, '{', {
            throw: true,
            errorMessage: 'Expected "{" to start statement body at %POS, got %TYPE: %VAL'
        })
        this.index(1);
        const consequent = this.parseBlock('}');
        this.index(1);
        const Node = {
            type: 'WhileStatement',
            condition,
            consequent
        }
        return Node;
    }

    parseStatements() {
        const Node = {
            type: 'ProgramNode',
            body: []
        }
        while (this.pos < this.tokens.length) {
            Node.body.push(this.parseExpression());
            console.log(this.curr());
            if (this.curr()?.value == ';') {
                // skip ;s
                this.index(1);
            }
        }
        return Node;
    }

    getPrecedence(op) {
        const precedences = {
            '||': 1,
            '&&': 2, 
            '=': 3,
            '==': 3, '!=': 3,
            '<': 4, '<=': 4, '>': 4, '>=': 4,
            '+': 5, '-': 5,
            '*': 6, '/': 6, '%': 6,
        };
        return precedences[op] || -1;
    }
    getUnaryPrecedence(op) {
        const unaryPrecedences = {
            '++': 7, '--': 7,
            '+': 7, '-': 7,
            '!': 7,
            '~': 7
        };
        return unaryPrecedences[op] || -1;
    }

}

module.exports = CSParser;