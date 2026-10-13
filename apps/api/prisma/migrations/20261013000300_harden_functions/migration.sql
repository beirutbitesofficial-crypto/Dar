-- Hardening flagged by Supabase's database linter; harmless on plain PostgreSQL.
-- 1. Pin search_path on the guard functions so they cannot be redirected to
--    look-alike objects in another schema.
ALTER FUNCTION public.dar_reject_mutation() SET search_path = public, pg_temp;
ALTER FUNCTION public.dar_guard_rent_obligation() SET search_path = public, pg_temp;
ALTER FUNCTION public.dar_guard_agreement_terms() SET search_path = public, pg_temp;
ALTER FUNCTION public.dar_guard_sale_closing() SET search_path = public, pg_temp;
ALTER FUNCTION public.dar_guard_rent_ledger_insert() SET search_path = public, pg_temp;
ALTER FUNCTION public.dar_guard_payout_line_insert() SET search_path = public, pg_temp;
ALTER FUNCTION public.dar_check_payout_total() SET search_path = public, pg_temp;
ALTER FUNCTION public.dar_guard_sale_ledger_insert() SET search_path = public, pg_temp;

-- 2. Keep extensions out of the public schema. The double-booking exclusion
--    constraint references btree_gist's operator classes by identity, so it is
--    unaffected by the move.
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION btree_gist SET SCHEMA extensions;
