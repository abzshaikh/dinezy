import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem as SelectMenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import UndoIcon from '@mui/icons-material/Undo';
import BlockIcon from '@mui/icons-material/Block';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { PermissionGuard } from '../../components/common/PermissionGuard';
import { SearchField, matchesSearch } from '../../components/common/SearchField';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/money';
import { formatDate, resolveDateRangePreset, type DateRangePreset } from '../../utils/dates';
import {
  createExpense,
  listExpenseCategories,
  listExpenses,
  setExpenseVoided,
  updateExpense,
} from '../../services/expenseService';
import type { Expense, SaveExpenseInput } from '../../types';
import { ExpenseFormDialog } from './ExpenseFormDialog';

const RANGE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
];

export function ExpensesPage() {
  const { firebaseUser, profile } = useAuth();
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';

  const [rangePreset, setRangePreset] = useState<DateRangePreset>('thisMonth');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showVoided, setShowVoided] = useState(false);
  const [formTarget, setFormTarget] = useState<Expense | 'new' | null>(null);
  const [search, setSearch] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['expenseCategories', restaurantId],
    queryFn: () => listExpenseCategories(restaurantId),
  });
  const expensesQuery = useQuery({ queryKey: ['expenses', restaurantId], queryFn: () => listExpenses(restaurantId) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['expenses', restaurantId] });

  const categoriesById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.categoryId, c])),
    [categoriesQuery.data],
  );
  const activeCategories = useMemo(() => (categoriesQuery.data ?? []).filter((c) => c.isActive), [categoriesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: ({ target, values }: { target: Expense | 'new'; values: SaveExpenseInput }) =>
      target === 'new'
        ? createExpense(restaurantId, values, categoriesById, {
            userId: firebaseUser!.uid,
            name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Unknown',
          })
        : updateExpense(restaurantId, target.expenseId, values, categoriesById),
    onSuccess: (_, { target }) => {
      invalidate();
      enqueueSnackbar(target === 'new' ? 'Expense recorded.' : 'Expense updated.', { variant: 'success' });
    },
  });

  const voidMutation = useMutation({
    mutationFn: ({ expenseId, isVoided }: { expenseId: string; isVoided: boolean }) =>
      setExpenseVoided(restaurantId, expenseId, isVoided),
    onSuccess: (_, { isVoided }) => {
      invalidate();
      enqueueSnackbar(isVoided ? 'Expense voided.' : 'Expense restored.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  const filtered = useMemo(() => {
    const { start, end } = resolveDateRangePreset(rangePreset);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    return (expensesQuery.data ?? [])
      .filter((e) => e.expenseDate >= startStr && e.expenseDate <= endStr)
      .filter((e) => categoryFilter === 'all' || e.categoryId === categoryFilter)
      .filter((e) => showVoided || !e.isVoided)
      .filter((e) => matchesSearch(e.vendorName, search) || matchesSearch(e.note, search) || matchesSearch(e.categoryName, search));
  }, [expensesQuery.data, rangePreset, categoryFilter, showVoided, search]);

  const totalMinor = useMemo(
    () => filtered.filter((e) => !e.isVoided).reduce((sum, e) => sum + e.amountMinor, 0),
    [filtered],
  );

  const anyLoading = categoriesQuery.isLoading || expensesQuery.isLoading;
  const failedQuery = [categoriesQuery, expensesQuery].find((q) => q.isError);
  if (anyLoading) return <LoadingIndicator label="Loading expenses…" />;
  if (failedQuery) return <ErrorState message={toFriendlyErrorMessage(failedQuery.error)} onRetry={() => failedQuery.refetch()} />;

  const canCreate = hasPermission('expense.create');
  const canEdit = hasPermission('expense.edit');

  const handleFormSubmit = async (values: SaveExpenseInput) => {
    if (!formTarget) return;
    await saveMutation.mutateAsync({ target: formTarget, values });
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Expenses
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Rent, utilities, salaries, and other operating costs for {selectedRestaurant?.restaurantName}.
          </Typography>
        </Box>
        <PermissionGuard permission="expense.create">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setFormTarget('new')}
            disabled={activeCategories.length === 0}
          >
            New Expense
          </Button>
        </PermissionGuard>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchField value={search} onChange={setSearch} placeholder="Search vendor, note, category…" />
        <TextField
          select
          size="small"
          label="Range"
          value={rangePreset}
          onChange={(e) => setRangePreset(e.target.value as DateRangePreset)}
          sx={{ minWidth: 140 }}
        >
          {RANGE_PRESETS.map((p) => (
            <SelectMenuItem key={p.value} value={p.value}>
              {p.label}
            </SelectMenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <SelectMenuItem value="all">All categories</SelectMenuItem>
          {(categoriesQuery.data ?? []).map((c) => (
            <SelectMenuItem key={c.categoryId} value={c.categoryId}>
              {c.name}
            </SelectMenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={<Switch size="small" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />}
          label="Show voided"
        />
        <Box sx={{ flex: 1 }} />
        <Paper variant="outlined" sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Total ({RANGE_PRESETS.find((p) => p.value === rangePreset)?.label})
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {formatCurrency(totalMinor, currency)}
          </Typography>
        </Paper>
      </Stack>

      {activeCategories.length === 0 ? (
        <EmptyState
          icon={<ReceiptLongIcon fontSize="inherit" />}
          title="Create an expense category first"
          description="Head to Expenses → Expense Categories to create one (e.g. Rent, Utilities), then come back here."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ReceiptLongIcon fontSize="inherit" />}
          title="No expenses match"
          description={search ? 'Try a different search term, date range, or category.' : 'Try a different date range, or record a new expense.'}
          actionLabel={canCreate ? 'New Expense' : undefined}
          onAction={canCreate ? () => setFormTarget('new') : undefined}
        />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell align="center">Receipt</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Recorded by</TableCell>
                  {canEdit && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.expenseId} hover sx={{ opacity: e.isVoided ? 0.55 : 1 }}>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(new Date(`${e.expenseDate}T00:00:00`))}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="body2">{e.categoryName}</Typography>
                        {e.isVoided && <Chip size="small" label="Voided" />}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {e.vendorName ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {e.note ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {e.receiptUrl ? (
                        <Tooltip title="View receipt">
                          <IconButton size="small" component="a" href={e.receiptUrl} target="_blank" rel="noopener noreferrer">
                            <ReceiptLongIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, textDecoration: e.isVoided ? 'line-through' : 'none' }}
                      >
                        {formatCurrency(e.amountMinor, currency)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {e.createdByName}
                      </Typography>
                    </TableCell>
                    {canEdit && (
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => setFormTarget(e)} disabled={e.isVoided}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={e.isVoided ? 'Restore' : 'Void'}>
                            <IconButton
                              size="small"
                              color={e.isVoided ? 'default' : 'error'}
                              onClick={() => voidMutation.mutate({ expenseId: e.expenseId, isVoided: !e.isVoided })}
                            >
                              {e.isVoided ? <UndoIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {formTarget && (
        <ExpenseFormDialog
          key={formTarget === 'new' ? 'new' : formTarget.expenseId}
          open
          expense={formTarget === 'new' ? null : formTarget}
          categories={activeCategories}
          onClose={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
        />
      )}
    </Box>
  );
}
