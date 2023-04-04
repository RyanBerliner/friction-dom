module.exports = function(config) {
  config.addCollection('demo', function(api) {
    return api.getFilteredByGlob('**/demos/*.html')
      .sort(({ fileSlug: a }, { fileSlug: b }) => {
        if (a === b) return 0;
        return a > b ? 1 : -1;
      });
  });

  config.addPassthroughCopy({'dist/umd/index.js': 'assets/lib/index.js'});

  config.setUseGitIgnore(false);
  config.addWatchTarget('dist/**/*');

  return {
    dir: {
      input: 'src/docs',
      output: 'docs',
    }
  };
};