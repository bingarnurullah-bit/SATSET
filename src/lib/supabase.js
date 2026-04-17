import { createClient } from '@supabase/supabase-js'

// GANTI DUA BARIS DI BAWAH INI DENGAN DATA DARI MENU PROJECT SETTINGS -> API SUPABASE MAS
const supabaseUrl = 'https://ujuhdvzinvbvvtlhlykc.supabase.co'
const supabaseKey = 'sb_publishable_O2p9YF7E09eALuRGABLyPg_xgJLJftp'

export const supabase = createClient(supabaseUrl, supabaseKey)