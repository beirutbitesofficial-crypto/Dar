// Supabase client added for Hostinger's Supabase integration, which sets the
// SUPABASE_* environment variables for this app.
//
// The Dar API itself does not use this file: it connects to the same database
// directly through DATABASE_URL (Prisma). Dar's tables are deliberately closed
// to the Supabase client (row-level security, no grants to anon/authenticated),
// so queries through this client return nothing from them.
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = url && key ? createClient(url, key) : null;

module.exports = supabase;
