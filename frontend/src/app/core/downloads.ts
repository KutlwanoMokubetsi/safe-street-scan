/** Android builds published by the GitHub Actions workflow (.github/workflows/android.yml). */
const BASE = 'https://github.com/KutlwanoMokubetsi/safe-street-scan/releases/download/android-latest';
export const APK = {
  universal: `${BASE}/crimespot.apk`,
  arm64: `${BASE}/crimespot-arm64.apk`,
  armv7: `${BASE}/crimespot-armv7.apk`,
};
export const isAndroid = () => /Android/i.test(navigator.userAgent);
