import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { useQuery } from '@tanstack/react-query';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatCard, type StatCardAccent } from '../../components/common/StatCard';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/money';
import { listIngredients } from '../../services/inventoryService';
import { listCategories, listMenuItems } from '../../services/menuService';
import { computeRecipeCostMinor, listRecipes } from '../../services/recipeService';
import { DEFAULT_RESTAURANT_SETTINGS, type Recipe } from '../../types';

export function MenuCostingPage() {
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const navigate = useNavigate();
  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';
  const targetPct = (selectedRestaurant?.settings ?? DEFAULT_RESTAURANT_SETTINGS).targetFoodCostPercent;

  // Same data dependency as the Recipes page (Phase 5) — reading menuItems/
  // ingredients/recipes needs menu.view/inventory.view/recipes.view via
  // firestore.rules, and every role in the fixed table that has
  // recipes.view also has the other two (see ROLE_PERMISSIONS), so gating
  // on recipes.view alone is safe today. Recipe cost/margin has always been
  // recipes.view-gated content (not reports.financial), matching how the
  // Recipes page itself already shows Price/Cost/Margin — this page is the
  // same data, just compared against the target instead of shown per-item.
  const canView = hasPermission('recipes.view');

  const categoriesQuery = useQuery({
    queryKey: ['menuCategories', restaurantId],
    queryFn: () => listCategories(restaurantId),
    enabled: canView,
  });
  const itemsQuery = useQuery({
    queryKey: ['menuItems', restaurantId],
    queryFn: () => listMenuItems(restaurantId),
    enabled: canView,
  });
  const ingredientsQuery = useQuery({
    queryKey: ['ingredients', restaurantId],
    queryFn: () => listIngredients(restaurantId),
    enabled: canView,
  });
  const recipesQuery = useQuery({
    queryKey: ['recipes', restaurantId],
    queryFn: () => listRecipes(restaurantId),
    enabled: canView,
  });

  const categoryById = useMemo(
    () => new Map((categoriesQuery.data ?? []).map((c) => [c.categoryId, c])),
    [categoriesQuery.data],
  );
  const ingredientsById = useMemo(
    () => new Map((ingredientsQuery.data ?? []).map((i) => [i.ingredientId, i])),
    [ingredientsQuery.data],
  );
  const recipeByMenuItemId = useMemo(
    () => new Map((recipesQuery.data ?? []).map((r) => [r.menuItemId, r])),
    [recipesQuery.data],
  );
  const activeItems = useMemo(() => (itemsQuery.data ?? []).filter((i) => i.isActive), [itemsQuery.data]);

  const rows = useMemo(
    () =>
      activeItems.map((item) => {
        const recipe: Recipe | undefined = recipeByMenuItemId.get(item.itemId);
        const hasRecipe = !!recipe;
        const costMinor = computeRecipeCostMinor(recipe, ingredientsById);
        const foodCostPct = hasRecipe && item.priceMinor > 0 ? (costMinor / item.priceMinor) * 100 : null;
        const overTarget = foodCostPct !== null && foodCostPct > targetPct;
        return { item, hasRecipe, costMinor, foodCostPct, overTarget };
      }),
    [activeItems, recipeByMenuItemId, ingredientsById, targetPct],
  );

  const priced = useMemo(() => rows.filter((r) => r.foodCostPct !== null), [rows]);
  const missingRecipeCount = rows.length - priced.length;
  const overTargetCount = priced.filter((r) => r.overTarget).length;

  // Blended food cost %: total recipe cost across priced items divided by
  // total price — NOT sales-weighted (that would need Daily Sales volume
  // per item, a future enhancement). This answers "if I sold one of each
  // priced item, what's my overall food cost %", not "what was it based on
  // what actually sold".
  const blendedPct = useMemo(() => {
    const totalPrice = priced.reduce((sum, r) => sum + r.item.priceMinor, 0);
    const totalCost = priced.reduce((sum, r) => sum + r.costMinor, 0);
    return totalPrice > 0 ? (totalCost / totalPrice) * 100 : 0;
  }, [priced]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.foodCostPct === null && b.foodCostPct === null) return 0;
        if (a.foodCostPct === null) return 1; // no-recipe rows sink to the bottom
        if (b.foodCostPct === null) return -1;
        return b.foodCostPct - a.foodCostPct; // worst (highest food cost %) first
      }),
    [rows],
  );

  if (!canView) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          Menu Costing
        </Typography>
        <Alert severity="info">Ask an owner for recipe access to see this page.</Alert>
      </Box>
    );
  }

  const anyLoading = categoriesQuery.isLoading || itemsQuery.isLoading || ingredientsQuery.isLoading || recipesQuery.isLoading;
  if (anyLoading) return <LoadingIndicator label="Loading menu costing…" />;
  const failedQuery = [categoriesQuery, itemsQuery, ingredientsQuery, recipesQuery].find((q) => q.isError);
  if (failedQuery) {
    return <ErrorState message={toFriendlyErrorMessage(failedQuery.error)} onRetry={() => failedQuery.refetch()} />;
  }

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Menu Costing
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Every priced item's food cost %, measured against your target of {targetPct}%.
          </Typography>
        </Box>
        {hasPermission('restaurant.settings') && (
          <Button size="small" variant="outlined" onClick={() => navigate('/app/restaurant/profile')}>
            Change target in Settings
          </Button>
        )}
      </Stack>

      {activeItems.length === 0 ? (
        <EmptyState
          icon={<TrendingUpIcon fontSize="inherit" />}
          title="No menu items yet"
          description="Add menu items first (Menu → Menu Items), then build their recipes to see costing here."
        />
      ) : (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Target food cost"
                value={targetPct}
                format={(v) => `${v.toFixed(1)}%`}
                icon={<GpsFixedRoundedIcon fontSize="small" />}
                accent="accent"
                caption="Set on Restaurant Profile"
                index={0}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Blended food cost"
                value={priced.length > 0 ? blendedPct : 0}
                format={(v) => (priced.length > 0 ? `${v.toFixed(1)}%` : '—')}
                icon={<ReceiptLongRoundedIcon fontSize="small" />}
                accent={(priced.length > 0 ? (blendedPct > targetPct ? 'critical' : 'positive') : 'accent') as StatCardAccent}
                caption="Across priced items, not sales-weighted"
                index={1}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Items over target"
                value={overTargetCount}
                format={(v) => `${Math.round(v)} / ${priced.length}`}
                icon={<WarningAmberRoundedIcon fontSize="small" />}
                accent={overTargetCount > 0 ? 'critical' : 'positive'}
                caption={priced.length > 0 ? `${((overTargetCount / priced.length) * 100).toFixed(0)}% of priced items` : undefined}
                index={2}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="No recipe yet"
                value={missingRecipeCount}
                format={(v) => String(Math.round(v))}
                icon={<HelpOutlineRoundedIcon fontSize="small" />}
                accent="accent"
                caption="Excluded from the figures above"
                index={3}
              />
            </Grid>
          </Grid>

          {missingRecipeCount > 0 && (
            <Alert severity="info">
              {missingRecipeCount} active item{missingRecipeCount === 1 ? '' : 's'} {missingRecipeCount === 1 ? "doesn't" : "don't"}{' '}
              have a recipe yet, so {missingRecipeCount === 1 ? "it isn't" : "they aren't"} included above. Add one on the Recipes
              page.
            </Alert>
          )}

          <Paper variant="outlined">
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Recipe Cost</TableCell>
                    <TableCell align="right">Food Cost %</TableCell>
                    <TableCell align="right">vs Target</TableCell>
                    <TableCell align="right">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedRows.map(({ item, hasRecipe, costMinor, foodCostPct, overTarget }) => (
                    <TableRow key={item.itemId} hover sx={{ opacity: hasRecipe ? 1 : 0.6 }}>
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
                        {hasRecipe ? formatCurrency(costMinor, currency) : <Chip size="small" label="No recipe" variant="outlined" />}
                      </TableCell>
                      <TableCell align="right">
                        {foodCostPct !== null ? (
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600 }}
                            color={overTarget ? 'error.main' : 'success.main'}
                          >
                            {foodCostPct.toFixed(1)}%
                          </Typography>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {foodCostPct !== null ? (
                          <Typography variant="body2" color={overTarget ? 'error.main' : 'text.secondary'}>
                            {foodCostPct - targetPct >= 0 ? '+' : ''}
                            {(foodCostPct - targetPct).toFixed(1)} pts
                          </Typography>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {foodCostPct !== null ? (
                          <Chip
                            size="small"
                            label={overTarget ? 'Over Target' : 'On Target'}
                            color={overTarget ? 'error' : 'success'}
                            variant={overTarget ? 'filled' : 'outlined'}
                          />
                        ) : (
                          <Chip size="small" label="No data" variant="outlined" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
