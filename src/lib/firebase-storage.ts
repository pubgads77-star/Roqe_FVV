import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { app } from './firebase';

const storage = getStorage(app);
const BUCKET_FOLDER = 'apartment-images';

export const uploadImage = async (file: File, apartmentId: string, fileName: string): Promise<string> => {
  const storagePath = `${BUCKET_FOLDER}/${apartmentId}/${fileName}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: 'public, max-age=31536000',
  });
  
  return await getDownloadURL(storageRef);
};

export const deleteImage = async (apartmentId: string, fileName: string): Promise<void> => {
  const storagePath = `${BUCKET_FOLDER}/${apartmentId}/${fileName}`;
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
};

export const listImages = async (apartmentId: string): Promise<{ name: string; url: string; fullPath: string }[]> => {
  const folderRef = ref(storage, `${BUCKET_FOLDER}/${apartmentId}`);
  const result = await listAll(folderRef);
  
  const images = await Promise.all(
    result.items.map(async (itemRef) => {
      const url = await getDownloadURL(itemRef);
      return {
        name: itemRef.name,
        url,
        fullPath: itemRef.fullPath,
      };
    })
  );
  
  return images.sort((a, b) => a.name.localeCompare(b.name));
};