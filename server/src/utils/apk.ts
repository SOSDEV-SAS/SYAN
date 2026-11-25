export const parseApkInspection = (manifest: string, signature: string) => {
  const packageName = manifest.match(/package: name='([^']+)'/)?.[1];
  const versionCode = Number(manifest.match(/versionCode='(\d+)'/)?.[1]);
  const versionName = manifest.match(/versionName='([^']+)'/)?.[1];
  const certificates = [...signature.matchAll(/Signer #\d+ certificate SHA-256 digest: ([a-f\d]{64})/gi)];
  if (
    packageName !== 'app.alextran.immich' ||
    !Number.isSafeInteger(versionCode) ||
    versionCode <= 0 ||
    !versionName ||
    manifest.includes('application-debuggable') ||
    certificates.length !== 1 ||
    /CN=Android Debug/i.test(signature)
  ) {
    throw new Error('Invalid S&AN release APK');
  }

  return { packageName, versionCode, versionName, certificateSha256: certificates[0][1].toLowerCase() };
};
