import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { menuCategorySchema, type MenuCategoryFormValues } from '../../utils/validation';
import type { MenuCategory } from '../../types';

interface CategoryFormDialogProps {
  open: boolean;
  onClose: () => void;
  category: MenuCategory | null; // null = creating a new one
  onSubmit: (values: MenuCategoryFormValues) => Promise<void>;
}

export function CategoryFormDialog({ open, onClose, category, onSubmit }: CategoryFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MenuCategoryFormValues>({
    resolver: zodResolver(menuCategorySchema),
    values: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      displayOrder: category?.displayOrder ?? 0,
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (values: MenuCategoryFormValues) => {
    try {
      await onSubmit(values);
      handleClose();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{category ? 'Edit Category' : 'New Category'}</DialogTitle>
      <Box component="form" id="category-form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
            <TextField
              label="Category name"
              fullWidth
              autoFocus
              error={!!errors.name}
              helperText={errors.name?.message}
              {...register('name')}
            />
            <TextField
              label="Description (optional)"
              fullWidth
              multiline
              minRows={2}
              error={!!errors.description}
              helperText={errors.description?.message}
              {...register('description')}
            />
            <TextField
              label="Display order"
              type="number"
              fullWidth
              helperText={errors.displayOrder?.message ?? 'Lower numbers appear first.'}
              error={!!errors.displayOrder}
              {...register('displayOrder', { valueAsNumber: true })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
