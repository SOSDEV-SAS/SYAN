import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ApkAdminResponseDto, ApkPublicResponseDto, ApkPublishDto, ApkReleaseResponseDto } from 'src/dtos/apk.dto.js';
import { AuthDto } from 'src/dtos/auth.dto.js';
import { CacheControl, DatabaseLock, SystemMetadataKey } from 'src/enum.js';
import { Resource } from 'src/resource-paths.js';
import { BaseService } from 'src/services/base.service.js';
import { ImmichFileResponse } from 'src/utils/file.js';

@Injectable()
export class ApkService extends BaseService {
  private async notifyAdmins() {
    this.resourceRepository.send({
      userIds: await this.userRepository.getAdminIds(),
      changed: [Resource.apkReleases()],
    });
  }

  async getAdmin(): Promise<ApkAdminResponseDto> {
    return (
      (await this.systemMetadataRepository.get(SystemMetadataKey.ApkReleases)) ?? {
        releases: [],
        publishedId: null,
        certificateSha256: null,
      }
    );
  }

  async getPublic(): Promise<ApkPublicResponseDto> {
    const state = await this.getAdmin();
    const published = state.releases.find(({ id }) => id === state.publishedId);
    if (!published) {
      return { release: null };
    }
    return {
      release: {
        id: published.id,
        versionName: published.versionName,
        versionCode: published.versionCode,
        packageName: published.packageName,
        sha256: published.sha256,
        size: published.size,
        uploadedAt: published.uploadedAt,
      },
    };
  }

  async upload(auth: AuthDto, file?: Express.Multer.File): Promise<ApkReleaseResponseDto> {
    if (!file) {
      throw new BadRequestException('APK file is required');
    }
    try {
      return await this.databaseRepository.withLock(DatabaseLock.ApkPublication, async () => {
        const state = await this.getAdmin();
        if (state.releases.length >= 5) {
          throw new BadRequestException('Remove an unpublished release before uploading another');
        }
        const inspected = await this.storageRepository.stageApk(file.path);
        const release = { ...inspected, uploadedAt: new Date().toISOString(), uploadedBy: auth.user.id };
        try {
          if (state.certificateSha256 && state.certificateSha256 !== release.certificateSha256) {
            throw new BadRequestException('APK signing certificate does not match');
          }
          if (state.releases.some(({ versionCode }) => versionCode >= release.versionCode)) {
            throw new BadRequestException('APK version code must increase');
          }
          await this.systemMetadataRepository.set(SystemMetadataKey.ApkReleases, {
            ...state,
            releases: [...state.releases, release],
          });
        } catch (error) {
          await this.storageRepository.unlink(this.storageRepository.getApkPath(release.id));
          throw error;
        }
        await this.notifyAdmins();
        return release;
      });
    } finally {
      await this.storageRepository.unlink(file.path);
    }
  }

  async publish(dto: ApkPublishDto): Promise<ApkAdminResponseDto> {
    return this.databaseRepository.withLock(DatabaseLock.ApkPublication, async () => {
      const state = await this.getAdmin();
      const release = state.releases.find(({ id }) => id === dto.id);
      if (dto.id && !release) {
        throw new NotFoundException('APK release not found');
      }
      if (release && state.certificateSha256 && release.certificateSha256 !== state.certificateSha256) {
        throw new BadRequestException('APK signing certificate does not match');
      }
      if (release) {
        await this.storageRepository.stat(this.storageRepository.getApkPath(release.id));
      }
      const updated = {
        ...state,
        publishedId: dto.id,
        certificateSha256: state.certificateSha256 ?? release?.certificateSha256 ?? null,
      };
      await this.systemMetadataRepository.set(SystemMetadataKey.ApkReleases, updated);
      await this.notifyAdmins();
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    await this.databaseRepository.withLock(DatabaseLock.ApkPublication, async () => {
      const state = await this.getAdmin();
      if (state.publishedId === id) {
        throw new BadRequestException('Withdraw the published APK before removing it');
      }
      if (!state.releases.some((release) => release.id === id)) {
        throw new NotFoundException('APK release not found');
      }
      await this.systemMetadataRepository.set(SystemMetadataKey.ApkReleases, {
        ...state,
        releases: state.releases.filter((release) => release.id !== id),
      });
      await this.notifyAdmins();
      await this.storageRepository.unlink(this.storageRepository.getApkPath(id));
    });
  }

  async download(): Promise<ImmichFileResponse> {
    const { release } = await this.getPublic();
    if (!release) {
      throw new NotFoundException('No Android release is published');
    }
    return new ImmichFileResponse({
      path: this.storageRepository.getApkPath(release.id),
      contentType: 'application/vnd.android.package-archive',
      fileName: `san-${release.versionCode}.apk`,
      cacheControl: CacheControl.PrivateWithoutCache,
    });
  }
}
