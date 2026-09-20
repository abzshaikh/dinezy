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
import TuneIcon from '@mui/icons-material/Tune';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { PermissionGuard } from '../../components/common/PermissionGuard';
import { SearchField, matchesSearch } from '../../components/common/SearchField';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency, formatNumber } from '../../utils/money';
import {
  createIngredient,
  listIngredients,
  recordAdjustment,
  setIngredientActive,
  updateIngredient,
} from '../../services/inventoryService';
import type { Ingredient } from '../../types';
import { IngredientFormDialog, type IngredientFormResult } from './IngredientFormDialog';
import { AdjustStockDialog } from './AdjustStockDialog';
import type { AdjustmentFormValues } from '../../utils/validation';

export function IngredientsPage() {
  const { firebaseUser, profile } = useAuth();
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';

  const [formTarget, setFormTarget] = useState<Ingredient | 'new' | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Ingredient | null>(null);
  const [search, setSearch] = useState('');

  const ingredientsQuery = useQuery({
    queryKey: ['ingredients', restaurantId],
    queryFn: () => listIngredients(restaurantId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ingredients', restaurantId] });

  const activeMutation = useMutation({
    mutationFn: ({ ingredientId, isActive }: { ingredientId: string; isActive: boolean }) =>
      setIngredientActive(restaurantId, ingredientId, isActive),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar('Ingredient updated.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  if (ingredientsQuery.isLoading) return <LoadingIndicator label="Loading ingredients…" />;
  if (ingredientsQuery.isError) {
    return <ErrorState message={toFriendlyErrorMessage(ingredientsQuery.error)} onRetry={() => ingredientsQuery.refetch()} />;
  }

  const allIngredients = ingredientsQuery.data ?? [];
  const ingredients = allIngredients.filter((i) => matchesSearch(i.name, search) || matchesSearch(i.category, search));
  const canEdit = hasPermission('inventory.edit');
  const canAdjust = hasPermission('inventory.adjust');

  const creatorInfo = () => ({
    userId: firebaseUser!.uid,
    name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Unknown',
  });

  const handleFormSubmit = async (values: IngredientFormResult) => {
    if (formTarget && formTarget !== 'new') {
      await updateIngredient(restaurantId, formTarget.ingredientId, values);
    } else {
      await createIngredient(restaurantId, values, creatorInfo());
    }
    invalidate();
    enqueueSnackbar(formTarget === 'new' ? 'Ingredient created.' : 'Ingredient updated.', { variant: 'success' });
  };

  const handleAdjustSubmit = async (values: AdjustmentFormValues) => {
    if (!adjustTarget) return;
    await recordAdjustment(restaurantId, { ingredientId: adjustTarget.ingredientId, ...values }, creatorInfo());
    invalidate();
    enqueueSnackbar('Stock adjusted.', { variant: 'success' });
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Ingredients
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Raw materials for {selectedRestaurant?.restaurantName}. Stock and cost per unit update automatically from
            purchases and waste — use "Adjust" to correct a count directly.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search ingredients…" />
          <PermissionGuard permission="inventory.create">
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormTarget('new')}>
              New Ingredient
            </Button>
          </PermissionGuard>
        </Stack>
      </Stack>

      {ingredients.length === 0 && allIngredients.length === 0 ? (
        <EmptyState
          title="No ingredients yet"
          description="Add your first raw material to start tracking stock, purchases, and waste."
          actionLabel={hasPermission('inventory.create') ? 'New Ingredient' : undefined}
          onAction={hasPermission('inventory.create') ? () => setFormTarget('new') : undefined}
        />
      ) : ingredients.length === 0 ? (
        <EmptyState title="No ingredients match" description="Try a different search term." />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Ingredient</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Stock</TableCell>
                  <TableCell align="right">Cost / unit</TableCell>
                  <TableCell>Status</TableCell>
                  {(canEdit || canAdjust) && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {ingredients.map((ing) => {
                  const low = ing.reorderLevel != null && ing.currentStockQty <= ing.reorderLevel;
                  return (
                    <TableRow key={ing.ingredientId} hover sx={{ opacity: ing.isActive ? 1 : 0.55 }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {ing.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {ing.category ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                          {low && (
                            <Tooltip title={`At or below reorder level (${formatNumber(ing.reorderLevel!)} ${ing.unit})`}>
                              <WarningAmberIcon fontSize="small" color="warning" />
                            </Tooltip>
                          )}
                          <Typography variant="body2">
                            {formatNumber(ing.currentStockQty)} {ing.unit}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{formatCurrency(ing.costPerUnitMinor, currency)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={ing.isActive ? 'Active' : 'Archived'}
                          color={ing.isActive ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      {(canEdit || canAdjust) && (
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                            <PermissionGuard permission="inventory.adjust">
                              <Tooltip title="Adjust stock">
                                <IconButton size="small" onClick={() => setAdjustTarget(ing)}>
                                  <TuneIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </PermissionGuard>
                            <PermissionGuard permission="inventory.edit">
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => setFormTarget(ing)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={ing.isActive ? 'Archive' : 'Restore'}>
                                <IconButton
                                  size="small"
                                  onClick={() => activeMutation.mutate({ ingredientId: ing.ingredientId, isActive: !ing.isActive })}
                                >
                                  {ing.isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                            </PermissionGuard>
                          </Stack>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {formTarget && (
        <IngredientFormDialog
          key={formTarget === 'new' ? 'new' : formTarget.ingredientId}
          open
          ingredient={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
        />
      )}

      {adjustTarget && (
        <AdjustStockDialog
          key={adjustTarget.ingredientId}
          open
          ingredient={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSubmit={handleAdjustSubmit}
        />
      )}
    </Box>
  );
}
