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
  createCategory,
  deleteCategory,
  listCategories,
  setCategoryActive,
  updateCategory,
} from '../../services/menuService';
import type { MenuCategory } from '../../types';
import { CategoryFormDialog } from './CategoryFormDialog';
import type { MenuCategoryFormValues } from '../../utils/validation';

export function MenuCategoriesPage() {
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const restaurantId = selectedRestaurant!.restaurantId;

  const [formTarget, setFormTarget] = useState<MenuCategory | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuCategory | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['menuCategories', restaurantId],
    queryFn: () => listCategories(restaurantId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['menuCategories', restaurantId] });

  const activeMutation = useMutation({
    mutationFn: ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) =>
      setCategoryActive(restaurantId, categoryId, isActive),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Category updated.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (categoryId: string) => deleteCategory(restaurantId, categoryId),
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
  const canManage = hasPermission('menu.create') || hasPermission('menu.edit');

  const handleFormSubmit = async (values: MenuCategoryFormValues) => {
    if (formTarget && formTarget !== 'new') {
      await updateCategory(restaurantId, formTarget.categoryId, values);
    } else {
      await createCategory(restaurantId, values);
    }
    invalidate();
    enqueueSnackbar(formTarget === 'new' ? 'Category created.' : 'Category updated.', { variant: 'success' });
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Menu Categories
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Organize {selectedRestaurant?.restaurantName}'s menu into categories like Starters, Mains, or Desserts.
          </Typography>
        </Box>
        <PermissionGuard permission="menu.create">
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormTarget('new')}>
            New Category
          </Button>
        </PermissionGuard>
      </Stack>

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create your first menu category to start adding menu items."
          actionLabel={hasPermission('menu.create') ? 'New Category' : undefined}
          onAction={hasPermission('menu.create') ? () => setFormTarget('new') : undefined}
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
                          <PermissionGuard permission="menu.edit">
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
                          </PermissionGuard>
                          <PermissionGuard permission="menu.delete">
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => setDeleteTarget(category)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </PermissionGuard>
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
        <CategoryFormDialog
          open
          category={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete category?"
        description={`"${deleteTarget?.name}" will be permanently deleted. This can't be undone. If it still has menu items in it, deletion will be blocked until you move or delete those first.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.categoryId)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
