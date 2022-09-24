const path = require('path');
module.exports = {
  entry: {
    // fieldlines: "./src/fieldline_new.js",
    rvm: "./src/rvm.js",
    // ffe: "./src/ffe.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  mode: "production",
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 9000,
  },
};
