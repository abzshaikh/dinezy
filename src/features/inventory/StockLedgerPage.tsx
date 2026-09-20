import { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  MenuItem as SelectMenuItem,
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
import { useQuery } from '@tanstack/react-query';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatNumber } from '../../utils/money';
import { formatDateTime } from '../../utils/dates';
import { listIngredients, listRecentStockLedger } from '../../services/inventoryService';
import { WASTE_REASON_LABELS, type StockLedgerEntryType } from '../../types';

const TYPE_LABELS: Record<StockLedgerEntryType, string> = {
  purchase: 'Purchase',
  waste: 'Waste',
  adjustment: 'Adjustment',
};
const TYPE_COLORS: Record<StockLedgerEntryType, 'success' | 'error' | 'default'> = {
  purchase: 'success',
  waste: 'error',
  adjustment: 'default',
};

export function StockLedgerPage() {
  const { selectedRestaurant } = useRestaurant();
  const restaurantId = selectedRestaurant!.restaurantId;

  const [ingredientFilter, setIngredientFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | StockLedgerEntryType>('all');

  const ingredientsQuery = useQuery({
    queryKey: ['ingredients', restaurantId],
    queryFn: () => listIngredients(restaurantId),
  });
  const ledgerQuery = useQuery({
    queryKey: ['stockLedger', restaurantId],
    queryFn: () => listRecentStockLedger(restaurantId),
  });

  const ingredients = ingredientsQuery.data ?? [];
  const entries = useMemo(() => {
    return (ledgerQuery.data ?? []).filter(
      (e) => (ingredientFilter === 'all' || e.ingredientId === ingredientFilter) && (typeFilter === 'all' || e.type === typeFilter),
    );
  }, [ledgerQuery.data, ingredientFilter, typeFilter]);

  if (ledgerQuery.isLoading) return <LoadingIndicator label="Loading stock ledger…" />;
  if (ledgerQuery.isError) {
    return <ErrorState message={toFriendlyErrorMessage(ledgerQuery.error)} onRetry={() => ledgerQuery.refetch()} />;
  }

  const describe = (entry: (typeof entries)[number]) => {
    if (entry.type === 'purchase') return `Purchased${entry.vendorName ? ` from ${entry.vendorName}` : ''}`;
    if (entry.type === 'waste') return entry.wasteReason ? WASTE_REASON_LABELS[entry.wasteReason] : 'Waste';
    return entry.note ?? 'Manual adjustment';
  };

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Stock Ledger
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Every stock movement for {selectedRestaurant?.restaurantName} — purchases, waste, and manual
            adjustments — most recent first. This is a read-only audit trail; entries are never edited.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <TextField
            select
            size="small"
            label="Ingredient"
            value={ingredientFilter}
            onChange={(e) => setIngredientFilter(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <SelectMenuItem value="all">All ingredients</SelectMenuItem>
            {ingredients.map((i) => (
              <SelectMenuItem key={i.ingredientId} value={i.ingredientId}>
                {i.name}
              </SelectMenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            sx={{ minWidth: 140 }}
          >
            <SelectMenuItem value="all">All types</SelectMenuItem>
            {(Object.keys(TYPE_LABELS) as StockLedgerEntryType[]).map((t) => (
              <SelectMenuItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectMenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>

      {entries.length === 0 ? (
        <EmptyState title="No stock movements yet" description="Purchases, waste, and adjustments will show up here as they happen." />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>When</TableCell>
                  <TableCell>Ingredient</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Change</TableCell>
                  <TableCell>Details</TableCell>
                  <TableCell>By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => {
                  const increases = entry.type === 'purchase' || (entry.type === 'adjustment' && entry.adjustmentDirection === 'increase');
                  return (
                    <TableRow key={entry.entryId} hover>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateTime(entry.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {entry.ingredientName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={TYPE_LABELS[entry.type]} color={TYPE_COLORS[entry.type]} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color={increases ? 'success.main' : 'error.main'} sx={{ fontWeight: 600 }}>
                          {increases ? '+' : '-'}
                          {formatNumber(entry.quantity)} {entry.unit}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {describe(entry)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.createdByName}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
