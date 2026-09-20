import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, isCloudinaryConfigured } from '../config/cloudinary';
import { AppError } from '../utils/errors';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadedImage {
  url: string;
  publicId: string;
}

/**
 * Uploads an image file directly from the browser to Cloudinary using an
 * UNSIGNED upload preset (see src/config/cloudinary.ts for why). Returns the
 * hosted image URL — store THIS STRING on the Firestore document (e.g.
 * menuItem.image, restaurant.logo), never the raw file.
 *
 * Note: unsigned uploads cannot delete images (deletion requires a signed
 * request with your Cloudinary API secret, which must never live in
 * client-side code). Replacing an image leaves the old one orphaned in
 * Cloudinary — harmless well within the 25GB free tier for a single
 * restaurant's photos, but worth knowing if you ever wire up cleanup later
 * (would need a small trusted backend/Cloud Function holding the secret).
 */
export async function uploadImage(file: File): Promise<UploadedImage> {
  if (!isCloudinaryConfigured) {
    throw new AppError(
      'Image uploads are not configured yet. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env.local.',
    );
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new AppError('Please upload a JPEG, PNG, or WebP image.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new AppError('Image is too large — please upload something under 5MB.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new AppError('Could not reach the image upload service. Check your connection and try again.');
  }

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error('Cloudinary upload failed', await response.text().catch(() => ''));
    throw new AppError('Image upload failed. Please try again.');
  }

  const data = (await response.json()) as { secure_url: string; public_id: string };
  return { url: data.secure_url, publicId: data.public_id };
}
