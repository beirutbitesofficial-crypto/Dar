import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/** Validates a body/query with a shared schema; returns the parsed value. */
export class ZodPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}
  transform(value: unknown): z.infer<S> {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Some fields are invalid',
        details: {
          fields: r.error.issues.map((i) => ({ path: i.path.join('.'), code: i.message })),
        },
      });
    }
    return r.data;
  }
}

export const zbody = <S extends ZodTypeAny>(schema: S) => new ZodPipe(schema);
