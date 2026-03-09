const { notarize } = require('@electron/notarize');

module.exports = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  // CI path: env vars injected by GitHub Actions workflow
  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (APPLE_ID && APPLE_APP_SPECIFIC_PASSWORD && APPLE_TEAM_ID) {
    console.log(`\n  Notarizing ${appName} via Apple ID credentials (CI)...`);
    await notarize({
      appPath,
      appleId: APPLE_ID,
      appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
      teamId: APPLE_TEAM_ID,
    });
    console.log(`  ✓ Notarization complete`);
    return;
  }

  // Local path: stored keychain profile
  const profile = process.env.APPLE_KEYCHAIN_PROFILE || 'VAI_NOTARIZE';
  try {
    console.log(`\n  Notarizing ${appName} via keychain profile "${profile}" (local)...`);
    await notarize({ appPath, keychainProfile: profile });
    console.log(`  ✓ Notarization complete`);
  } catch (err) {
    // Missing profile is expected during local dry-runs — skip gracefully
    console.warn(`\n  ⚠ Notarization skipped: ${err.message}`);
    console.warn(`    Set APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID for CI,`);
    console.warn(`    or store a keychain profile named "${profile}" for local builds.`);
  }
};
