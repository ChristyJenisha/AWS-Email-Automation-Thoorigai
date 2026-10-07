import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue(
    'https://demo-bucket.s3.amazonaws.com/signed-upload?X-Amz-Algorithm=AWS4-HMAC-SHA256',
  ),
}));

import { S3StorageService } from './s3-storage.service.js';

describe('S3StorageService', () => {
  let service: S3StorageService;

  beforeEach(() => {
    delete process.env.S3_BUCKET;
    delete process.env.AWS_REGION;

    service = new S3StorageService();
  });

  it('normalizes browser content types before generating a signed upload URL', async () => {
    process.env.S3_BUCKET = 'demo-bucket';

    const result = await service.createBillUploadUrl(
      'invoice-123',
      'Application/PDF; charset=binary',
    );

    expect(result.key).toMatch(/^bills\/invoice-123\/[A-Za-z0-9-]+\.pdf$/);

    expect(result.url).toContain('X-Amz-Algorithm');

    expect(result.expiresIn).toBe(300);
  });
});