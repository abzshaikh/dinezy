import { useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem as SelectMenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { PermissionGuard } from '../../components/common/PermissionGuard';
import { SearchField, matchesSearch } from '../../components/common/SearchField';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/money';
import {
  createMenuItem,
  deleteMenuItem,
  listCategories,
  listMenuItems,
  setMenuItemActive,
  setMenuItemAvailability,
  updateMenuItem,
} from '../../services/menuService';
import { DIETARY_TYPE_LABELS, type MenuItem } from '../../types';
import { MenuItemFormDialog, type MenuItemFormResult } from './MenuItemFormDialog';

export function MenuItemsPage() {
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [formTarget, setFormTarget] = useState<MenuItem | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['menuCategories', restaurantId],
    queryFn: () => listCategories(restaurantId),
  });
  const itemsQuery = useQuery({
    queryKey: ['menuItems', restaurantId],
    queryFn: () => listMenuItems(restaurantId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['menuItems', restaurantId] });
  };

  const availabilityMutation = useMutation({
    mutationFn: ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) =>
      setMenuItemAvailability(restaurantId, itemId, isAvailable),
    onSuccess: invalidate,
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  const activeMutation = useMutation({
    mutationFn: ({ itemId, isActive }: { itemId: string; isActive: boolean }) =>
      setMenuItemActive(restaurantId, itemId, isActive),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Menu item updated.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteMenuItem(restaurantId, itemId),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Menu item deleted.', { variant: 'success' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' });
      setDeleteTarget(null);
    },
  });

  const categories = categoriesQuery.data ?? [];
  const categoryById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.categoryId, c])),
    [categoriesQuery.data],
  );

  const items = useMemo(() => {
    const all = itemsQuery.data ?? [];
    const byCategory = categoryFilter === 'all' ? all : all.filter((i) => i.categoryId === categoryFilter);
    return byCategory.filter(
      (i) => matchesSearch(i.name, search) || matchesSearch(categoryById.get(i.categoryId)?.name, search) || matchesSearch(i.description, search),
    );
  }, [itemsQuery.data, categoryFilter, search, categoryById]);

  if (categoriesQuery.isLoading || itemsQuery.isLoading) return <LoadingIndicator label="Loading menu items…" />;
  if (categoriesQuery.isError) {
    return <ErrorState message={toFriendlyErrorMessage(categoriesQuery.error)} onRetry={() => categoriesQuery.refetch()} />;
  }
  if (itemsQuery.isError) {
    return <ErrorState message={toFriendlyErrorMessage(itemsQuery.error)} onRetry={() => itemsQuery.refetch()} />;
  }

  const canEdit = hasPermission('menu.edit');

  const handleFormSubmit = async (values: MenuItemFormResult, imageUrl: string | null) => {
    const input = { ...values, image: imageUrl };
    if (formTarget && formTarget !== 'new') {
      await updateMenuItem(restaurantId, formTarget.itemId, input);
    } else {
      await createMenuItem(restaurantId, input);
    }
    invalidate();
    enqueueSnackbar(formTarget === 'new' ? 'Menu item created.' : 'Menu item updated.', { variant: 'success' });
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Menu Items
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage {selectedRestaurant?.restaurantName}'s dishes, prices, and photos.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search menu items…" />
          <TextField
            select
            size="small"
            label="Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <SelectMenuItem value="all">All categories</SelectMenuItem>
            {categories.map((c) => (
              <SelectMenuItem key={c.categoryId} value={c.categoryId}>
                {c.name}
              </SelectMenuItem>
            ))}
          </TextField>
          <PermissionGuard permission="menu.create">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setFormTarget('new')}
              disabled={categories.length === 0}
            >
              New Item
            </Button>
          </PermissionGuard>
        </Stack>
      </Stack>

      {categories.length === 0 ? (
        <EmptyState
          icon={<RestaurantMenuIcon fontSize="inherit" />}
          title="Create a category first"
          description="Menu items belong to a category. Head to Menu → Categories to create one, then come back here."
        />
      ) : items.length === 0 && (itemsQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={<RestaurantMenuIcon fontSize="inherit" />}
          title="No menu items yet"
          description="Add your first dish to get started."
          actionLabel={hasPermission('menu.create') ? 'New Item' : undefined}
          onAction={hasPermission('menu.create') ? () => setFormTarget('new') : undefined}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<RestaurantMenuIcon fontSize="inherit" />}
          title="No items match"
          description="Try a different search term or category."
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(5, 1fr)',
            },
          }}
        >
          {items.map((item) => (
              <Box
                key={item.itemId}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '22px',
                  bgcolor: 'background.paper',
                  p: 2,
                  opacity: item.isActive ? 1 : 0.55,
                  height: '100%',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: (theme) => `0 8px 20px ${theme.palette.primary.main}1F`,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                  <Avatar src={item.image ?? undefined} variant="rounded" sx={{ width: 56, height: 56, bgcolor: 'action.hover' }}>
                    <RestaurantMenuIcon color="disabled" />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                        {item.name}
                      </Typography>
                      {!item.isActive && <Chip size="small" label="Archived" />}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {categoryById.get(item.categoryId)?.name ?? 'Uncategorized'}
                    </Typography>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {formatCurrency(item.priceMinor, currency)}
                    </Typography>
                    {item.dietaryType && (
                      <Chip size="small" variant="outlined" label={DIETARY_TYPE_LABELS[item.dietaryType]} sx={{ mt: 0.5 }} />
                    )}
                  </Box>
                </Stack>
                {item.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    {item.description}
                  </Typography>
                )}
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 2 }}>
                  <Tooltip title={item.isAvailable ? 'Available — toggle to mark out of stock' : 'Out of stock — toggle to mark available'}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Switch
                        size="small"
                        checked={item.isAvailable}
                        disabled={!canEdit || availabilityMutation.isPending}
                        onChange={(e) =>
                          availabilityMutation.mutate({ itemId: item.itemId, isAvailable: e.target.checked })
                        }
                      />
                      <Typography variant="caption" color="text.secondary">
                        {item.isAvailable ? 'Available' : 'Out of stock'}
                      </Typography>
                    </Stack>
                  </Tooltip>
                  <Stack direction="row" spacing={0.5}>
                    <PermissionGuard permission="menu.edit">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setFormTarget(item)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </PermissionGuard>
                    <PermissionGuard permission="menu.edit">
                      <Tooltip title={item.isActive ? 'Archive' : 'Restore'}>
                        <Button
                          size="small"
                          onClick={() => activeMutation.mutate({ itemId: item.itemId, isActive: !item.isActive })}
                        >
                          {item.isActive ? 'Archive' : 'Restore'}
                        </Button>
                      </Tooltip>
                    </PermissionGuard>
                    <PermissionGuard permission="menu.delete">
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(item)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </PermissionGuard>
                  </Stack>
                </Stack>
              </Box>
          ))}
        </Box>
      )}

      {formTarget && (
        <MenuItemFormDialog
          key={formTarget === 'new' ? 'new' : formTarget.itemId}
          open
          item={formTarget === 'new' ? null : formTarget}
          categories={categories}
          defaultCategoryId={categoryFilter !== 'all' ? categoryFilter : undefined}
          onClose={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete menu item?"
        description={`"${deleteTarget?.name}" will be permanently deleted. This can't be undone — consider archiving it instead if you might bring it back.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.itemId)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
