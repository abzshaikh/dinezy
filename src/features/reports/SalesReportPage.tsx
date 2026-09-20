import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
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
  TextField,
  Typography,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ShoppingBasketRoundedIcon from '@mui/icons-material/ShoppingBasketRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatCard } from '../../components/common/StatCard';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency, formatNumber } from '../../utils/money';
import { listDailySales } from '../../services/salesService';
import { listExpensesForDate } from '../../services/expenseService';

export function SalesReportPage() {
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';
  const canSeeFinancials = hasPermission('reports.financial');
  const canSeeExpenses = canSeeFinancials && hasPermission('expense.view');

  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const salesQuery = useQuery({ queryKey: ['dailySales', restaurantId, date], queryFn: () => listDailySales(restaurantId, date) });
  // Only queried when the viewer can actually see expenses — folding a
  // permission-denied collection into "Net Profit" would either crash the
  // page or require a confusing partial-error UI, so this section is
  // skipped entirely (not shown as an error) for anyone without expense.view.
  const expensesQuery = useQuery({
    queryKey: ['expensesForDate', restaurantId, date],
    queryFn: () => listExpensesForDate(restaurantId, date),
    enabled: canSeeExpenses,
  });

  const entries = useMemo(() => (salesQuery.data ?? []).filter((e) => e.quantitySold > 0), [salesQuery.data]);
  const mostSold = useMemo(() => [...entries].sort((a, b) => b.quantitySold - a.quantitySold), [entries]);
  const mostProfitable = useMemo(
    () => entries.filter((e) => e.hasRecipe).sort((a, b) => b.profitMinor - a.profitMinor),
    [entries],
  );
  const missingRecipeCount = entries.filter((e) => !e.hasRecipe).length;

  const totals = useMemo(
    () =>
      entries.reduce(
        (acc, e) => ({
          quantity: acc.quantity + e.quantitySold,
          revenueMinor: acc.revenueMinor + e.revenueMinor,
          costMinor: acc.costMinor + e.costMinor,
          profitMinor: acc.profitMinor + e.profitMinor,
        }),
        { quantity: 0, revenueMinor: 0, costMinor: 0, profitMinor: 0 },
      ),
    [entries],
  );

  const totalExpensesMinor = useMemo(
    () => (expensesQuery.data ?? []).filter((e) => !e.isVoided).reduce((sum, e) => sum + e.amountMinor, 0),
    [expensesQuery.data],
  );
  const netProfitMinor = totals.profitMinor - totalExpensesMinor;

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Sales Report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Most items sold and most profitable items for one day, from what's entered on the Daily Sales page.
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

      {salesQuery.isLoading ? (
        <LoadingIndicator label="Loading sales…" />
      ) : salesQuery.isError ? (
        <ErrorState message={toFriendlyErrorMessage(salesQuery.error)} onRetry={() => salesQuery.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<AssessmentIcon fontSize="inherit" />}
          title="No sales recorded for this day"
          description="Enter quantities sold on the Daily Sales page and they'll show up here."
        />
      ) : (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Items sold"
                value={totals.quantity}
                format={(v) => formatNumber(v, 0)}
                icon={<ShoppingBasketRoundedIcon fontSize="small" />}
                accent="accent"
                index={0}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Revenue"
                value={totals.revenueMinor}
                format={(v) => formatCurrency(v, currency)}
                icon={<PaidRoundedIcon fontSize="small" />}
                accent="accent"
                index={1}
              />
            </Grid>
            {canSeeFinancials && (
              <>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <StatCard
                    label="Food cost"
                    value={totals.costMinor}
                    format={(v) => formatCurrency(v, currency)}
                    icon={<ReceiptLongRoundedIcon fontSize="small" />}
                    accent="warning"
                    caption={missingRecipeCount > 0 ? `Excludes ${missingRecipeCount} item(s) with no recipe` : undefined}
                    index={2}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <StatCard
                    label="Gross profit"
                    value={totals.profitMinor}
                    format={(v) => formatCurrency(v, currency)}
                    icon={<TrendingUpRoundedIcon fontSize="small" />}
                    accent="positive"
                    caption="Revenue minus food cost — before other expenses"
                    index={3}
                  />
                </Grid>
              </>
            )}
            {canSeeExpenses && (
              <>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <StatCard
                    label="Expenses"
                    value={expensesQuery.isLoading ? 0 : totalExpensesMinor}
                    format={(v) => formatCurrency(v, currency)}
                    icon={<AccountBalanceWalletRoundedIcon fontSize="small" />}
                    accent="warning"
                    caption="Recorded for this day"
                    index={4}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <StatCard
                    label="Net profit"
                    value={expensesQuery.isLoading ? 0 : netProfitMinor}
                    format={(v) => formatCurrency(v, currency)}
                    icon={<SavingsRoundedIcon fontSize="small" />}
                    accent="positive"
                    caption="Gross profit minus this day's expenses"
                    index={5}
                  />
                </Grid>
              </>
            )}
          </Grid>

          {missingRecipeCount > 0 && canSeeFinancials && (
            <Alert severity="info">
              {missingRecipeCount} item{missingRecipeCount === 1 ? '' : 's'} sold today {missingRecipeCount === 1 ? 'has' : 'have'} no
              recipe defined, so {missingRecipeCount === 1 ? 'its' : 'their'} cost/profit isn't included above or in the "Most
              Profitable" list. Add a recipe on the Recipes page to include it.
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: canSeeFinancials ? 6 : 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Most Items Sold
              </Typography>
              <Paper variant="outlined">
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Revenue</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {mostSold.map((e, i) => (
                        <TableRow key={e.entryId} hover>
                          <TableCell>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              {i === 0 && <Chip size="small" color="success" label="#1" />}
                              <Typography variant="body2" sx={{ fontWeight: i === 0 ? 700 : 400 }}>
                                {e.menuItemName}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">{formatNumber(e.quantitySold, 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(e.revenueMinor, currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            {canSeeFinancials && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Most Profitable Items
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  By food-cost profit per item — not the day's net profit above, which also subtracts expenses.
                </Typography>
                <Paper variant="outlined">
                  {mostProfitable.length === 0 ? (
                    <Box sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        None of today's sold items have a recipe yet, so profit can't be ranked.
                      </Typography>
                    </Box>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Item</TableCell>
                            <TableCell align="right">Profit</TableCell>
                            <TableCell align="right">Margin</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {mostProfitable.map((e, i) => {
                            const marginPct = e.revenueMinor > 0 ? (e.profitMinor / e.revenueMinor) * 100 : 0;
                            return (
                              <TableRow key={e.entryId} hover>
                                <TableCell>
                                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                    {i === 0 && <Chip size="small" color="success" label="#1" />}
                                    <Typography variant="body2" sx={{ fontWeight: i === 0 ? 700 : 400 }}>
                                      {e.menuItemName}
                                    </Typography>
                                  </Stack>
                                </TableCell>
                                <TableCell align="right">{formatCurrency(e.profitMinor, currency)}</TableCell>
                                <TableCell align="right">{marginPct.toFixed(0)}%</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Paper>
              </Grid>
            )}
          </Grid>

          {!canSeeFinancials && (
            <Alert severity="info">
              Cost and profit figures are hidden — ask an owner for financial reporting access to see the "Most
              Profitable" ranking.
            </Alert>
          )}
        </Stack>
      )}
    </Box>
  );
}
