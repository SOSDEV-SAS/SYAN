import { Injectable } from '@nestjs/common';
import { join } from 'node:path';
import { ErrorMessages } from 'src/constants.js';
import { StorageCore } from 'src/cores/storage.core.js';
import { OnEvent, OnJob } from 'src/decorators.js';
import { StorageTargetsResponseDto, type SystemConfig } from 'src/dtos/config.dto.js';
import {
  BootstrapEventPriority,
  DatabaseLock,
  JobName,
  JobStatus,
  QueueName,
  StorageFolder,
  SystemMetadataKey,
} from 'src/enum.js';
import type { ArgOf } from 'src/repositories/event.repository.js';
import { BaseService } from 'src/services/base.service.js';
import type { JobOf, SystemFlags } from 'src/types.js';
import { ImmichStartupError } from 'src/utils/misc.js';

const docsMessage = `Please see https://docs.immich.app/administration/system-integrity#folder-checks for more information.`;

@Injectable()
export class StorageService extends BaseService {
  private getStorageTarget(config: SystemConfig) {
    const { storage } = this.configRepository.getEnv();
    const target = storage.targets.find(({ id }) => id === config.storageTarget.primary);
    if (!target) {
      throw new Error(`Storage target is not configured: ${config.storageTarget.primary}`);
    }
    return target;
  }

  private async validateStorageTarget(config: SystemConfig) {
    const target = this.getStorageTarget(config);
    if (!this.storageRepository.existsSync(target.path)) {
      throw new Error(`Storage target is not mounted: ${target.name}`);
    }
    if (!(await this.storageRepository.checkFolderAccess(target.path))) {
      throw new Error(`Storage target is not writable: ${target.name}`);
    }
  }

  private activateStorageTarget(config: SystemConfig) {
    const { storage } = this.configRepository.getEnv();
    const target = this.getStorageTarget(config);
    StorageCore.setMediaLocations(
      target.path,
      storage.targets.map(({ path }) => path),
    );
  }

  @OnEvent({ name: 'AppBootstrap', priority: BootstrapEventPriority.StorageService })
  async onBootstrap() {
    const config = await this.getConfig({ withCache: false });
    this.activateStorageTarget(config);

    await this.databaseRepository.withLock(DatabaseLock.SystemFileMounts, async () => {
      const flags =
        (await this.systemMetadataRepository.get(SystemMetadataKey.SystemFlags)) ||
        ({ mountChecks: {} } as SystemFlags);

      if (!flags.mountChecks) {
        flags.mountChecks = {};
      }

      let isUpdated = false;

      this.logger.log(`Verifying system mount folder checks, current state: ${JSON.stringify(flags)}`);

      try {
        // check each folder exists and is writable
        for (const folder of Object.values(StorageFolder)) {
          if (!flags.mountChecks[folder]) {
            this.logger.log(`Writing initial mount file for the ${folder} folder`);
            await this.createMountFile(folder);
          }

          await this.verifyReadAccess(folder);
          await this.verifyWriteAccess(folder);

          if (flags.mountChecks[folder]) {
            continue;
          }

          flags.mountChecks[folder] = true;
          isUpdated = true;
        }

        if (isUpdated) {
          await this.systemMetadataRepository.set(SystemMetadataKey.SystemFlags, flags);
          this.logger.log('Successfully enabled system mount folders checks');
        }

        this.logger.log('Successfully verified system mount folder checks');
      } catch (error) {
        const envData = this.configRepository.getEnv();
        if (envData.storage.ignoreMountCheckErrors) {
          this.logger.error(error as Error);
          this.logger.warn('Ignoring mount folder errors');
        } else {
          throw error;
        }
      }
    });

    await this.databaseRepository.withLock(DatabaseLock.MediaLocation, async () => {
      const current = StorageCore.getMediaLocation();
      const { targets } = this.configRepository.getEnv().storage;
      const samples = await this.assetRepository.getFileSamples();
      const savedValue = await this.systemMetadataRepository.get(SystemMetadataKey.MediaLocation);
      if (samples.length > 0) {
        const path = samples[0].path;

        let previous = savedValue?.location || '';

        if (!previous && this.configRepository.getEnv().storage.mediaLocation) {
          previous = current;
        }

        if (!previous) {
          previous = path.startsWith('upload/') ? 'upload' : '/usr/src/app/upload';
        }

        if (previous !== current && targets.length === 1) {
          this.logger.log(`Media location changed (from=${previous}, to=${current})`);

          if (!path.startsWith(previous)) {
            throw new Error(ErrorMessages.InconsistentMediaLocation);
          }

          this.logger.warn(
            `Detected a change to media location, performing an automatic migration of file paths from ${previous} to ${current}, this may take awhile`,
          );
          await this.databaseRepository.migrateFilePaths(previous, current);
        }
      }

      // Only set MediaLocation in systemMetadataRepository if needed
      if (savedValue?.location !== current) {
        await this.systemMetadataRepository.set(SystemMetadataKey.MediaLocation, { location: current });
      }
    });
  }

  @OnEvent({ name: 'ConfigValidate' })
  async onConfigValidate({ newConfig }: ArgOf<'ConfigValidate'>) {
    await this.validateStorageTarget(newConfig);
  }

  @OnEvent({ name: 'ConfigUpdate', server: true })
  async onConfigUpdate({ oldConfig, newConfig }: ArgOf<'ConfigUpdate'>) {
    if (oldConfig.storageTarget.primary === newConfig.storageTarget.primary) {
      return;
    }

    this.activateStorageTarget(newConfig);
    for (const folder of Object.values(StorageFolder)) {
      const { internalPath } = this.getMountFilePaths(folder);
      if (!(await this.storageRepository.checkFileExists(internalPath))) {
        await this.createMountFile(folder);
      }
      await this.verifyReadAccess(folder);
      await this.verifyWriteAccess(folder);
    }
  }

  async getAdminStorageTargets(): Promise<StorageTargetsResponseDto> {
    const config = await this.getConfig({ withCache: false });
    const { targets } = this.configRepository.getEnv().storage;
    return {
      targets: await Promise.all(
        targets.map(async (target) => {
          try {
            const usage = await this.storageRepository.checkDiskUsage(target.path);
            return {
              ...target,
              primary: target.id === config.storageTarget.primary,
              online: true,
              writable: await this.storageRepository.checkFolderAccess(target.path),
              total: usage.total,
              available: usage.available,
            };
          } catch {
            return {
              ...target,
              primary: target.id === config.storageTarget.primary,
              online: false,
              writable: false,
              total: 0,
              available: 0,
            };
          }
        }),
      ),
    };
  }

  @OnJob({ name: JobName.FileDelete, queue: QueueName.BackgroundTask })
  async handleDeleteFiles(job: JobOf<JobName.FileDelete>): Promise<JobStatus> {
    const { files } = job;

    // TODO: one job per file
    for (const file of files) {
      if (!file) {
        continue;
      }

      try {
        await this.storageRepository.unlink(file);
      } catch (error: any) {
        this.logger.warn('Unable to remove file from disk', error);
      }
    }

    return JobStatus.Success;
  }

  private async verifyReadAccess(folder: StorageFolder) {
    const { internalPath, externalPath } = this.getMountFilePaths(folder);
    try {
      await this.storageRepository.readFile(internalPath);
    } catch (error) {
      this.logger.error(`Failed to read (${internalPath}): ${error}`);
      throw new ImmichStartupError(`Failed to read: "${externalPath} (${internalPath}) - ${docsMessage}"`);
    }
  }

  private async createMountFile(folder: StorageFolder) {
    const { folderPath, internalPath, externalPath } = this.getMountFilePaths(folder);
    try {
      this.storageRepository.mkdirSync(folderPath);
      await this.storageRepository.createFile(internalPath, Buffer.from(Date.now().toString()));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        this.logger.warn('Found existing mount file, skipping creation');
        return;
      }
      this.logger.error(`Failed to create ${internalPath}: ${error}`);
      throw new ImmichStartupError(`Failed to create "${externalPath} - ${docsMessage}"`);
    }
  }

  private async verifyWriteAccess(folder: StorageFolder) {
    const { internalPath, externalPath } = this.getMountFilePaths(folder);
    try {
      await this.storageRepository.overwriteFile(internalPath, Buffer.from(Date.now().toString()));
    } catch (error) {
      this.logger.error(`Failed to write ${internalPath}: ${error}`);
      throw new ImmichStartupError(`Failed to write "${externalPath} - ${docsMessage}"`);
    }
  }

  private getMountFilePaths(folder: StorageFolder) {
    const folderPath = StorageCore.getBaseFolder(folder);
    const internalPath = join(folderPath, '.immich');
    const externalPath = `<UPLOAD_LOCATION>/${folder}/.immich`;

    return { folderPath, internalPath, externalPath };
  }
}
