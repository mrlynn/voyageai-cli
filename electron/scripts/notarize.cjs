const { notarize } = require('@electron/notarize');

module.exports = async function notarizing(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;
  console.log(`\n  Notarizing ${appPath}...`);
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: 'YZ36Z8GSEN',
  });
  console.log('  ✓ Done');
};
