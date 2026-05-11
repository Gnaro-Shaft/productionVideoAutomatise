import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, type AuthContext } from '../../common/decorators/auth.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AssetsService } from './assets.service';

@ApiTags('assets')
@Controller('assets')
@UseGuards(AuthGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get asset metadata' })
  get(@Param('id') id: string, @Auth() auth: AuthContext) {
    return this.assets.getDetail(id, auth);
  }

  @Get(':id/url')
  @ApiOperation({ summary: 'Get a 15-min signed download URL' })
  url(@Param('id') id: string, @Auth() auth: AuthContext) {
    return this.assets.getSignedUrl(id, auth);
  }
}
