import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { ApkController } from 'src/controllers/apk.controller.js';
import { Permission } from 'src/enum.js';
import { ApkService } from 'src/services/apk.service.js';
import { ControllerContext, controllerSetup, mockBaseService } from 'test/utils.js';

describe(ApkController.name, () => {
  let ctx: ControllerContext;
  const service = mockBaseService(ApkService);
  beforeAll(async () => {
    ctx = await controllerSetup(ApkController, [{ provide: ApkService, useValue: service }]);
    return () => ctx.close();
  });
  beforeEach(() => {
    ctx.reset();
    service.resetAllMocks();
  });

  it('allows public discovery without authentication', async () => {
    service.getPublic.mockResolvedValue({ release: null });
    const response = await request(ctx.getHttpServer()).get('/android-releases/published');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ release: null });
    expect(ctx.authenticate).not.toHaveBeenCalled();
  });

  it.each([new UnauthorizedException(), new ForbiddenException()])('blocks unauthorized publication', async (error) => {
    ctx.authenticate.mockRejectedValue(error);
    const response = await request(ctx.getHttpServer()).put('/android-releases/published').send({ id: null });
    expect(response.status).toBe(error.getStatus());
    expect(service.publish).not.toHaveBeenCalled();
    expect(ctx.authenticate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ adminRoute: true, permission: Permission.SystemMetadataUpdate }),
      }),
    );
  });

  it('rejects invalid release IDs', async () => {
    const response = await request(ctx.getHttpServer())
      .put('/android-releases/published')
      .send({ id: '../../secrets' });
    expect(response.status).toBe(400);
    expect(service.publish).not.toHaveBeenCalled();
  });
});
