import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const BUCKET_NAME = 'apartment-images';

export const getPublicUrl = (path: string) => {
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data.publicUrl;
};

// Upload via Edge Function (bypasses RLS with Service Role Key)
export const uploadImage = async (file: File, apartmentId: string, fileName: string): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('apartmentId', apartmentId);

  const functionUrl = `${supabaseUrl}/functions/v1/upload-image`;
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  const data = await response.json();
  return data.url;
};

export const deleteImage = async (apartmentId: string, fileName: string): Promise<void> => {
  const path = `${apartmentId}/${fileName}`;
  const functionUrl = `${supabaseUrl}/functions/v1/delete-image`;
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paths: [path] }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Delete failed');
  }
};

export const listImages = async (apartmentId: string): Promise<{ name: string; url: string; fullPath: string; size?: number; updatedAt?: string }[]> => {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(apartmentId, { limit: 100, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  return (data || []).map(file => ({
    name: file.name,
    url: getPublicUrl(`${apartmentId}/${file.name}`),
    fullPath: `${apartmentId}/${file.name}`,
    size: file.metadata?.size,
    updatedAt: file.updated_at,
  }));
};