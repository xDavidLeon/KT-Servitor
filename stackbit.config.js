const path = require('path');
const { defineStackbitConfig } = require('@stackbit/types');
const { GitContentSource } = require('@stackbit/cms-git');

module.exports = defineStackbitConfig({
  stackbitVersion: '~0.6.0',
  ssgName: 'nextjs',
  nodeVersion: '20',
  contentSources: [
    new GitContentSource({
      rootPath: __dirname,
      contentDirs: ['content/rules'],
      models: [
        {
          name: 'rulesTab',
          type: 'data',
          label: 'Rules Tab',
          labelField: 'title',
          filePath: 'content/rules/{slug}.md',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'slug', type: 'string', required: true },
            { name: 'order', type: 'number' },
            { name: 'body', type: 'markdown' }
          ]
        }
      ],
      assetsConfig: {
        referenceType: 'static',
        staticDir: 'public',
        uploadDir: path.posix.join('images', 'rules'),
        publicPath: '/'
      }
    })
  ]
});
