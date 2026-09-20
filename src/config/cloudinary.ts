/**
 * Cloudinary is used for image hosting (menu item photos, restaurant logos,
 * etc.) instead of Firebase Storage, because Cloud Storage for Firebase now
 * requires the Blaze billing plan even for tiny usage — see the note in
 * src/config/firebase.ts. Cloudinary's free tier (25GB storage/bandwidth)
 * needs no billing account at all.
 *
 * Uploads use an UNSIGNED upload preset, which is the standard way to let a
 * browser upload directly to Cloudinary with no backend and no secret keys
 * exposed client-side — the preset name itself is not sensitive (it only
 * controls upload rules like folder/size/format, not access to your account).
 */
export const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? '';
export const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? '';

export const isCloudinaryConfigured =
  CLOUDINARY_CLOUD_NAME.length > 0 && CLOUDINARY_UPLOAD_PRESET.length > 0;
