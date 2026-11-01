const packageJson = require('./package.json')

module.exports = {
  ...packageJson.build,
  extraResources: [
    {
      from: 'build/install-manager-companion',
      to: 'install-manager',
      filter: ['OverHead Install Manager.exe', 'publisher-policy.json'],
    },
  ],
}
