import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { PermissionGuard } from '../../components/common/PermissionGuard';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/money';
import { formatDate } from '../../utils/dates';
import { computeNextDueDate, isTemplateDue, DAY_OF_WEEK_LABELS } from '../../utils/recurrence';
import {
  createExpense,
  createRecurringExpenseTemplate,
  deleteRecurringExpenseTemplate,
  listExpenseCategories,
  listRecurringExpenseTemplates,
  markRecurringExpenseGenerated,
  setRecurringExpenseTemplateActive,
  updateRecurringExpenseTemplate,
} from '../../services/expenseService';
import type { RecurringExpenseTemplate, SaveExpenseInput, SaveRecurringExpenseTemplateInput } from '../../types';
import { ExpenseFormDialog } from './ExpenseFormDialog';
import { RecurringExpenseTemplateFormDialog } from './RecurringExpenseTemplateFormDialog';

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

function scheduleLabel(t: RecurringExpenseTemplate): string {
  if (t.frequency === 'monthly') {
    const day = t.dayOfMonth ?? 1;
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
    return `Monthly, on the ${day}${suffix}`;
  }
  return `Weekly, on ${DAY_OF_WEEK_LABELS[t.dayOfWeek ?? 0]}`;
}

export function RecurringExpensesPage() {
  const { firebaseUser, profile } = useAuth();
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const restaurantId = selectedRestaurant!.restaurantId;

  const [formTarget, setFormTarget] = useState<RecurringExpenseTemplate | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringExpenseTemplate | null>(null);
  const [logTarget, setLogTarget] = useState<RecurringExpenseTemplate | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['expenseCategories', restaurantId],
    queryFn: () => listExpenseCategories(restaurantId),
  });
  const templatesQuery = useQuery({
    queryKey: ['recurringExpenseTemplates', restaurantId],
    queryFn: () => listRecurringExpenseTemplates(restaurantId),
  });

  const invalidateTemplates = () => queryClient.invalidateQueries({ queryKey: ['recurringExpenseTemplates', restaurantId] });
  const invalidateExpenses = () => queryClient.invalidateQueries({ queryKey: ['expenses', restaurantId] });

  const activeCategories = useMemo(() => (categoriesQuery.data ?? []).filter((c) => c.isActive), [categoriesQuery.data]);
  const categoriesById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.categoryId, c])),
    [categoriesQuery.data],
  );

  const templateMutation = useMutation({
    mutationFn: ({ target, values }: { target: RecurringExpenseTemplate | 'new'; values: SaveRecurringExpenseTemplateInput }) =>
      target === 'new'
        ? createRecurringExpenseTemplate(restaurantId, values, categoriesById)
        : updateRecurringExpenseTemplate(restaurantId, target.templateId, values, categoriesById),
    onSuccess: (_, { target }) => {
      invalidateTemplates();
      enqueueSnackbar(target === 'new' ? 'Recurring expense created.' : 'Recurring expense updated.', { variant: 'success' });
    },
  });

  const activeMutation = useMutation({
    mutationFn: ({ templateId, isActive }: { templateId: string; isActive: boolean }) =>
      setRecurringExpenseTemplateActive(restaurantId, templateId, isActive),
    onSuccess: () => {
      invalidateTemplates();
      enqueueSnackbar('Updated.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) => deleteRecurringExpenseTemplate(restaurantId, templateId),
    onSuccess: () => {
      invalidateTemplates();
      enqueueSnackbar('Recurring expense deleted.', { variant: 'success' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' });
      setDeleteTarget(null);
    },
  });

  const anyLoading = categoriesQuery.isLoading || templatesQuery.isLoading;
  const failedQuery = [categoriesQuery, templatesQuery].find((q) => q.isError);
  if (anyLoading) return <LoadingIndicator label="Loading recurring expenses…" />;
  if (failedQuery) return <ErrorState message={toFriendlyErrorMessage(failedQuery.error)} onRetry={() => failedQuery.refetch()} />;

  const templates = templatesQuery.data ?? [];
  const canManage = hasPermission('expense.edit');
  const canLog = hasPermission('expense.create');
  const today = todayStr();
  const dueCount = templates.filter((t) => t.isActive && isTemplateDue(t, today)).length;

  const handleTemplateFormSubmit = async (values: SaveRecurringExpenseTemplateInput) => {
    if (!formTarget) return;
    await templateMutation.mutateAsync({ target: formTarget, values });
  };

  const handleLogSubmit = async (values: SaveExpenseInput) => {
    if (!logTarget) return;
    await createExpense(restaurantId, values, categoriesById, {
      userId: firebaseUser!.uid,
      name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Unknown',
    });
    await markRecurringExpenseGenerated(restaurantId, logTarget.templateId, values.expenseDate);
    invalidateTemplates();
    invalidateExpenses();
    enqueueSnackbar('Expense logged.', { variant: 'success' });
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Recurring Expenses
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Rent, subscriptions, and other regular costs for {selectedRestaurant?.restaurantName} — set one up here,
            then log the actual expense each time it's due.
          </Typography>
        </Box>
        <PermissionGuard permission="expense.edit">
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormTarget('new')}>
            New Recurring Expense
          </Button>
        </PermissionGuard>
      </Stack>

      {dueCount > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {dueCount} recurring expense{dueCount === 1 ? ' is' : 's are'} due — look for the "Log expense" button below.
        </Alert>
      )}

      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        Nothing here logs an expense automatically — a template just reminds you it's due and prefills the New
        Expense form. You still review and save it, same as any manual entry.
      </Alert>

      {templates.length === 0 ? (
        <EmptyState
          icon={<EventRepeatIcon fontSize="inherit" />}
          title="No recurring expenses set up yet"
          description="Create one for a cost that repeats — rent, a monthly subscription — and you'll get a reminder each time it's due."
          actionLabel={canManage ? 'New Recurring Expense' : undefined}
          onAction={canManage ? () => setFormTarget('new') : undefined}
        />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Category</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Schedule</TableCell>
                  <TableCell>Next due</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {templates.map((t) => {
                  const due = t.isActive && isTemplateDue(t, today);
                  const nextDue = computeNextDueDate(t, today);
                  return (
                    <TableRow key={t.templateId} hover sx={{ opacity: t.isActive ? 1 : 0.55 }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {t.categoryName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {t.vendorName ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{formatCurrency(t.amountMinor, selectedRestaurant?.currency ?? 'INR')}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {scheduleLabel(t)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={due ? 'error.main' : 'text.secondary'} sx={{ fontWeight: due ? 700 : 400 }}>
                          {formatDate(new Date(`${nextDue}T00:00:00`))}
                          {due ? ' (due)' : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={t.isActive ? 'Active' : 'Paused'}
                          color={t.isActive ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                          {canLog && t.isActive && (
                            <Tooltip title="Log expense">
                              <Button size="small" variant={due ? 'contained' : 'outlined'} onClick={() => setLogTarget(t)}>
                                Log expense
                              </Button>
                            </Tooltip>
                          )}
                          {canManage && (
                            <>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => setFormTarget(t)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t.isActive ? 'Pause' : 'Resume'}>
                                <IconButton
                                  size="small"
                                  onClick={() => activeMutation.mutate({ templateId: t.templateId, isActive: !t.isActive })}
                                >
                                  {t.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => setDeleteTarget(t)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {formTarget && (
        <RecurringExpenseTemplateFormDialog
          key={formTarget === 'new' ? 'new' : formTarget.templateId}
          open
          template={formTarget === 'new' ? null : formTarget}
          categories={activeCategories}
          onClose={() => setFormTarget(null)}
          onSubmit={handleTemplateFormSubmit}
        />
      )}

      {logTarget && (
        <ExpenseFormDialog
          key={logTarget.templateId}
          open
          expense={null}
          categories={activeCategories}
          initialValues={{
            categoryId: logTarget.categoryId,
            amountMinor: logTarget.amountMinor,
            vendorName: logTarget.vendorName ?? undefined,
            note: logTarget.note ?? undefined,
          }}
          onClose={() => setLogTarget(null)}
          onSubmit={handleLogSubmit}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete recurring expense?"
        description={`"${deleteTarget?.categoryName}" will be permanently deleted. This only removes the template/reminder — any expenses you've already logged from it stay exactly as they are.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.templateId)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
