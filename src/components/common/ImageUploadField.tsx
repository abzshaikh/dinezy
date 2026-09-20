import { useRef, useState } from 'react';
import { Alert, Avatar, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import UploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import { uploadImage } from '../../services/cloudinaryService';
import { toFriendlyErrorMessage } from '../../utils/errors';

interface ImageUploadFieldProps {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  /** 'square' for menu item photos, 'round' for logos/avatars. */
  variant?: 'square' | 'round';
}

/**
 * Reusable image upload control backed by Cloudinary (see
 * services/cloudinaryService.ts). Shows a preview, an upload button, and a
 * remove button. `value`/`onChange` carry the hosted image URL — the parent
 * form just treats it like any other string field (e.g. wire it into React
 * Hook Form with a Controller).
 */
export function ImageUploadField({ label, value, onChange, variant = 'square' }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const result = await uploadImage(file);
      onChange(result.url);
    } catch (err) {
      setError(toFriendlyErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Avatar
          src={value ?? undefined}
          variant={variant === 'round' ? 'circular' : 'rounded'}
          sx={{ width: 72, height: 72, bgcolor: 'grey.100' }}
        >
          {uploading && <CircularProgress size={24} />}
        </Avatar>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            </Button>
            {value && (
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => onChange(null)}
                disabled={uploading}
              >
                Remove
              </Button>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            JPEG, PNG, or WebP — up to 5MB
          </Typography>
        </Stack>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={handleFileSelected}
      />
    </Box>
  );
}
