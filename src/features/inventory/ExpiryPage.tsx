import { Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays } from 'date-fns';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatNumber } from '../../utils/money';
import { formatDate, toDate } from '../../utils/dates';
import { listUpcomingExpiry } from '../../services/inventoryService';

const EXPIRING_SOON_DAYS = 7;

function statusFor(expiryDate: ReturnType<typeof toDate>): { label: string; color: 'error' | 'warning' | 'success' } {
  if (!expiryDate) return { label: 'Unknown', color: 'success' };
  const days = differenceInCalendarDays(expiryDate, new Date());
  if (days < 0) return { label: 'Expired', color: 'error' };
  if (days <= EXPIRING_SOON_DAYS) return { label: `Expires in ${days}d`, color: 'warning' };
  return { label: 'OK', color: 'success' };
}

/**
 * Reads purchase-type stock ledger entries with an expiry date set, soonest
 * first. This tracks EXPIRY DATES OF PURCHASES, not remaining quantity per
 * batch — once part of a purchase is used/wasted, this page still shows the
 * original purchased quantity and its expiry date, not what's actually left
 * of that specific batch. True lot/batch consumption tracking (FIFO) is a
 * bigger feature than this phase's scope; see PHASE_4_REPORT.md.
 */
export function ExpiryPage() {
  const { selectedRestaurant } = useRestaurant();
  const restaurantId = selectedRestaurant!.restaurantId;

  const expiryQuery = useQuery({
    queryKey: ['stockExpiry', restaurantId],
    queryFn: () => listUpcomingExpiry(restaurantId),
  });

  if (expiryQuery.isLoading) return <LoadingIndicator label="Loading expiry data…" />;
  if (expiryQuery.isError) {
    return <ErrorState message={toFriendlyErrorMessage(expiryQuery.error)} onRetry={() => expiryQuery.refetch()} />;
  }

  const entries = expiryQuery.data ?? [];

  return (
    <Box>
      <Stack sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Expiry
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Purchases with an expiry date recorded, soonest first. Only purchases where an expiry date was entered
          show up here.
        </Typography>
      </Stack>

      {entries.length === 0 ? (
        <EmptyState
          icon={<EventBusyIcon fontSize="inherit" />}
          title="Nothing to track"
          description="Record an expiry date when logging a purchase (Inventory → Purchases) and it'll show up here."
        />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Ingredient</TableCell>
                  <TableCell align="right">Quantity purchased</TableCell>
                  <TableCell>Purchased</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => {
                  const expiry = toDate(entry.expiryDate);
                  const status = statusFor(expiry);
                  return (
                    <TableRow key={entry.entryId} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {entry.ingredientName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatNumber(entry.quantity)} {entry.unit}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(entry.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(entry.expiryDate)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.vendorName ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={status.label} color={status.color} variant="outlined" />
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
