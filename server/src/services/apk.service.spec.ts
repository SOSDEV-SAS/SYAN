import { ApkAdminResponseDto } from 'src/dtos/apk.dto.js';
import { SystemMetadataKey } from 'src/enum.js';
import { ApkService } from 'src/services/apk.service.js';
import { newTestService } from 'test/utils.js';

describe(ApkService.name, () => {
  const release = {
    id: 'a65f2fc7-d195-41bb-a813-d714221ebbb1',
    uploadedBy: 'b65f2fc7-d195-41bb-a813-d714221ebbb1',
    versionName: '1.0.0',
    versionCode: 100,
    packageName: 'app.alextran.immich',
    sha256: 'ab'.repeat(32),
    certificateSha256: 'cd'.repeat(32),
    size: 1024,
    uploadedAt: '2026-11-24T00:00:00Z',
  };
  const setup = (state: ApkAdminResponseDto) => {
    const { sut, mocks } = newTestService(ApkService);
    mocks.systemMetadata.get.mockResolvedValue(state);
    mocks.database.withLock.mockImplementation(async (_, callback) => callback());
    mocks.user.getAdminIds.mockResolvedValue([]);
    mocks.storage.getApkPath.mockReturnValue('/var/lib/syan/apks/release.apk');
    return { sut, mocks };
  };

  it('hides unpublished releases', async () => {
    const { sut } = setup({ releases: [release], publishedId: null, certificateSha256: null });
    await expect(sut.getPublic()).resolves.toEqual({ release: null });
    await expect(sut.download()).rejects.toThrow('No Android release');
  });

  it('omits administrator identity and certificate from public metadata', async () => {
    const { sut } = setup({
      releases: [release],
      publishedId: release.id,
      certificateSha256: release.certificateSha256,
    });
    const result = await sut.getPublic();
    expect(result.release).not.toHaveProperty('uploadedBy');
    expect(result.release).not.toHaveProperty('certificateSha256');
    expect(result.release?.sha256).toBe(release.sha256);
  });

  it('preserves the certificate when withdrawing a release', async () => {
    const { sut, mocks } = setup({
      releases: [release],
      publishedId: release.id,
      certificateSha256: release.certificateSha256,
    });
    await sut.publish({ id: null });
    expect(mocks.systemMetadata.set).toHaveBeenCalledWith(SystemMetadataKey.ApkReleases, {
      releases: [release],
      publishedId: null,
      certificateSha256: release.certificateSha256,
    });
  });

  it('rejects a release from a different signer', async () => {
    const { sut, mocks } = setup({ releases: [release], publishedId: null, certificateSha256: 'ef'.repeat(32) });
    await expect(sut.publish({ id: release.id })).rejects.toThrow('certificate');
    expect(mocks.systemMetadata.set).not.toHaveBeenCalled();
  });

  it('rejects removing the published release', async () => {
    const { sut, mocks } = setup({
      releases: [release],
      publishedId: release.id,
      certificateSha256: release.certificateSha256,
    });
    await expect(sut.remove(release.id)).rejects.toThrow('Withdraw');
    expect(mocks.storage.unlink).not.toHaveBeenCalled();
  });
});
