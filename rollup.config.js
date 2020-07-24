import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import { eslint } from 'rollup-plugin-eslint'
import babel from '@rollup/plugin-babel'
import replace from 'rollup-plugin-replace'
import { uglify } from 'rollup-plugin-uglify'

const packages = require('./package.json')

const ENV = process.env.NODE_ENV

const paths = {
  input: {
    root: ENV === 'example'
      ? 'example/index.js'
      : 'src/index.js'
  },
  output: {
    root: ENV === 'example'
      ? 'example/dist/'
      : 'dist/'
  }
}

const fileNames = {
  development: `${packages.name}.js`,
  example: 'example.js',
  production: `${packages.name}.min.js`
}

const fileName = fileNames[ENV]

const config = {
  input: './src/oneSocket.js',
  output: {
    file: `output/${fileName}`,
    format: 'umd',
    name: 'OneSocket'
  },
  plugins: [
    resolve(),
    commonjs(),
    eslint({
      include: ['src/**'],
      exclude: ['node_modules/**']
    }),
    babel({
      babelHelpers: 'bundled',
      presets: ['@babel/preset-env'],
      exclude: 'node_modules/**'
    }),
    replace({
      exclude: 'node_modules/**',
      ENV: JSON.stringify(process.env.NODE_ENV)
    }),
    (ENV === 'production' && uglify())
  ]
}

export default config
