export const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'neutral'> = {
  PUBLISHED: 'green', PENDING_REVIEW: 'amber', REJECTED: 'red', DRAFT: 'neutral', PAUSED: 'neutral', RENTED: 'green', SOLD: 'green', ARCHIVED: 'neutral',
  PAID: 'green', PARTIALLY_PAID: 'amber', OVERDUE: 'red', DUE: 'amber', UPCOMING: 'neutral', VOID: 'neutral', WAIVED: 'neutral',
};
