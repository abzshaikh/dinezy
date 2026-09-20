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
  Grid,
  MenuItem as SelectMenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { toMinor } from '../../utils/money';
import { purchaseSchema, type PurchaseFormValues } from '../../utils/validation';
import type { Ingredient, RecordPurchaseInput } from '../../types';

interface PurchaseFormDialogProps {
  open: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  defaultIngredientId?: string;
  onSubmit: (values: RecordPurchaseInput) => Promise<void>;
}

export function PurchaseFormDialog({ open, onClose, ingredients, defaultIngredientId, onSubmit }: PurchaseFormDialogProps) {
  const { selectedRestaurant } = useRestaurant();
  const currency = selectedRestaurant?.currency ?? 'INR';

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      ingredientId: defaultIngredientId ?? '',
      quantity: 0,
      unitCost: 0,
      vendorName: '',
      expiryDate: '',
      note: '',
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (values: PurchaseFormValues) => {
    try {
      await onSubmit({
        ingredientId: values.ingredientId,
        quantity: values.quantity,
        unitCostMinor: toMinor(values.unitCost, currency),
        vendorName: values.vendorName,
        expiryDate: values.expiryDate ? new Date(`${values.expiryDate}T00:00:00`) : undefined,
        note: values.note,
      });
      handleClose();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record Purchase</DialogTitle>
      <Box component="form" id="purchase-form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
            {ingredients.length === 0 && <Alert severity="warning">Create an ingredient first before recording a purchase.</Alert>}

            <Controller
              name="ingredientId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Ingredient"
                  fullWidth
                  disabled={ingredients.length === 0}
                  error={!!errors.ingredientId}
                  helperText={errors.ingredientId?.message}
                >
                  {ingredients.map((ing) => (
                    <SelectMenuItem key={ing.ingredientId} value={ing.ingredientId}>
                      {ing.name} ({ing.unit})
                    </SelectMenuItem>
                  ))}
                </TextField>
              )}
            />

            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  label="Quantity"
                  type="number"
                  fullWidth
                  autoFocus
                  slotProps={{ htmlInput: { step: 'any', min: 0 } }}
                  error={!!errors.quantity}
                  helperText={errors.quantity?.message}
                  {...register('quantity', { valueAsNumber: true })}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label={`Cost per unit (${currency})`}
                  type="number"
                  fullWidth
                  slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                  error={!!errors.unitCost}
                  helperText={errors.unitCost?.message ?? 'Updates the ingredient’s cost per unit.'}
                  {...register('unitCost', { valueAsNumber: true })}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Vendor (optional)"
                  fullWidth
                  error={!!errors.vendorName}
                  helperText={errors.vendorName?.message}
                  {...register('vendorName')}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Expiry date (optional)"
                  type="date"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!!errors.expiryDate}
                  helperText={errors.expiryDate?.message}
                  {...register('expiryDate')}
                />
              </Grid>
            </Grid>

            <TextField
              label="Note (optional)"
              fullWidth
              multiline
              minRows={2}
              error={!!errors.note}
              helperText={errors.note?.message}
              {...register('note')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="purchase-form" variant="contained" disabled={isSubmitting || ingredients.length === 0}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
