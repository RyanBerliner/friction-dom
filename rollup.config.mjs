import typescript from '@rollup/plugin-typescript';

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
    {...umdConfig, file: `dist/umd/index.js`},
    {...esmConfig, file: `dist/esm/index.js`},
  ],
  plugins: [typescript()],
};