import { z } from 'zod';

// Reusable primitives -----------------------------------------------------

export const Cuid = z.string().min(20).max(30);
export type Cuid = z.infer<typeof Cuid>;

export const IsoDateTime = z.string().datetime();
export type IsoDateTime = z.infer<typeof IsoDateTime>;

// Pagination (cursor-based) ----------------------------------------------

export const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: Cuid.optional(),
  order: z
    .string()
    .regex(/^[a-zA-Z]+:(asc|desc)$/)
    .optional(),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: Cuid.nullable(),
  });
}

// Error envelope ---------------------------------------------------------

export const ErrorCode = z.enum([
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
  'WORKFLOW_FAILED',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z
      .array(
        z.object({
          path: z.array(z.union([z.string(), z.number()])),
          message: z.string(),
        }),
      )
      .optional(),
    requestId: z.string(),
    timestamp: IsoDateTime,
  }),
});
export type ApiError = z.infer<typeof ApiError>;

// Health -----------------------------------------------------------------

export const HealthResponse = z.object({
  ok: z.literal(true),
  version: z.string(),
  uptime: z.number(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
