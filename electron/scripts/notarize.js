const { notarize } = require('@electron/notarize');

module.exports = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`\n  Notarizing ${appName} at ${appPath}...`);

  await notarize({
    appPath,
    keychainProfile: 'VAI_NOTARIZE',
  });

  console.log(`  ✓ Notarization complete`);
};
