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
import { fromMinor, toMinor } from '../../utils/money';
import { ingredientSchema, type IngredientFormValues } from '../../utils/validation';
import { DEFAULT_RESTAURANT_SETTINGS, INGREDIENT_UNITS, type Ingredient } from '../../types';

export interface IngredientFormResult {
  name: string;
  category?: string;
  unit: IngredientFormValues['unit'];
  costPerUnitMinor: number;
  openingStockQty?: number;
  reorderLevel?: number;
}

interface IngredientFormDialogProps {
  open: boolean;
  onClose: () => void;
  ingredient: Ingredient | null; // null = creating a new one
  onSubmit: (values: IngredientFormResult) => Promise<void>;
}

export function IngredientFormDialog({ open, onClose, ingredient, onSubmit }: IngredientFormDialogProps) {
  const { selectedRestaurant } = useRestaurant();
  const currency = selectedRestaurant?.currency ?? 'INR';

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<IngredientFormValues>({
    resolver: zodResolver(ingredientSchema),
    values: {
      name: ingredient?.name ?? '',
      category: ingredient?.category ?? '',
      // New ingredient: default to the restaurant's configured default
      // weight unit (Phase 8 setting) rather than a hardcoded 'kg' — there's
      // no way to know upfront whether a new ingredient is weight- or
      // volume-measured, so defaultWeightUnit is the best single guess;
      // defaultVolumeUnit stays unconsumed (see PHASE_9_REPORT.md).
      unit: ingredient?.unit ?? (selectedRestaurant?.settings ?? DEFAULT_RESTAURANT_SETTINGS).defaultWeightUnit,
      costPerUnit: ingredient ? fromMinor(ingredient.costPerUnitMinor, currency) : 0,
      openingStockQty: undefined,
      reorderLevel: ingredient?.reorderLevel ?? undefined,
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (values: IngredientFormValues) => {
    try {
      await onSubmit({
        name: values.name,
        category: values.category,
        unit: values.unit,
        costPerUnitMinor: toMinor(values.costPerUnit, currency),
        openingStockQty: values.openingStockQty,
        reorderLevel: values.reorderLevel,
      });
      handleClose();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{ingredient ? 'Edit Ingredient' : 'New Ingredient'}</DialogTitle>
      <Box component="form" id="ingredient-form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {errors.root && <Alert severity="error">{errors.root.message}</Alert>}

            <TextField
              label="Ingredient name"
              fullWidth
              autoFocus
              error={!!errors.name}
              helperText={errors.name?.message}
              {...register('name')}
            />
            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  label="Category (optional)"
                  fullWidth
                  error={!!errors.category}
                  helperText={errors.category?.message}
                  {...register('category')}
                />
              </Grid>
              <Grid size={6}>
                <Controller
                  name="unit"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select label="Unit" fullWidth>
                      {INGREDIENT_UNITS.map((u) => (
                        <SelectMenuItem key={u} value={u}>
                          {u}
                        </SelectMenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label={`Cost per unit (${currency})`}
                  type="number"
                  fullWidth
                  slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                  error={!!errors.costPerUnit}
                  helperText={errors.costPerUnit?.message ?? 'Kept up to date automatically by future purchases.'}
                  {...register('costPerUnit', { valueAsNumber: true })}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Reorder level (optional)"
                  type="number"
                  fullWidth
                  slotProps={{ htmlInput: { step: 'any', min: 0 } }}
                  error={!!errors.reorderLevel}
                  helperText={errors.reorderLevel?.message ?? 'Flags low stock on the list.'}
                  {...register('reorderLevel', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
                />
              </Grid>
              {!ingredient && (
                <Grid size={12}>
                  <TextField
                    label="Opening stock (optional)"
                    type="number"
                    fullWidth
                    slotProps={{ htmlInput: { step: 'any', min: 0 } }}
                    error={!!errors.openingStockQty}
                    helperText={
                      errors.openingStockQty?.message ??
                      'How much you already have on hand right now, if any. Recorded as an opening-stock adjustment.'
                    }
                    {...register('openingStockQty', {
                      setValueAs: (v) => (v === '' ? undefined : Number(v)),
                    })}
                  />
                </Grid>
              )}
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="ingredient-form" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
