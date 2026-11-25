import { describe, expect, it } from 'vitest';
import { parseApkInspection } from 'src/utils/apk.js';

describe('APK release inspection', () => {
  const manifest = "package: name='app.alextran.immich' versionCode='100' versionName='1.0.0'";
  const signature = `Signer #1 certificate DN: CN=S&AN\nSigner #1 certificate SHA-256 digest: ${'ab'.repeat(32)}`;

  it('extracts a valid signed release identity', () => {
    expect(parseApkInspection(manifest, signature)).toEqual({
      packageName: 'app.alextran.immich',
      versionCode: 100,
      versionName: '1.0.0',
      certificateSha256: 'ab'.repeat(32),
    });
  });

  it.each([
    manifest.replace('app.alextran.immich', 'app.attacker'),
    `${manifest}\napplication-debuggable`,
    manifest.replace("versionCode='100'", "versionCode='0'"),
    manifest.replace("versionCode='100'", "versionCode='9007199254740992'"),
    '',
  ])('rejects invalid manifests', (value) => {
    expect(() => parseApkInspection(value, signature)).toThrow();
  });

  it.each(['', signature.replace('CN=S&AN', 'CN=Android Debug'), `${signature}\n${signature}`])(
    'rejects missing, debug or multiple signers',
    (value) => expect(() => parseApkInspection(manifest, value)).toThrow(),
  );
});
