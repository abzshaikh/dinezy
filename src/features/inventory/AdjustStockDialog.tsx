import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { adjustmentSchema, type AdjustmentFormValues } from '../../utils/validation';
import { formatNumber } from '../../utils/money';
import type { Ingredient } from '../../types';

interface AdjustStockDialogProps {
  open: boolean;
  onClose: () => void;
  ingredient: Ingredient;
  onSubmit: (values: AdjustmentFormValues) => Promise<void>;
}

/** For correcting stock to a known quantity — e.g. after a physical count — rather than nudging it by a delta, which is easier to get wrong when someone's staring at a shelf. */
export function AdjustStockDialog({ open, onClose, ingredient, onSubmit }: AdjustStockDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { newStockQty: ingredient.currentStockQty, note: '' },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (values: AdjustmentFormValues) => {
    try {
      await onSubmit(values);
      handleClose();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Adjust Stock — {ingredient.name}</DialogTitle>
      <Box component="form" id="adjust-stock-form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
            <Typography variant="body2" color="text.secondary">
              Currently recorded: {formatNumber(ingredient.currentStockQty)} {ingredient.unit}
            </Typography>
            <TextField
              label={`Actual stock (${ingredient.unit})`}
              type="number"
              fullWidth
              autoFocus
              slotProps={{ htmlInput: { step: 'any', min: 0 } }}
              error={!!errors.newStockQty}
              helperText={errors.newStockQty?.message}
              {...register('newStockQty', { valueAsNumber: true })}
            />
            <TextField
              label="Reason"
              fullWidth
              multiline
              minRows={2}
              placeholder="e.g. Physical count correction"
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
          <Button type="submit" form="adjust-stock-form" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
