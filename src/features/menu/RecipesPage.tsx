import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
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
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuBookIcon from '@mui/icons-material/MenuBook';
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
import { listIngredients } from '../../services/inventoryService';
import { listCategories, listMenuItems } from '../../services/menuService';
import { computeRecipeCostMinor, deleteRecipe, listRecipes, saveRecipe } from '../../services/recipeService';
import type { MenuItem, Recipe } from '../../types';
import { RecipeFormDialog, type RecipeFormResult } from './RecipeFormDialog';

export function RecipesPage() {
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';

  const [formTarget, setFormTarget] = useState<MenuItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);
  const [search, setSearch] = useState('');

  const categoriesQuery = useQuery({ queryKey: ['menuCategories', restaurantId], queryFn: () => listCategories(restaurantId) });
  const itemsQuery = useQuery({ queryKey: ['menuItems', restaurantId], queryFn: () => listMenuItems(restaurantId) });
  const ingredientsQuery = useQuery({ queryKey: ['ingredients', restaurantId], queryFn: () => listIngredients(restaurantId) });
  const recipesQuery = useQuery({ queryKey: ['recipes', restaurantId], queryFn: () => listRecipes(restaurantId) });

  const invalidateRecipes = () => queryClient.invalidateQueries({ queryKey: ['recipes', restaurantId] });

  const categoryById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.categoryId, c])),
    [categoriesQuery.data],
  );
  const ingredientsById = useMemo(
    () => new Map((ingredientsQuery.data ?? []).map((i) => [i.ingredientId, i])),
    [ingredientsQuery.data],
  );
  const activeIngredients = useMemo(() => (ingredientsQuery.data ?? []).filter((i) => i.isActive), [ingredientsQuery.data]);
  const recipeByMenuItemId = useMemo(
    () => new Map((recipesQuery.data ?? []).map((r) => [r.menuItemId, r])),
    [recipesQuery.data],
  );
  const activeItems = useMemo(() => (itemsQuery.data ?? []).filter((i) => i.isActive), [itemsQuery.data]);
  const items = useMemo(
    () => activeItems.filter((i) => matchesSearch(i.name, search) || matchesSearch(categoryById.get(i.categoryId)?.name, search)),
    [activeItems, search, categoryById],
  );

  const saveMutation = useMutation({
    mutationFn: ({ item, values }: { item: MenuItem; values: RecipeFormResult }) =>
      saveRecipe(restaurantId, { menuItemId: item.itemId, menuItemName: item.name, lines: values.lines }, ingredientsById),
    onSuccess: () => {
      invalidateRecipes();
      enqueueSnackbar('Recipe saved.', { variant: 'success' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (menuItemId: string) => deleteRecipe(restaurantId, menuItemId),
    onSuccess: () => {
      invalidateRecipes();
      enqueueSnackbar('Recipe removed.', { variant: 'success' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' });
      setDeleteTarget(null);
    },
  });

  const anyLoading = categoriesQuery.isLoading || itemsQuery.isLoading || ingredientsQuery.isLoading || recipesQuery.isLoading;
  if (anyLoading) return <LoadingIndicator label="Loading recipes…" />;
  const failedQuery = [categoriesQuery, itemsQuery, ingredientsQuery, recipesQuery].find((q) => q.isError);
  if (failedQuery) {
    return <ErrorState message={toFriendlyErrorMessage(failedQuery.error)} onRetry={() => failedQuery.refetch()} />;
  }

  const canEdit = hasPermission('recipes.edit');

  const handleFormSubmit = async (values: RecipeFormResult) => {
    if (!formTarget) return;
    await saveMutation.mutateAsync({ item: formTarget, values });
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ maxWidth: 640 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Recipes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Map each menu item to the ingredients (and quantities) it uses, to see its food cost and margin. Recipe
            cost updates live as ingredient prices change — see PHASE_5_REPORT.md for what "live" means here. Selling
            an item does NOT deduct ingredient stock; stock stays entirely under your manual Inventory adjustments.
          </Typography>
        </Box>
        <SearchField value={search} onChange={setSearch} placeholder="Search menu items…" />
      </Stack>

      {activeItems.length === 0 ? (
        <EmptyState
          icon={<MenuBookIcon fontSize="inherit" />}
          title="No menu items yet"
          description="Add menu items first (Menu → Menu Items), then come back here to build their recipes."
        />
      ) : items.length === 0 ? (
        <EmptyState icon={<MenuBookIcon fontSize="inherit" />} title="No items match" description="Try a different search term." />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Recipe Cost</TableCell>
                  <TableCell align="right">Margin</TableCell>
                  <TableCell>Ingredients</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const recipe: Recipe | undefined = recipeByMenuItemId.get(item.itemId);
                  const costMinor = computeRecipeCostMinor(recipe, ingredientsById);
                  const margin = item.priceMinor - costMinor;
                  const marginPct = item.priceMinor > 0 ? (margin / item.priceMinor) * 100 : 0;
                  return (
                    <TableRow key={item.itemId} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {categoryById.get(item.categoryId)?.name ?? 'Uncategorized'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{formatCurrency(item.priceMinor, currency)}</TableCell>
                      <TableCell align="right">
                        {recipe ? (
                          formatCurrency(costMinor, currency)
                        ) : (
                          <Chip size="small" label="No recipe" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {recipe ? (
                          <Typography variant="body2" color={margin >= 0 ? 'success.main' : 'error.main'} sx={{ fontWeight: 600 }}>
                            {formatCurrency(margin, currency)} ({marginPct.toFixed(0)}%)
                          </Typography>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {recipe ? `${recipe.lines.length} ingredient${recipe.lines.length === 1 ? '' : 's'}` : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                          <PermissionGuard permission="recipes.edit">
                            <Tooltip title={recipe ? 'Edit recipe' : 'Add recipe'}>
                              <Button size="small" startIcon={<EditIcon fontSize="small" />} onClick={() => setFormTarget(item)}>
                                {recipe ? 'Edit' : 'Add'}
                              </Button>
                            </Tooltip>
                          </PermissionGuard>
                          {recipe && (
                            <PermissionGuard permission="recipes.edit">
                              <Tooltip title="Remove recipe">
                                <Button size="small" color="error" onClick={() => setDeleteTarget(item)}>
                                  <DeleteIcon fontSize="small" />
                                </Button>
                              </Tooltip>
                            </PermissionGuard>
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

      {formTarget && canEdit && (
        <RecipeFormDialog
          key={formTarget.itemId}
          open
          menuItem={formTarget}
          recipe={recipeByMenuItemId.get(formTarget.itemId) ?? null}
          ingredients={activeIngredients}
          ingredientsById={ingredientsById}
          onClose={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this recipe?"
        description={`"${deleteTarget?.name}" will no longer have a defined recipe — its cost and margin will show as unknown until you add one again. This doesn't affect any past Daily Sales numbers, which already have their own snapshot.`}
        confirmLabel="Remove"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.itemId)}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
