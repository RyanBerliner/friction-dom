module.exports = function(config) {
  config.addCollection('demo', function(api) {
    return api.getFilteredByGlob('**/demos/*.html')
      .sort(({ fileSlug: a }, { fileSlug: b }) => {
        if (a === b) return 0;
        return a > b ? 1 : -1;
      });
  });

  config.addPassthroughCopy({
    'dist/umd/index.min.js': 'assets/lib/index.min.js',
    'dist/umd/index.min.js.map': 'assets/lib/index.min.js.map',
  });

  config.setUseGitIgnore(false);
  config.addWatchTarget('dist/**/*');

  return {
    pathPrefix: '/friction-dom/',
    dir: {
      input: 'src/docs',
      output: 'docs',
    }
  };
};
