"""Runs in CI after `flutter create`: configures the generated Android project for CrimeSpot.

- Android 6.0+ (minSdk 23) so the app reaches ~98% of phones in use.
- App id, sign-in redirect scheme, core library desugaring (needed by notifications).
- Release signing if a key is provided, Firebase if google-services.json is present.
- Permissions: internet, location (incl. foreground service for sharing/SOS/walks), notifications, vibration.
"""
import os, re, sys

app = 'android/app/build.gradle.kts'
s = open(app).read()

def sub(pattern, repl, text, label):
    new, n = re.subn(pattern, repl, text, count=1)
    if n == 0:
        sys.exit(f'patch failed: {label}')
    return new

s = sub(r'applicationId = "[^"]+"', 'applicationId = "za.co.crimespot.app"', s, 'applicationId')
s = sub(r'minSdk = flutter\.minSdkVersion', 'minSdk = maxOf(flutter.minSdkVersion, 23)', s, 'minSdk')
s = sub(r'(defaultConfig \{)', r'\1\n        manifestPlaceholders["appAuthRedirectScheme"] = "za.co.crimespot.app"', s, 'placeholders')
s = sub(r'(compileOptions \{)', r'\1\n        isCoreLibraryDesugaringEnabled = true', s, 'desugaring')

if os.path.exists('android/key.properties'):
    s = 'import java.util.Properties\nimport java.io.FileInputStream\n\n' + s
    s = sub(r'(android \{)', r'''val keyProps = Properties().apply { load(FileInputStream(rootProject.file("key.properties"))) }

\1
    signingConfigs {
        create("release") {
            storeFile = file(keyProps["storeFile"] as String)
            storePassword = keyProps["storePassword"] as String
            keyAlias = keyProps["keyAlias"] as String
            keyPassword = keyProps["keyPassword"] as String
        }
    }''', s, 'signing configs')
    s = sub(r'signingConfig = signingConfigs\.getByName\("debug"\)', 'signingConfig = signingConfigs.getByName("release")', s, 'release signing')
    print('release signing: configured')
else:
    print('release signing: NOT configured (debug key; set ANDROID_KEYSTORE_BASE64 to keep updates installable)')

if os.path.exists('android/app/google-services.json'):
    s = sub(r'(plugins \{)', r'\1\n    id("com.google.gms.google-services")', s, 'gms plugin')
    st = 'android/settings.gradle.kts'
    t = open(st).read()
    t = sub(r'(plugins \{)', r'\1\n    id("com.google.gms.google-services") version "4.4.2" apply false', t, 'gms settings')
    open(st, 'w').write(t)
    print('firebase: configured')
else:
    print('firebase: not configured (push notifications off until GOOGLE_SERVICES_JSON is set)')

s += '\ndependencies {\n    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")\n}\n'
open(app, 'w').write(s)

# Some plugins pin an old compileSdk (e.g. flutter_appauth uses 33), but current AndroidX libraries need 34+.
# Compile every Android module against 36. This doesn't change which phones can install the app (that's minSdk).
root = 'android/build.gradle.kts'
r = open(root).read()
force = """
// Added by tool/patch_android.py: compile all plugins against a current Android SDK.
subprojects {
    val forceCompileSdk: Project.() -> Unit = {
        extensions.findByType(com.android.build.gradle.BaseExtension::class.java)?.compileSdkVersion(36)
    }
    if (state.executed) forceCompileSdk() else afterEvaluate { forceCompileSdk() }
}
"""
anchor = 'subprojects {\n    project.evaluationDependsOn(":app")'
if anchor in r:
    r = r.replace(anchor, force.strip() + '\n' + anchor, 1)   # must come before evaluationDependsOn
else:
    r += force
open(root, 'w').write(r)
print('plugins: compileSdk 36')

m = 'android/app/src/main/AndroidManifest.xml'
x = open(m).read()
perms = ['INTERNET', 'ACCESS_NETWORK_STATE', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'FOREGROUND_SERVICE',
         'FOREGROUND_SERVICE_LOCATION', 'POST_NOTIFICATIONS', 'VIBRATE', 'WAKE_LOCK']
block = ''.join(f'    <uses-permission android:name="android.permission.{p}"/>\n' for p in perms)
x = sub(r'(<manifest[^>]*>\n)', r'\1' + block, x, 'permissions')
x = sub(r'android:label="[^"]+"', 'android:label="CrimeSpot"', x, 'label')
# Flutter's template sets android:taskAffinity="" on MainActivity. That makes Android deliver the sign-in
# redirect into a separate task, so flutter_appauth reports "User cancelled flow" even after a successful login.
x, n = re.subn(r'\s*android:taskAffinity=""', '', x)
print(f'sign-in redirect: removed taskAffinity="" ({n})')
# Android 11+ package visibility for phone calls, SMS, maps and links
queries = '''    <queries>
        <intent><action android:name="android.intent.action.VIEW"/><data android:scheme="https"/></intent>
        <intent><action android:name="android.intent.action.DIAL"/><data android:scheme="tel"/></intent>
        <intent><action android:name="android.intent.action.SENDTO"/><data android:scheme="sms"/></intent>
        <intent><action android:name="android.intent.action.TTS_SERVICE"/></intent>
    </queries>
'''
inner = queries.split('<queries>')[1].split('</queries>')[0]
if '</queries>' in x:
    x = x.replace('</queries>', inner + '    </queries>', 1)   # Flutter's template already has a <queries> block
else:
    x = x.replace('</manifest>', queries + '</manifest>')
open(m, 'w').write(x)
print('android project patched')
