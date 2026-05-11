import {
  CreateProjectInput,
  PaginationQuery,
  UpdateProjectInput,
} from '@pva/shared-types';
import { createZodDto } from 'nestjs-zod';

export class CreateProjectDto extends createZodDto(CreateProjectInput) {}
export class UpdateProjectDto extends createZodDto(UpdateProjectInput) {}
export class PaginationQueryDto extends createZodDto(PaginationQuery) {}
