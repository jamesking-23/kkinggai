# Publishing to Google Play

Status (2026-11-25): the workflow can sign the Android App Bundle (AAB) with your own upload key. Nothing has been uploaded to Google Play, and the signing step has not run with a real keystore (it was rehearsed here with a throwaway key: strip the old signature, re-sign, verify). Treat it as untested until a real build prints the certificate.

## What stays the same

- The APK that "Check for updates" installs is still signed with the public Expo debug key. Changing that key would stop every phone that has the app from updating in place (Android refuses an update signed with a different key), so it is left alone. It is for your own phones.
- Only the AAB is signed with your upload key.

## What you need (none of this can be done by Claude for you)

1. A Google Play Console developer account (one-time fee, identity verification; new personal accounts also have to run a closed test with testers for a period before production release).
2. An upload keystore, created by you, kept private, and backed up somewhere safe (a password manager plus an offline copy). If you lose it you can ask Google to reset the upload key, but it is slow.
3. A store listing: description, screenshots, icon, a privacy policy URL (the app handles account data, so one is required), the data-safety form, content rating.

## Create the upload keystore (on any computer with Java)

```
keytool -genkeypair -v -keystore kkingg-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Choose strong passwords and remember them. Then turn it into text for GitHub:

```
base64 -w0 kkingg-upload.jks      # Linux
base64 -i kkingg-upload.jks       # macOS
certutil -encode kkingg-upload.jks out.txt   # Windows (copy the text between the BEGIN/END lines, without them)
```

## Add four repository secrets

GitHub > the repo > Settings > Secrets and variables > Actions > Secrets (not Variables):

| Secret                      | Value                             |
| --------------------------- | --------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | the base64 text of the keystore   |
| `ANDROID_KEYSTORE_PASSWORD` | the store password                |
| `ANDROID_KEY_ALIAS`         | `upload` (or the alias you chose) |
| `ANDROID_KEY_PASSWORD`      | the key password                  |

Never paste these in a chat, an issue or a commit. Claude should not be given them.

## Build and upload

1. Run the "Mobile (Android)" workflow. The "Sign the AAB with the Play upload key" step prints the certificate owner and SHA-256 when it worked; if it says the secrets are not all set, the AAB is still debug-signed.
2. Download the `kkingg-ai-android` artifact from the run and take the `.aab` file.
3. In Play Console create the app, enrol in Play App Signing (the default), and upload the AAB to an internal or closed testing track first.

The Android `versionCode` is the workflow run number, which only goes up, as Play requires. The app id is `com.kkingg.ai`; it cannot be changed after the first upload.
