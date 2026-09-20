import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
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
  MenuItem as SelectMenuItem,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
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
import { resolveDateRangePreset, type DateRangePreset } from '../../utils/dates';
import { listDailySalesForRange } from '../../services/salesService';
import { listExpensesForRange } from '../../services/expenseService';
import { exportPnLToCsv, exportPnLToPdf, type PnLExportData } from './pnlExport';

type RangeChoice = Exclude<DateRangePreset, 'yesterday'> | 'custom';

const RANGE_PRESETS: { value: RangeChoice; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom range' },
];

function LineRow({
  label,
  value,
  currency,
  bold,
  indent,
  negative,
}: {
  label: string;
  value: number;
  currency: string;
  bold?: boolean;
  indent?: boolean;
  negative?: boolean;
}) {
  return (
    <Stack
      direction="row"
      sx={{ justifyContent: 'space-between', py: 0.75, pl: indent ? 2 : 0 }}
    >
      <Typography variant="body2" sx={{ fontWeight: bold ? 700 : 400 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: bold ? 700 : 400 }}>
        {negative && value !== 0 ? `(${formatCurrency(value, currency)})` : formatCurrency(value, currency)}
      </Typography>
    </Stack>
  );
}

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

export function PnLPage() {
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';
  const canSeeFinancials = hasPermission('reports.financial');
  const canSeeExpenses = hasPermission('expense.view');

  const [rangeChoice, setRangeChoice] = useState<RangeChoice>('thisMonth');
  const [customStart, setCustomStart] = useState(() => format(new Date(), 'yyyy-MM-01'));
  const [customEnd, setCustomEnd] = useState(todayStr);

  const { startDate, endDate } = useMemo(() => {
    if (rangeChoice === 'custom') {
      // Guard against an inverted range (end before start) rather than sending a query that can never match.
      return customEnd >= customStart
        ? { startDate: customStart, endDate: customEnd }
        : { startDate: customEnd, endDate: customStart };
    }
    const { start, end } = resolveDateRangePreset(rangeChoice);
    return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') };
  }, [rangeChoice, customStart, customEnd]);

  const salesQuery = useQuery({
    queryKey: ['dailySalesRange', restaurantId, startDate, endDate],
    queryFn: () => listDailySalesForRange(restaurantId, startDate, endDate),
    enabled: canSeeFinancials,
  });
  const expensesQuery = useQuery({
    queryKey: ['expensesRange', restaurantId, startDate, endDate],
    queryFn: () => listExpensesForRange(restaurantId, startDate, endDate),
    enabled: canSeeFinancials && canSeeExpenses,
  });

  const entries = useMemo(() => (salesQuery.data ?? []).filter((e) => e.quantitySold > 0), [salesQuery.data]);
  const missingRecipeCount = useMemo(() => entries.filter((e) => !e.hasRecipe).length, [entries]);

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

  const activeExpenses = useMemo(() => (expensesQuery.data ?? []).filter((e) => !e.isVoided), [expensesQuery.data]);
  const totalExpensesMinor = useMemo(() => activeExpenses.reduce((sum, e) => sum + e.amountMinor, 0), [activeExpenses]);

  const expensesByCategory = useMemo(() => {
    const byCategory = new Map<string, { categoryName: string; totalMinor: number; count: number }>();
    for (const e of activeExpenses) {
      const existing = byCategory.get(e.categoryId);
      if (existing) {
        existing.totalMinor += e.amountMinor;
        existing.count += 1;
      } else {
        byCategory.set(e.categoryId, { categoryName: e.categoryName, totalMinor: e.amountMinor, count: 1 });
      }
    }
    return [...byCategory.values()].sort((a, b) => b.totalMinor - a.totalMinor);
  }, [activeExpenses]);

  const grossMarginPct = totals.revenueMinor > 0 ? (totals.profitMinor / totals.revenueMinor) * 100 : 0;
  const netProfitMinor = totals.profitMinor - totalExpensesMinor;
  const netMarginPct = totals.revenueMinor > 0 ? (netProfitMinor / totals.revenueMinor) * 100 : 0;

  // Mirrors exactly what the Statement card below renders — see pnlExport.ts.
  const exportData: PnLExportData = {
    restaurantName: selectedRestaurant?.restaurantName ?? 'Restaurant',
    currency,
    startDate,
    endDate,
    revenueMinor: totals.revenueMinor,
    costMinor: totals.costMinor,
    grossProfitMinor: totals.profitMinor,
    grossMarginPct,
    canSeeExpenses,
    expensesByCategory,
    totalExpensesMinor,
    netProfitMinor,
    netMarginPct,
  };

  if (!canSeeFinancials) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          Profit &amp; Loss
        </Typography>
        <Alert severity="info">Ask an owner for financial reporting access to see this report.</Alert>
      </Box>
    );
  }

  const anyLoading = salesQuery.isLoading || (canSeeExpenses && expensesQuery.isLoading);
  const failedQuery = [salesQuery, canSeeExpenses ? expensesQuery : null].find((q) => q?.isError);

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Profit &amp; Loss
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Revenue, food cost, and expenses over a date range, for {selectedRestaurant?.restaurantName}.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
          <TextField
            select
            size="small"
            label="Range"
            value={rangeChoice}
            onChange={(e) => setRangeChoice(e.target.value as RangeChoice)}
            sx={{ minWidth: 160 }}
          >
            {RANGE_PRESETS.map((p) => (
              <SelectMenuItem key={p.value} value={p.value}>
                {p.label}
              </SelectMenuItem>
            ))}
          </TextField>
          {rangeChoice === 'custom' && (
            <>
              <TextField
                type="date"
                label="From"
                size="small"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayStr() } }}
              />
              <TextField
                type="date"
                label="To"
                size="small"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayStr() } }}
              />
            </>
          )}
        </Stack>
      </Stack>

      {anyLoading ? (
        <LoadingIndicator label="Loading P&L…" />
      ) : failedQuery ? (
        <ErrorState message={toFriendlyErrorMessage(failedQuery.error)} onRetry={() => failedQuery.refetch()} />
      ) : entries.length === 0 && activeExpenses.length === 0 ? (
        <EmptyState
          icon={<AccountBalanceIcon fontSize="inherit" />}
          title="Nothing recorded in this range"
          description="Enter Daily Sales and/or Expenses for these dates and they'll show up here."
        />
      ) : (
        <Stack spacing={3}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {format(new Date(`${startDate}T00:00:00`), 'dd MMM yyyy')} –{' '}
              {format(new Date(`${endDate}T00:00:00`), 'dd MMM yyyy')}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={() => exportPnLToCsv(exportData)}
              >
                Export CSV
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PictureAsPdfIcon />}
                onClick={() => exportPnLToPdf(exportData)}
              >
                Export PDF
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Revenue"
                value={totals.revenueMinor}
                format={(v) => formatCurrency(v, currency)}
                icon={<PaidRoundedIcon fontSize="small" />}
                accent="accent"
                index={0}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Gross profit"
                value={totals.profitMinor}
                format={(v) => formatCurrency(v, currency)}
                icon={<TrendingUpRoundedIcon fontSize="small" />}
                accent="positive"
                caption={`${grossMarginPct.toFixed(1)}% margin`}
                index={1}
              />
            </Grid>
            {canSeeExpenses && (
              <>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <StatCard
                    label="Total expenses"
                    value={totalExpensesMinor}
                    format={(v) => formatCurrency(v, currency)}
                    icon={<AccountBalanceWalletRoundedIcon fontSize="small" />}
                    accent="warning"
                    index={2}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <StatCard
                    label="Net profit"
                    value={netProfitMinor}
                    format={(v) => formatCurrency(v, currency)}
                    icon={<SavingsRoundedIcon fontSize="small" />}
                    accent="positive"
                    caption={`${netMarginPct.toFixed(1)}% margin`}
                    index={3}
                  />
                </Grid>
              </>
            )}
          </Grid>

          {missingRecipeCount > 0 && (
            <Alert severity="info">
              {missingRecipeCount} item-day{missingRecipeCount === 1 ? '' : 's'} in this range{' '}
              {missingRecipeCount === 1 ? 'has' : 'have'} no recipe defined, so {missingRecipeCount === 1 ? 'its' : 'their'} food cost
              isn't included below. Add a recipe on the Recipes page for a more accurate number.
            </Alert>
          )}

          <Paper variant="outlined" sx={{ p: 3, maxWidth: 560 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Statement
            </Typography>
            <LineRow label="Revenue" value={totals.revenueMinor} currency={currency} />
            <LineRow label="Food cost (COGS)" value={totals.costMinor} currency={currency} negative />
            <Divider sx={{ my: 0.5 }} />
            <LineRow label="Gross profit" value={totals.profitMinor} currency={currency} bold />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              {grossMarginPct.toFixed(1)}% gross margin
            </Typography>

            {canSeeExpenses && (
              <>
                <Divider sx={{ my: 1 }} />
                {expensesByCategory.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    No expenses recorded in this range.
                  </Typography>
                ) : (
                  expensesByCategory.map((c) => (
                    <LineRow key={c.categoryName} label={`${c.categoryName} (${c.count})`} value={c.totalMinor} currency={currency} indent negative />
                  ))
                )}
                <LineRow label="Total expenses" value={totalExpensesMinor} currency={currency} negative />
                <Divider sx={{ my: 0.5 }} />
                <LineRow label="Net profit" value={netProfitMinor} currency={currency} bold />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {netMarginPct.toFixed(1)}% net margin
                </Typography>
              </>
            )}

            {!canSeeExpenses && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Ask an owner for expense access to see expenses and net profit here.
              </Typography>
            )}
          </Paper>

          {canSeeExpenses && expensesByCategory.length > 0 && (
            <Box sx={{ maxWidth: 560 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Expense breakdown
              </Typography>
              <Paper variant="outlined">
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Category</TableCell>
                        <TableCell align="right"># of entries</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right">% of expenses</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {expensesByCategory.map((c) => (
                        <TableRow key={c.categoryName} hover>
                          <TableCell>{c.categoryName}</TableCell>
                          <TableCell align="right">{formatNumber(c.count, 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(c.totalMinor, currency)}</TableCell>
                          <TableCell align="right">
                            {totalExpensesMinor > 0 ? `${((c.totalMinor / totalExpensesMinor) * 100).toFixed(0)}%` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Box>
          )}

          <Alert severity="info" variant="outlined">
            This P&amp;L uses recipe-based food cost (from Daily Sales) and logged Expenses only — it doesn't allocate
            costs like rent across days, include payroll taxes or depreciation, or use an inventory-formula COGS
            (Beginning + Purchases − Ending). Treat it as an accurate operating P&amp;L, not a full accounting
            statement.
          </Alert>
        </Stack>
      )}
    </Box>
  );
}
