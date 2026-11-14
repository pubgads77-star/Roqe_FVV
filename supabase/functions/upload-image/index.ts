import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('PROJECT_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const formData = await req.formData()
    const file = formData.get('file') as File
    const apartmentId = formData.get('apartmentId') as string

    if (!file || !apartmentId) {
      return new Response(JSON.stringify({ error: 'Missing file or apartmentId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${timestamp}_${random}.${ext}`
    const path = `${apartmentId}/${fileName}`

    const { data, error } = await supabaseAdmin.storage
      .from('apartment-images')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (error) throw error

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('apartment-images')
      .getPublicUrl(path)

    // Firestore is updated by client-side after successful upload
    // to avoid race conditions between Edge Function and client

    return new Response(JSON.stringify({ url: publicUrl, path }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})