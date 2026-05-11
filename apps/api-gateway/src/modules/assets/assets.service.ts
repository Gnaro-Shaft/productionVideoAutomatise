import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthContext } from '../../common/decorators/auth.decorator';
import { PrismaService } from '../../infra/prisma.service';
import { S3Service } from '../../infra/s3.service';

const SIGNED_URL_TTL_SEC = 15 * 60;

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async getDetail(id: string, auth: AuthContext) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, project: { orgId: auth.orgId } },
    });
    if (!asset) throw new NotFoundException();
    return asset;
  }

  async getSignedUrl(id: string, auth: AuthContext) {
    const asset = await this.getDetail(id, auth);
    const url = await this.s3.signedDownloadUrl(asset.s3Bucket, asset.s3Key, SIGNED_URL_TTL_SEC);
    return {
      url,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SEC * 1000).toISOString(),
    };
  }
}
