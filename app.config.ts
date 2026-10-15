import { ConfigContext, ExpoConfig } from 'expo/config';
/** Use your OWN reverse-domain bundle identifier before creating signing keys.
 * HABIT_BUNDLE_ID is a non-secret build setting, not an Apple credential. */
export default ({ config }: ConfigContext): ExpoConfig => {
  const bundle = process.env.HABIT_BUNDLE_ID || 'com.example.tinyhabits';
  return {
    ...config,
    name: 'Tiny Habits',
    slug: 'tiny-habits-rewards',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: false,
      bundleIdentifier: bundle,
      usesIcloudStorage: true,
      infoPlist: {
        CFBundleLocalizations: ['zh-Hans', 'en', 'ja', 'ko'],
        ITSAppUsesNonExemptEncryption: false,
        NSUbiquitousContainers: {
          [`iCloud.${bundle}`]: {
            NSUbiquitousContainerIsDocumentScopePublic: false,
            NSUbiquitousContainerSupportedFolderLevels: 'Any',
            NSUbiquitousContainerName: 'Tiny Habits',
          },
        },
      },
      entitlements: {
        'com.apple.developer.icloud-container-identifiers': [`iCloud.${bundle}`],
        'com.apple.developer.ubiquity-container-identifiers': [`iCloud.${bundle}`],
        'com.apple.developer.icloud-services': ['CloudDocuments'],
      },
    },
    plugins: ['expo-localization', ['expo-notifications', { defaultChannel: 'habits' }]],
    web: { bundler: 'metro', name: 'Tiny Habits' },
  };
};
