const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  mode: 'production',
  target: 'node',
  entry: './dist/cli.js',
  output: {
    filename: 'mcp-host-bundle.js',
    path: path.resolve(__dirname, 'bundle'),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@babel/preset-env', { targets: { node: '18' } }]]
          }
        }
      }
    ]
  },
  externals: [
    // 保留一些必要的外部依赖，避免打包过大
    nodeExternals({
      allowlist: [
        '@modelcontextprotocol/sdk',
        '@modelcontextprotocol/sdk/client/index.js',
        '@modelcontextprotocol/sdk/client/stdio.js',
        '@modelcontextprotocol/sdk/server/index.js',
        '@modelcontextprotocol/sdk/server/stdio.js',
        '@modelcontextprotocol/sdk/types.js',
        'axios',
        'dotenv',
        'zod'
      ]
    })
  ],
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      // 处理 .js 扩展名的导入
      '@modelcontextprotocol/sdk/client/index.js': '@modelcontextprotocol/sdk/client/index',
      '@modelcontextprotocol/sdk/client/stdio.js': '@modelcontextprotocol/sdk/client/stdio',
      '@modelcontextprotocol/sdk/server/index.js': '@modelcontextprotocol/sdk/server/index',
      '@modelcontextprotocol/sdk/server/stdio.js': '@modelcontextprotocol/sdk/server/stdio',
      '@modelcontextprotocol/sdk/types.js': '@modelcontextprotocol/sdk/types'
    }
  },
  optimization: {
    minimize: true
  },
  node: {
    __dirname: false,
    __filename: false
  }
}; 