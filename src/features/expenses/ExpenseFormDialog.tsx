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
  Grid,
  MenuItem as SelectMenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { format } from 'date-fns';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { ImageUploadField } from '../../components/common/ImageUploadField';
import { fromMinor, toMinor } from '../../utils/money';
import { expenseSchema, type ExpenseFormValues } from '../../utils/validation';
import type { Expense, ExpenseCategory, SaveExpenseInput } from '../../types';

interface ExpenseFormDialogProps {
  open: boolean;
  onClose: () => void;
  expense: Expense | null; // null = creating a new one
  categories: ExpenseCategory[]; // active categories, for the picker
  /** Phase 13: prefills a NEW expense from a recurring template (category/amount/vendor/note) without pretending it's an edit of an existing Expense. Ignored when `expense` is set. */
  initialValues?: Partial<Pick<SaveExpenseInput, 'categoryId' | 'amountMinor' | 'vendorName' | 'note'>>;
  onSubmit: (values: SaveExpenseInput) => Promise<void>;
}

export function ExpenseFormDialog({ open, onClose, expense, categories, initialValues, onSubmit }: ExpenseFormDialogProps) {
  const { selectedRestaurant } = useRestaurant();
  const currency = selectedRestaurant?.currency ?? 'INR';
  const [receiptUrl, setReceiptUrl] = useState<string | null>(expense?.receiptUrl ?? null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    values: {
      categoryId: expense?.categoryId ?? initialValues?.categoryId ?? '',
      amount: expense
        ? fromMinor(expense.amountMinor, currency)
        : initialValues?.amountMinor !== undefined
          ? fromMinor(initialValues.amountMinor, currency)
          : 0,
      expenseDate: expense?.expenseDate ?? format(new Date(), 'yyyy-MM-dd'),
      vendorName: expense?.vendorName ?? initialValues?.vendorName ?? '',
      note: expense?.note ?? initialValues?.note ?? '',
    },
  });

  const handleClose = () => {
    reset();
    setReceiptUrl(expense?.receiptUrl ?? null);
    onClose();
  };

  const submit = async (values: ExpenseFormValues) => {
    try {
      await onSubmit({
        categoryId: values.categoryId,
        amountMinor: toMinor(values.amount, currency),
        expenseDate: values.expenseDate,
        vendorName: values.vendorName,
        note: values.note,
        receiptUrl,
      });
      handleClose();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{expense ? 'Edit Expense' : 'New Expense'}</DialogTitle>
      <Box component="form" id="expense-form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
            {categories.length === 0 && (
              <Alert severity="warning">Create an expense category first (Expenses → Expense Categories).</Alert>
            )}

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

            <Grid container spacing={2}>
              <Grid size={6}>
                <TextField
                  label={`Amount (${currency})`}
                  type="number"
                  fullWidth
                  autoFocus
                  slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                  error={!!errors.amount}
                  helperText={errors.amount?.message}
                  {...register('amount', { valueAsNumber: true })}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="Date"
                  type="date"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!!errors.expenseDate}
                  helperText={errors.expenseDate?.message}
                  {...register('expenseDate')}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  label="Vendor / paid to (optional)"
                  fullWidth
                  error={!!errors.vendorName}
                  helperText={errors.vendorName?.message}
                  {...register('vendorName')}
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

            <ImageUploadField label="Receipt photo (optional)" value={receiptUrl} onChange={setReceiptUrl} variant="square" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" variant="contained" disabled={isSubmitting || categories.length === 0}>
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
