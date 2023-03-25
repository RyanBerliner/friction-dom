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

const OUTPUT = 'dist/friction-dom';

export default {
  input: 'src/lib/index.js',
  output: [
    {...umdConfig, file: `${OUTPUT}.js`},
    {...esmConfig, file: `${OUTPUT}.esm.js`},
  ],
};