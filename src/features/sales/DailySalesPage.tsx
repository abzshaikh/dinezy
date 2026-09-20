import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchField, matchesSearch } from '../../components/common/SearchField';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/money';
import { listIngredients } from '../../services/inventoryService';
import { listMenuItems } from '../../services/menuService';
import { computeRecipeCostMinor, listRecipes } from '../../services/recipeService';
import { listDailySales, saveDailySales } from '../../services/salesService';
import type { DailySalesEntry, DailySalesLineInput, MenuItem, Recipe } from '../../types';

interface DailySalesGridProps {
  date: string;
  items: MenuItem[];
  existingByItemId: Map<string, DailySalesEntry>;
  currency: string;
  canEdit: boolean;
  saving: boolean;
  onSave: (quantities: Record<string, string>) => void;
}

/**
 * Keyed by `date` in the parent (see the app's established "remount via key
 * instead of useEffect+setState" pattern) so each date's initial input
 * values come straight from that day's already-loaded query result at
 * mount time, with no effect needed to re-sync state when the date changes.
 */
function DailySalesGrid({ date, items, existingByItemId, currency, canEdit, saving, onSave }: DailySalesGridProps) {
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const item of items) {
      const existing = existingByItemId.get(item.itemId);
      if (existing) init[item.itemId] = String(existing.quantitySold);
    }
    return init;
  });
  // Search only narrows which rows are SHOWN — `items` (the full menu) stays
  // what onSave iterates over, so a quantity typed for an item that then
  // gets hidden by a search edit is never silently dropped.
  const [search, setSearch] = useState('');
  const visibleItems = items.filter((item) => matchesSearch(item.name, search));

  return (
    <Paper variant="outlined">
      <Box sx={{ p: 2, pb: 0 }}>
        <SearchField value={search} onChange={setSearch} placeholder="Search menu items…" />
      </Box>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell align="right">Quantity sold</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    No items match "{search}".
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visibleItems.map((item) => (
              <TableRow key={item.itemId} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.name}
                  </Typography>
                </TableCell>
                <TableCell align="right">{formatCurrency(item.priceMinor, currency)}</TableCell>
                <TableCell align="right" sx={{ width: 160 }}>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    disabled={!canEdit}
                    placeholder="—"
                    slotProps={{ htmlInput: { step: 'any', min: 0 } }}
                    value={quantities[item.itemId] ?? ''}
                    onChange={(e) => setQuantities((q) => ({ ...q, [item.itemId]: e.target.value }))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {canEdit && (
        <Stack direction="row" sx={{ justifyContent: 'flex-end', p: 2 }}>
          <Button variant="contained" disabled={saving} onClick={() => onSave(quantities)}>
            {saving ? 'Saving…' : `Save ${format(new Date(`${date}T00:00:00`), 'dd MMM')}`}
          </Button>
        </Stack>
      )}
    </Paper>
  );
}

export function DailySalesPage() {
  const { firebaseUser, profile } = useAuth();
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const itemsQuery = useQuery({ queryKey: ['menuItems', restaurantId], queryFn: () => listMenuItems(restaurantId) });
  const ingredientsQuery = useQuery({ queryKey: ['ingredients', restaurantId], queryFn: () => listIngredients(restaurantId) });
  const recipesQuery = useQuery({ queryKey: ['recipes', restaurantId], queryFn: () => listRecipes(restaurantId) });
  const salesQuery = useQuery({ queryKey: ['dailySales', restaurantId, date], queryFn: () => listDailySales(restaurantId, date) });

  const saveMutation = useMutation({
    mutationFn: (lines: DailySalesLineInput[]) =>
      saveDailySales(restaurantId, date, lines, {
        userId: firebaseUser!.uid,
        name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Unknown',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailySales', restaurantId, date] });
      enqueueSnackbar('Daily sales saved.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  const items = useMemo(() => (itemsQuery.data ?? []).filter((i) => i.isActive), [itemsQuery.data]);
  const ingredientsById = useMemo(
    () => new Map((ingredientsQuery.data ?? []).map((i) => [i.ingredientId, i])),
    [ingredientsQuery.data],
  );
  const recipeByMenuItemId = useMemo(
    () => new Map((recipesQuery.data ?? []).map((r) => [r.menuItemId, r])),
    [recipesQuery.data],
  );
  const existingByItemId = useMemo(
    () => new Map((salesQuery.data ?? []).map((e) => [e.menuItemId, e])),
    [salesQuery.data],
  );

  const anyLoading = itemsQuery.isLoading || ingredientsQuery.isLoading || recipesQuery.isLoading || salesQuery.isLoading;
  const failedQuery = [itemsQuery, ingredientsQuery, recipesQuery, salesQuery].find((q) => q.isError);

  const canEdit = hasPermission('orders.create');

  const handleSave = (quantities: Record<string, string>) => {
    const lines: DailySalesLineInput[] = [];
    for (const item of items) {
      const raw = quantities[item.itemId];
      if (raw === undefined || raw.trim() === '') continue; // untouched — leave that day's existing entry alone
      const quantitySold = Number(raw);
      if (!Number.isFinite(quantitySold) || quantitySold < 0) continue;
      const recipe: Recipe | undefined = recipeByMenuItemId.get(item.itemId);
      const hasRecipe = !!recipe && recipe.lines.length > 0;
      lines.push({
        menuItemId: item.itemId,
        menuItemName: item.name,
        quantitySold,
        unitPriceMinor: item.priceMinor,
        unitCostMinor: hasRecipe ? computeRecipeCostMinor(recipe, ingredientsById) : 0,
        hasRecipe,
      });
    }
    if (lines.length === 0) {
      enqueueSnackbar('Enter a quantity for at least one item first.', { variant: 'info' });
      return;
    }
    saveMutation.mutate(lines);
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Daily Sales
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter how many of each item sold on the selected day. Leave a field blank to leave that day's number
            unchanged; enter 0 to explicitly record that nothing sold. This does not touch ingredient stock —
            record your stock counts as usual under Inventory.
          </Typography>
        </Box>
        <TextField
          type="date"
          label="Date"
          size="small"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: format(new Date(), 'yyyy-MM-dd') } }}
        />
      </Stack>

      {anyLoading ? (
        <LoadingIndicator label="Loading…" />
      ) : failedQuery ? (
        <ErrorState message={toFriendlyErrorMessage(failedQuery.error)} onRetry={() => failedQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<PointOfSaleIcon fontSize="inherit" />}
          title="No menu items yet"
          description="Add menu items first (Menu → Menu Items), then come back here to log daily sales."
        />
      ) : (
        <>
          {!canEdit && (
            <Alert severity="info" sx={{ mb: 2 }}>
              You have view access only — ask an owner or manager to grant you sales entry permission to record
              numbers here.
            </Alert>
          )}
          <DailySalesGrid
            key={date}
            date={date}
            items={items}
            existingByItemId={existingByItemId}
            currency={currency}
            canEdit={canEdit}
            saving={saveMutation.isPending}
            onSave={handleSave}
          />
        </>
      )}
    </Box>
  );
}
