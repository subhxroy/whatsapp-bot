function readPackage(pkg, context) {
  if (pkg.dependencies && pkg.dependencies['@whiskeysockets/eslint-config']) {
    delete pkg.dependencies['@whiskeysockets/eslint-config'];
  }
  if (pkg.devDependencies && pkg.devDependencies['@whiskeysockets/eslint-config']) {
    delete pkg.devDependencies['@whiskeysockets/eslint-config'];
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
