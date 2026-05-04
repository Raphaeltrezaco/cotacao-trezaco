import { createClient } from '@supabase/supabase-js'

const URL = 'https://cilbkzvuvwjeqtdpxcbs.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbGJrenZ1dndqZXF0ZHB4Y2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzQwNTAsImV4cCI6MjA5MzE1MDA1MH0._bn3Je-gsu4Edc8SKr-fQBVW5dxCOIKn_zxqT61wq2M'

export const supabase = createClient(URL, KEY)

export async function fetchSupabase(tabela, params = '') {
  const res = await fetch(`${URL}/rest/v1/${tabela}${params}`, {
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
  })
  return res.json()
}

export async function postSupabase(tabela, body) {
  const res = await fetch(`${URL}/rest/v1/${tabela}`, {
    method: 'POST',
    headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(body)
  })
  return res.json()
}