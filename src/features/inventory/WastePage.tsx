import { useMemo, useState } from 'react';
import { Box, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
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
import { formatNumber } from '../../utils/money';
import { formatDate } from '../../utils/dates';
import { listIngredients, listRecentStockLedger, recordWaste } from '../../services/inventoryService';
import { WASTE_REASON_LABELS, type RecordWasteInput } from '../../types';
import { WasteFormDialog } from './WasteFormDialog';

export function WastePage() {
  const { firebaseUser, profile } = useAuth();
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const restaurantId = selectedRestaurant!.restaurantId;

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

  const wasteMutation = useMutation({
    mutationFn: (input: RecordWasteInput) =>
      recordWaste(restaurantId, input, {
        userId: firebaseUser!.uid,
        name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Unknown',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockLedger', restaurantId] });
      queryClient.invalidateQueries({ queryKey: ['ingredients', restaurantId] });
      enqueueSnackbar('Waste recorded.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  const allWasteEntries = useMemo(() => (ledgerQuery.data ?? []).filter((e) => e.type === 'waste'), [ledgerQuery.data]);
  const wasteEntries = useMemo(
    () =>
      allWasteEntries.filter(
        (w) =>
          matchesSearch(w.ingredientName, search) ||
          matchesSearch(w.note, search) ||
          matchesSearch(w.wasteReason ? WASTE_REASON_LABELS[w.wasteReason] : undefined, search),
      ),
    [allWasteEntries, search],
  );
  const activeIngredients = useMemo(() => (ingredientsQuery.data ?? []).filter((i) => i.isActive), [ingredientsQuery.data]);

  if (ledgerQuery.isLoading || ingredientsQuery.isLoading) return <LoadingIndicator label="Loading waste records…" />;
  if (ledgerQuery.isError) {
    return <ErrorState message={toFriendlyErrorMessage(ledgerQuery.error)} onRetry={() => ledgerQuery.refetch()} />;
  }

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Waste
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Recorded spoilage, expiry, and overproduction for {selectedRestaurant?.restaurantName}. Each entry
            reduces stock on hand.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search ingredient, reason, note…" />
          <PermissionGuard permission="waste.create">
            <Button
              variant="contained"
              color="error"
              startIcon={<AddIcon />}
              onClick={() => setFormOpen(true)}
              disabled={activeIngredients.length === 0}
            >
              Record Waste
            </Button>
          </PermissionGuard>
        </Stack>
      </Stack>

      {wasteEntries.length === 0 && allWasteEntries.length === 0 ? (
        <EmptyState
          icon={<DeleteSweepIcon fontSize="inherit" />}
          title="No waste recorded"
          description={
            activeIngredients.length === 0
              ? 'Add an ingredient first, then record waste against it.'
              : 'Nothing wasted yet — good sign.'
          }
          actionLabel={hasPermission('waste.create') && activeIngredients.length > 0 ? 'Record Waste' : undefined}
          onAction={hasPermission('waste.create') && activeIngredients.length > 0 ? () => setFormOpen(true) : undefined}
        />
      ) : wasteEntries.length === 0 ? (
        <EmptyState icon={<DeleteSweepIcon fontSize="inherit" />} title="No waste entries match" description="Try a different search term." />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Ingredient</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell>Reason</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell>Recorded by</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {wasteEntries.map((w) => (
                  <TableRow key={w.entryId} hover>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(w.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {w.ingredientName}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatNumber(w.quantity)} {w.unit}
                    </TableCell>
                    <TableCell>{w.wasteReason && <Chip size="small" label={WASTE_REASON_LABELS[w.wasteReason]} />}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {w.note ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {w.createdByName}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {formOpen && (
        <WasteFormDialog
          open
          ingredients={activeIngredients}
          onClose={() => setFormOpen(false)}
          onSubmit={(values) => wasteMutation.mutateAsync(values)}
        />
      )}
    </Box>
  );
}
