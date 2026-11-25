import { createZodDto } from '@immich/nestjs-standard-schema/zod';
import z from 'zod';

export const ApkReleaseSchema = z.object({
  id: z.uuid(),
  versionName: z.string(),
  versionCode: z.number().int().positive(),
  packageName: z.string(),
  certificateSha256: z.string(),
  sha256: z.string(),
  size: z.number().int().positive(),
  uploadedAt: z.string(),
  uploadedBy: z.uuid(),
});

export type ApkRelease = z.infer<typeof ApkReleaseSchema>;

export class ApkReleaseResponseDto extends createZodDto(ApkReleaseSchema) {}

export class ApkPublicResponseDto extends createZodDto({
  release: ApkReleaseSchema.omit({ uploadedBy: true, certificateSha256: true }).nullable(),
}) {}

export class ApkAdminResponseDto extends createZodDto({
  releases: z.array(ApkReleaseSchema),
  publishedId: z.uuid().nullable(),
  certificateSha256: z.string().nullable(),
}) {}

export class ApkPublishDto extends createZodDto({
  id: z.uuid().nullable(),
}) {}
