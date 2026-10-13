import { DomainError } from './errors';

/**
 * Prevents double-booking an employee. Appointments are half-open intervals
 * [start, end) with a configurable travel buffer between viewings.
 */
export interface Appointment {
  id: string;
  employeeId: string;
  startsAt: Date;
  endsAt: Date;
}

export function overlaps(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }, bufferMinutes = 0) {
  const buf = bufferMinutes * 60_000;
  return a.startsAt.getTime() < b.endsAt.getTime() + buf && b.startsAt.getTime() < a.endsAt.getTime() + buf;
}

export function findConflicts(candidate: Appointment, existing: readonly Appointment[], bufferMinutes = 15): Appointment[] {
  if (candidate.endsAt <= candidate.startsAt) throw new DomainError('APPOINTMENT_INVALID_RANGE');
  return existing.filter(
    (e) => e.id !== candidate.id && e.employeeId === candidate.employeeId && overlaps(candidate, e, bufferMinutes),
  );
}

export function assertNoConflict(candidate: Appointment, existing: readonly Appointment[], bufferMinutes = 15) {
  const conflicts = findConflicts(candidate, existing, bufferMinutes);
  if (conflicts.length > 0) {
    throw new DomainError('EMPLOYEE_DOUBLE_BOOKED', 'The employee already has a viewing at that time', {
      conflictIds: conflicts.map((c) => c.id),
    });
  }
}
