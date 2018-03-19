const path = require('path')

module.exports = {
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: './main.js',
    libraryTarget: 'commonjs2',
    library: 'serverless-http-autoconf'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        }
      }
    ]
  }
}