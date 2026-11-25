import {
  Body,
  Controller,
  Delete,
  Get,
  Next,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { NextFunction, Response } from 'express';
import { tmpdir } from 'node:os';
import { Endpoint, HistoryBuilder } from 'src/decorators.js';
import { ApkAdminResponseDto, ApkPublicResponseDto, ApkPublishDto, ApkReleaseResponseDto } from 'src/dtos/apk.dto.js';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { ApiTag, Permission } from 'src/enum.js';
import { Auth, Authenticated, FileResponse } from 'src/middleware/auth.guard.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';
import { ApkService } from 'src/services/apk.service.js';
import { sendFile } from 'src/utils/file.js';
import { UUIDParamDto } from 'src/validation.js';

@ApiTags(ApiTag.Server)
@Controller('android-releases')
export class ApkController {
  constructor(
    private service: ApkService,
    private logger: LoggingRepository,
  ) {}

  @Delete(':id')
  @Authenticated({ admin: true, permission: Permission.SystemMetadataUpdate })
  @Endpoint({
    summary: 'Remove unpublished Android release',
    description: 'Remove an unpublished APK from the server.',
    history: new HistoryBuilder().added('v3.2.0').beta('v3.2.0'),
  })
  deleteApk(@Param() { id }: UUIDParamDto): Promise<void> {
    return this.service.remove(id);
  }

  @Get('published')
  @Authenticated({ public: true })
  @Endpoint({
    summary: 'Get published Android release',
    description: 'Get published Android release for S&AN.',
    history: new HistoryBuilder().added('v3.2.0').beta('v3.2.0'),
  })
  getPublishedApk(): Promise<ApkPublicResponseDto> {
    return this.service.getPublic();
  }

  @Get('download')
  @Authenticated({ public: true })
  @FileResponse()
  @Endpoint({
    summary: 'Download published Android release',
    description: 'Download published Android release for S&AN.',
    history: new HistoryBuilder().added('v3.2.0').beta('v3.2.0'),
  })
  async downloadPublishedApk(@Res() res: Response, @Next() next: NextFunction) {
    await sendFile(res, next, () => this.service.download(), this.logger);
  }

  @Get()
  @Authenticated({ admin: true, permission: Permission.SystemMetadataRead })
  @Endpoint({
    summary: 'List Android releases',
    description: 'List Android releases for S&AN.',
    history: new HistoryBuilder().added('v3.2.0').beta('v3.2.0'),
  })
  getApkReleases(): Promise<ApkAdminResponseDto> {
    return this.service.getAdmin();
  }

  @Post()
  @Authenticated({ admin: true, permission: Permission.SystemMetadataUpdate })
  @UseInterceptors(
    FileInterceptor('file', { dest: tmpdir(), limits: { fileSize: 300 * 1024 * 1024, files: 1, fields: 0 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
  })
  @Endpoint({
    summary: 'Upload signed Android release',
    description: 'Upload signed Android release for S&AN.',
    history: new HistoryBuilder().added('v3.2.0').beta('v3.2.0'),
  })
  uploadApk(@Auth() auth: AuthDto, @UploadedFile() file?: Express.Multer.File): Promise<ApkReleaseResponseDto> {
    return this.service.upload(auth, file);
  }

  @Put('published')
  @Authenticated({ admin: true, permission: Permission.SystemMetadataUpdate })
  @Endpoint({
    summary: 'Publish or withdraw Android release',
    description: 'Publish or withdraw Android release for S&AN.',
    history: new HistoryBuilder().added('v3.2.0').beta('v3.2.0'),
  })
  publishApk(@Body() dto: ApkPublishDto): Promise<ApkAdminResponseDto> {
    return this.service.publish(dto);
  }
}
