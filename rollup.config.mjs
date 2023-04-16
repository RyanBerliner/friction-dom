import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const config = {
  sourcemap: true,
};

const umdConfig = {
  ...config,
  name: 'FrictionDOM',
  format: 'umd',
};

const esmConfig = {
  ...config,
  format: 'esm',
};

export default {
  input: 'src/lib/index.ts',
  output: [
    {...umdConfig, file: 'dist/umd/index.js'},
    {...umdConfig, file: 'dist/umd/index.min.js', plugins: [terser()]},
    {...esmConfig, file: 'dist/esm/index.js'},
    {...esmConfig, file: 'dist/esm/index.min.js', plugins: [terser()]},
  ],
  plugins: [typescript()],
};