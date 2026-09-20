import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem as SelectMenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { ImageUploadField } from '../../components/common/ImageUploadField';
import { fromMinor, toMinor } from '../../utils/money';
import { menuItemSchema, type MenuItemFormValues } from '../../utils/validation';
import { DIETARY_TYPE_LABELS, DIETARY_TYPES, type DietaryType, type MenuCategory, type MenuItem } from '../../types';

export interface MenuItemFormResult {
  categoryId: string;
  name: string;
  description?: string;
  priceMinor: number;
  dietaryType?: DietaryType;
  displayOrder: number;
}

interface MenuItemFormDialogProps {
  open: boolean;
  onClose: () => void;
  item: MenuItem | null; // null = creating a new one
  categories: MenuCategory[];
  defaultCategoryId?: string;
  /** `priceMinor` is already converted from the form's major-unit `price` field before this fires. */
  onSubmit: (values: MenuItemFormResult, imageUrl: string | null) => Promise<void>;
}

/**
 * The uploaded image URL is tracked as separate component state rather than
 * a react-hook-form field — it's not user-typed text, it's the result of an
 * already-completed Cloudinary upload (see ImageUploadField), so it doesn't
 * need Zod validation or dirty-tracking the way the rest of the form does.
 *
 * NOTE: the caller must remount this component per item being edited (e.g.
 * `key={item?.itemId ?? 'new'}`) rather than relying on prop updates —
 * that's how `imageUrl`'s initial state stays correct when the dialog is
 * reused to edit a different item without fully closing/reopening it. The
 * rest of the form (react-hook-form's `values` option) re-syncs on prop
 * change automatically and doesn't need this, but plain useState does.
 */
export function MenuItemFormDialog({ open, onClose, item, categories, defaultCategoryId, onSubmit }: MenuItemFormDialogProps) {
  const { selectedRestaurant } = useRestaurant();
  const currency = selectedRestaurant?.currency ?? 'INR';
  const [imageUrl, setImageUrl] = useState<string | null>(item?.image ?? null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    values: {
      categoryId: item?.categoryId ?? defaultCategoryId ?? '',
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: item ? fromMinor(item.priceMinor, currency) : 0,
      dietaryType: item?.dietaryType ?? '',
      displayOrder: item?.displayOrder ?? 0,
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (values: MenuItemFormValues) => {
    try {
      await onSubmit(
        {
          categoryId: values.categoryId,
          name: values.name,
          description: values.description,
          priceMinor: toMinor(values.price, currency),
          dietaryType: values.dietaryType || undefined,
          displayOrder: values.displayOrder,
        },
        imageUrl,
      );
      handleClose();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{item ? 'Edit Menu Item' : 'New Menu Item'}</DialogTitle>
      <Box component="form" id="menu-item-form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
            {categories.length === 0 && (
              <Alert severity="warning">Create a menu category first before adding items.</Alert>
            )}

            <ImageUploadField label="Photo (optional)" value={imageUrl} onChange={setImageUrl} variant="square" />

            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Category"
                  fullWidth
                  disabled={categories.length === 0}
                  error={!!errors.categoryId}
                  helperText={errors.categoryId?.message}
                >
                  {categories.map((c) => (
                    <SelectMenuItem key={c.categoryId} value={c.categoryId}>
                      {c.name}
                    </SelectMenuItem>
                  ))}
                </TextField>
              )}
            />

            <TextField
              label="Item name"
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
            <Stack direction="row" spacing={2}>
              <TextField
                label={`Price (${currency})`}
                type="number"
                fullWidth
                slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                error={!!errors.price}
                helperText={errors.price?.message}
                {...register('price', { valueAsNumber: true })}
              />
              <Controller
                name="dietaryType"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Dietary (optional)" fullWidth>
                    <SelectMenuItem value="">—</SelectMenuItem>
                    {DIETARY_TYPES.map((d) => (
                      <SelectMenuItem key={d} value={d}>
                        {DIETARY_TYPE_LABELS[d]}
                      </SelectMenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Stack>
            <TextField
              label="Display order"
              type="number"
              fullWidth
              helperText={errors.displayOrder?.message ?? 'Lower numbers appear first within their category.'}
              error={!!errors.displayOrder}
              {...register('displayOrder', { valueAsNumber: true })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="menu-item-form" variant="contained" disabled={isSubmitting || categories.length === 0}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
