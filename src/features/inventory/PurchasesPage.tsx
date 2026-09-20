import { useMemo, useState } from 'react';
import { Box, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
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
import { formatDate } from '../../utils/dates';
import { listIngredients, listRecentStockLedger, recordPurchase } from '../../services/inventoryService';
import type { RecordPurchaseInput } from '../../types';
import { PurchaseFormDialog } from './PurchaseFormDialog';

export function PurchasesPage() {
  const { firebaseUser, profile } = useAuth();
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';

  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');

  const ingredientsQuery = useQuery({
    queryKey: ['ingredients', restaurantId],
    queryFn: () => listIngredients(restaurantId),
  });
  const ledgerQuery = useQuery({
    queryKey: ['stockLedger', restaurantId],
    queryFn: () => listRecentStockLedger(restaurantId),
  });

  const purchaseMutation = useMutation({
    mutationFn: (input: RecordPurchaseInput) =>
      recordPurchase(restaurantId, input, {
        userId: firebaseUser!.uid,
        name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Unknown',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockLedger', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['ingredients', restaurantId] });
      enqueueSnackbar('Purchase recorded.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  const allPurchases = useMemo(() => (ledgerQuery.data ?? []).filter((e) => e.type === 'purchase'), [ledgerQuery.data]);
  const purchases = useMemo(
    () => allPurchases.filter((p) => matchesSearch(p.ingredientName, search) || matchesSearch(p.vendorName, search)),
    [allPurchases, search],
  );
  const activeIngredients = useMemo(() => (ingredientsQuery.data ?? []).filter((i) => i.isActive), [ingredientsQuery.data]);

  if (ledgerQuery.isLoading || ingredientsQuery.isLoading) return <LoadingIndicator label="Loading purchases…" />;
  if (ledgerQuery.isError) {
    return <ErrorState message={toFriendlyErrorMessage(ledgerQuery.error)} onRetry={() => ledgerQuery.refetch()} />;
  }

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Purchases
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Recent ingredient purchases for {selectedRestaurant?.restaurantName}. Each one updates stock on hand and
            the ingredient's cost per unit.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search ingredient, vendor…" />
          <PermissionGuard permission="purchase.create">
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)} disabled={activeIngredients.length === 0}>
              Record Purchase
            </Button>
          </PermissionGuard>
        </Stack>
      </Stack>

      {purchases.length === 0 && allPurchases.length === 0 ? (
        <EmptyState
          icon={<ShoppingCartIcon fontSize="inherit" />}
          title="No purchases recorded yet"
          description={
            activeIngredients.length === 0
              ? 'Add an ingredient first, then record purchases against it.'
              : 'Record your first purchase to start tracking stock and cost.'
          }
          actionLabel={hasPermission('purchase.create') && activeIngredients.length > 0 ? 'Record Purchase' : undefined}
          onAction={hasPermission('purchase.create') && activeIngredients.length > 0 ? () => setFormOpen(true) : undefined}
        />
      ) : purchases.length === 0 ? (
        <EmptyState icon={<ShoppingCartIcon fontSize="inherit" />} title="No purchases match" description="Try a different search term." />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Ingredient</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell align="right">Unit cost</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Expiry</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.entryId} hover>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(p.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {p.ingredientName}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatNumber(p.quantity)} {p.unit}
                    </TableCell>
                    <TableCell align="right">{formatCurrency(p.unitCostMinor ?? 0, currency)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatCurrency(p.totalCostMinor ?? 0, currency)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {p.vendorName ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {p.expiryDate ? (
                        <Chip size="small" variant="outlined" label={formatDate(p.expiryDate)} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {formOpen && (
        <PurchaseFormDialog
          open
          ingredients={activeIngredients}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => purchaseMutation.mutateAsync(values)}
        />
      )}
    </Box>
  );
}
