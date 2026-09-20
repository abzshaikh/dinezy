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
import { wasteSchema, type WasteFormValues } from '../../utils/validation';
import { WASTE_REASONS, WASTE_REASON_LABELS, type Ingredient, type RecordWasteInput } from '../../types';

interface WasteFormDialogProps {
  open: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
  defaultIngredientId?: string;
  onSubmit: (values: RecordWasteInput) => Promise<void>;
}

export function WasteFormDialog({ open, onClose, ingredients, defaultIngredientId, onSubmit }: WasteFormDialogProps) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<WasteFormValues>({
    resolver: zodResolver(wasteSchema),
    defaultValues: {
      ingredientId: defaultIngredientId ?? '',
      quantity: 0,
      reason: 'spoilage',
      note: '',
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (values: WasteFormValues) => {
    try {
      await onSubmit(values);
      handleClose();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Record Waste</DialogTitle>
      <Box component="form" id="waste-form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
            {ingredients.length === 0 && <Alert severity="warning">Create an ingredient first before recording waste.</Alert>}

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

            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Reason" fullWidth>
                  {WASTE_REASONS.map((r) => (
                    <SelectMenuItem key={r} value={r}>
                      {WASTE_REASON_LABELS[r]}
                    </SelectMenuItem>
                  ))}
                </TextField>
              )}
            />

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
          <Button type="submit" form="waste-form" variant="contained" color="error" disabled={isSubmitting || ingredients.length === 0}>
            {isSubmitting ? 'Saving…' : 'Record Waste'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
