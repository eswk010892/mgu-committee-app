import { createClient } from '@supabase/supabase-js'

const URL_ = import.meta.env.VITE_SUPABASE_URL
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when a real backend is configured. Without it the app runs in demo mode. */
export const isConfigured = Boolean(URL_ && KEY_)

export const supabase = isConfigured ? createClient(URL_, KEY_) : null
