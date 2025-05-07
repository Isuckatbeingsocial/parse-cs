const path = require('path');

module.exports = {
  entry: './index.js', // your input script
  output: {
    filename: 'cs-parse.bundle.js', // output file
    path: path.resolve(__dirname, 'dist'), // output directory
    library: 'ParseCS', // name of the library (can be any global variable)
    libraryTarget: 'umd', // UMD format to support various environments
    umdNamedDefine: true, // optional: defines the UMD module with a named define
    globalObject: 'this', // ensures the library works in both Node.js and browser environments
  },
  mode: 'production', 
};
