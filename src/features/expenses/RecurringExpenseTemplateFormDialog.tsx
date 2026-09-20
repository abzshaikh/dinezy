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
import { useRestaurant } from '../../contexts/RestaurantContext';
import { fromMinor, toMinor } from '../../utils/money';
import { DAY_OF_WEEK_LABELS } from '../../utils/recurrence';
import { recurringExpenseTemplateSchema, type RecurringExpenseTemplateFormValues } from '../../utils/validation';
import type { ExpenseCategory, RecurringExpenseTemplate, SaveRecurringExpenseTemplateInput } from '../../types';

interface RecurringExpenseTemplateFormDialogProps {
  open: boolean;
  onClose: () => void;
  template: RecurringExpenseTemplate | null; // null = creating a new one
  categories: ExpenseCategory[];
  onSubmit: (values: SaveRecurringExpenseTemplateInput) => Promise<void>;
}

export function RecurringExpenseTemplateFormDialog({
  open,
  onClose,
  template,
  categories,
  onSubmit,
}: RecurringExpenseTemplateFormDialogProps) {
  const { selectedRestaurant } = useRestaurant();
  const currency = selectedRestaurant?.currency ?? 'INR';
  // Plain local state, not RHF's `watch()` — `watch` returns a subscription
  // function the React Compiler can't safely memoize (flagged by oxlint's
  // react/incompatible-library rule), and this dialog only needs the
  // current frequency to pick which day-selector to render, not a live
  // subscription. Kept in sync with the Controller's onChange below.
  const [frequency, setFrequency] = useState<RecurringExpenseTemplateFormValues['frequency']>(
    template?.frequency ?? 'monthly',
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RecurringExpenseTemplateFormValues>({
    resolver: zodResolver(recurringExpenseTemplateSchema),
    values: {
      categoryId: template?.categoryId ?? '',
      amount: template ? fromMinor(template.amountMinor, currency) : 0,
      vendorName: template?.vendorName ?? '',
      note: template?.note ?? '',
      frequency: template?.frequency ?? 'monthly',
      dayOfMonth: template?.dayOfMonth ?? 1,
      dayOfWeek: template?.dayOfWeek ?? 0,
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (values: RecurringExpenseTemplateFormValues) => {
    try {
      await onSubmit({
        categoryId: values.categoryId,
        amountMinor: toMinor(values.amount, currency),
        vendorName: values.vendorName,
        note: values.note,
        frequency: values.frequency,
        dayOfMonth: values.dayOfMonth,
        dayOfWeek: values.dayOfWeek,
      });
      handleClose();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{template ? 'Edit Recurring Expense' : 'New Recurring Expense'}</DialogTitle>
      <Box component="form" id="recurring-expense-form" onSubmit={handleSubmit(submit)} noValidate>
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
                  helperText={errors.amount?.message ?? 'A typical/expected amount — editable each time you log it.'}
                  error={!!errors.amount}
                  {...register('amount', { valueAsNumber: true })}
                />
              </Grid>
              <Grid size={6}>
                <Controller
                  name="frequency"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      select
                      label="Repeats"
                      fullWidth
                      onChange={(e) => {
                        const value = e.target.value as RecurringExpenseTemplateFormValues['frequency'];
                        field.onChange(value);
                        setFrequency(value);
                      }}
                    >
                      <SelectMenuItem value="monthly">Monthly</SelectMenuItem>
                      <SelectMenuItem value="weekly">Weekly</SelectMenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              {frequency === 'monthly' ? (
                <Grid size={6}>
                  <TextField
                    label="Day of month"
                    type="number"
                    fullWidth
                    slotProps={{ htmlInput: { min: 1, max: 31 } }}
                    helperText={errors.dayOfMonth?.message ?? "31 clamps to a shorter month's last day."}
                    error={!!errors.dayOfMonth}
                    {...register('dayOfMonth', { valueAsNumber: true })}
                  />
                </Grid>
              ) : (
                <Grid size={6}>
                  <Controller
                    name="dayOfWeek"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        label="Day of week"
                        fullWidth
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      >
                        {DAY_OF_WEEK_LABELS.map((label, idx) => (
                          <SelectMenuItem key={label} value={idx}>
                            {label}
                          </SelectMenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
              )}
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
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="recurring-expense-form"
            variant="contained"
            disabled={isSubmitting || categories.length === 0}
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
