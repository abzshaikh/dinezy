import { useState } from 'react';
import {
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { PermissionGuard } from '../../components/common/PermissionGuard';
import { toFriendlyErrorMessage } from '../../utils/errors';
import {
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenseCategories,
  setExpenseCategoryActive,
  updateExpenseCategory,
} from '../../services/expenseService';
import type { ExpenseCategory } from '../../types';
import { ExpenseCategoryFormDialog } from './ExpenseCategoryFormDialog';
import type { ExpenseCategoryFormValues } from '../../utils/validation';

export function ExpenseCategoriesPage() {
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const restaurantId = selectedRestaurant!.restaurantId;

  const [formTarget, setFormTarget] = useState<ExpenseCategory | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['expenseCategories', restaurantId],
    queryFn: () => listExpenseCategories(restaurantId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['expenseCategories', restaurantId] });

  const activeMutation = useMutation({
    mutationFn: ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) =>
      setExpenseCategoryActive(restaurantId, categoryId, isActive),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Category updated.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) => deleteExpenseCategory(restaurantId, categoryId),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Category deleted.', { variant: 'success' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' });
      setDeleteTarget(null);
    },
  });

  if (categoriesQuery.isLoading) return <LoadingIndicator label="Loading categories…" />;
  if (categoriesQuery.isError) {
    return <ErrorState message={toFriendlyErrorMessage(categoriesQuery.error)} onRetry={() => categoriesQuery.refetch()} />;
  }

  const categories = categoriesQuery.data ?? [];
  const canManage = hasPermission('expense.edit');

  const handleFormSubmit = async (values: ExpenseCategoryFormValues) => {
    if (formTarget && formTarget !== 'new') {
      await updateExpenseCategory(restaurantId, formTarget.categoryId, values);
    } else {
      await createExpenseCategory(restaurantId, values);
    }
    invalidate();
    enqueueSnackbar(formTarget === 'new' ? 'Category created.' : 'Category updated.', { variant: 'success' });
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Expense Categories
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Organize {selectedRestaurant?.restaurantName}'s expenses into categories like Rent, Utilities, or
            Salaries.
          </Typography>
        </Box>
        <PermissionGuard permission="expense.edit">
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormTarget('new')}>
            New Category
          </Button>
        </PermissionGuard>
      </Stack>

      {categories.length === 0 ? (
        <EmptyState
          title="No expense categories yet"
          description="Create your first category (e.g. Rent, Utilities) to start logging expenses."
          actionLabel={canManage ? 'New Category' : undefined}
          onAction={canManage ? () => setFormTarget('new') : undefined}
        />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Status</TableCell>
                  {canManage && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.categoryId} hover>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {category.displayOrder}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {category.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 320 }}>
                        {category.description ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={category.isActive ? 'Active' : 'Archived'}
                        color={category.isActive ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    {canManage && (
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => setFormTarget(category)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={category.isActive ? 'Archive' : 'Restore'}>
                            <IconButton
                              size="small"
                              onClick={() =>
                                activeMutation.mutate({ categoryId: category.categoryId, isActive: !category.isActive })
                              }
                            >
                              {category.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => setDeleteTarget(category)}>
                              <DeleteIcon fontSize="small" />
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
        <ExpenseCategoryFormDialog
          open
          category={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete category?"
        description={`"${deleteTarget?.name}" will be permanently deleted. This can't be undone. If it still has expenses recorded against it, deletion will be blocked — archive it instead.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.categoryId)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
