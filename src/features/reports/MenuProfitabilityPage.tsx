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
  MenuItem as SelectMenuItem,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchField, matchesSearch } from '../../components/common/SearchField';
import { StatCard } from '../../components/common/StatCard';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency, formatNumber } from '../../utils/money';
import { resolveDateRangePreset, type DateRangePreset } from '../../utils/dates';
import { listDailySalesForRange } from '../../services/salesService';
import { DEFAULT_RESTAURANT_SETTINGS } from '../../types';

type RangeChoice = Exclude<DateRangePreset, 'yesterday'> | 'custom';

const RANGE_PRESETS: { value: RangeChoice; label: string }[] = [
  { value: 'thisWeek', label: 'This Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom range' },
];

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

interface ItemAgg {
  menuItemId: string;
  menuItemName: string;
  quantity: number; // every day, regardless of recipe
  revenueMinor: number; // every day
  costedQuantity: number; // only days that had a recipe
  costedRevenueMinor: number;
  costMinor: number;
  profitMinor: number;
  everMissingRecipe: boolean;
}

/**
 * Menu Profitability — Phase 14. Deliberately the SALES-WEIGHTED
 * counterpart to Phase 9's Menu Costing: that page asks "if I sold exactly
 * one of everything, what's my food cost %?" (a blended-but-not-weighted
 * snapshot of current menu/recipe prices). This page instead asks "given
 * what ACTUALLY sold over a real date range, which items are really
 * driving my profit, and which are really eating into it?" — built from
 * Phase 5's Daily Sales entries (the same range query the P&L report
 * already uses), not from current menu prices. See PHASE_14_REPORT.md for
 * the full reasoning, including why this can disagree with Menu Costing
 * for the same item on the same day.
 */
export function MenuProfitabilityPage() {
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';
  const canSeeFinancials = hasPermission('reports.financial');
  const targetPct = (selectedRestaurant?.settings ?? DEFAULT_RESTAURANT_SETTINGS).targetFoodCostPercent;

  const [rangeChoice, setRangeChoice] = useState<RangeChoice>('thisMonth');
  const [customStart, setCustomStart] = useState(() => format(new Date(), 'yyyy-MM-01'));
  const [customEnd, setCustomEnd] = useState(todayStr);
  const [search, setSearch] = useState('');

  const { startDate, endDate } = useMemo(() => {
    if (rangeChoice === 'custom') {
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

  const entries = useMemo(() => (salesQuery.data ?? []).filter((e) => e.quantitySold > 0), [salesQuery.data]);

  const items = useMemo<ItemAgg[]>(() => {
    const map = new Map<string, ItemAgg>();
    for (const e of entries) {
      const existing = map.get(e.menuItemId) ?? {
        menuItemId: e.menuItemId,
        menuItemName: e.menuItemName,
        quantity: 0,
        revenueMinor: 0,
        costedQuantity: 0,
        costedRevenueMinor: 0,
        costMinor: 0,
        profitMinor: 0,
        everMissingRecipe: false,
      };
      existing.quantity += e.quantitySold;
      existing.revenueMinor += e.revenueMinor;
      if (e.hasRecipe) {
        existing.costedQuantity += e.quantitySold;
        existing.costedRevenueMinor += e.revenueMinor;
        existing.costMinor += e.costMinor;
        existing.profitMinor += e.profitMinor;
      } else {
        existing.everMissingRecipe = true;
      }
      map.set(e.menuItemId, existing);
    }
    return [...map.values()];
  }, [entries]);

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, it) => ({
          revenueMinor: acc.revenueMinor + it.revenueMinor,
          costMinor: acc.costMinor + it.costMinor,
          costedRevenueMinor: acc.costedRevenueMinor + it.costedRevenueMinor,
          profitMinor: acc.profitMinor + it.profitMinor,
        }),
        { revenueMinor: 0, costMinor: 0, costedRevenueMinor: 0, profitMinor: 0 },
      ),
    [items],
  );

  const blendedFoodCostPct = totals.costedRevenueMinor > 0 ? (totals.costMinor / totals.costedRevenueMinor) * 100 : 0;
  const itemsNeverCosted = items.filter((it) => it.costedRevenueMinor === 0).length;
  const itemsOverTarget = items.filter((it) => it.costedRevenueMinor > 0 && (it.costMinor / it.costedRevenueMinor) * 100 > targetPct).length;

  const mostProfitable = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aRanked = a.costedRevenueMinor > 0;
        const bRanked = b.costedRevenueMinor > 0;
        // An item with no recipe has NO profit figure at all — profitMinor
        // sits at its default 0, but that's "never measured," not "broke
        // even." Sorting those items by profitMinor would tie them all at 0
        // and let an arbitrary one of them win "#1" by sheer iteration
        // order. So costed items always sort above un-costed ones, and only
        // costed items are ever compared by real profit; un-costed items
        // are ordered by revenue instead, just so the list still has a
        // sensible order rather than a meaningless tie-break.
        if (aRanked !== bRanked) return aRanked ? -1 : 1;
        return aRanked ? b.profitMinor - a.profitMinor : b.revenueMinor - a.revenueMinor;
      }),
    [items],
  );
  // Keeps each row's rank tied to its position in the FULL sorted list, not
  // its position after search-filtering — so the "#1" badge never jumps to
  // a searched-down row that isn't actually the top performer overall.
  const visibleRows = useMemo(
    () => mostProfitable.map((it, rank) => ({ ...it, rank })).filter((it) => matchesSearch(it.menuItemName, search)),
    [mostProfitable, search],
  );

  if (!canSeeFinancials) {
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          Menu Profitability
        </Typography>
        <Alert severity="info">Ask an owner for financial reporting access to see this report.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Menu Profitability
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Which items actually drove profit over a date range, weighted by what really sold — for{' '}
            {selectedRestaurant?.restaurantName}.
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

      {salesQuery.isLoading ? (
        <LoadingIndicator label="Loading sales…" />
      ) : salesQuery.isError ? (
        <ErrorState message={toFriendlyErrorMessage(salesQuery.error)} onRetry={() => salesQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<TrendingUpIcon fontSize="inherit" />}
          title="Nothing sold in this range"
          description="Enter Daily Sales for these dates and they'll show up here, ranked by actual profit contribution."
        />
      ) : (
        <Stack spacing={3}>
          <Typography variant="caption" color="text.secondary">
            {format(new Date(`${startDate}T00:00:00`), 'dd MMM yyyy')} –{' '}
            {format(new Date(`${endDate}T00:00:00`), 'dd MMM yyyy')}
          </Typography>

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
                label="Sales-weighted food cost %"
                value={blendedFoodCostPct}
                format={(v) => `${v.toFixed(1)}%`}
                icon={<ReceiptLongRoundedIcon fontSize="small" />}
                accent={totals.costedRevenueMinor > 0 ? (blendedFoodCostPct > targetPct ? 'critical' : 'positive') : 'accent'}
                caption={`Target: ${targetPct.toFixed(1)}%`}
                index={1}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Total profit"
                value={totals.profitMinor}
                format={(v) => formatCurrency(v, currency)}
                icon={<TrendingUpRoundedIcon fontSize="small" />}
                accent={totals.profitMinor >= 0 ? 'positive' : 'critical'}
                index={2}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard
                label="Items over target"
                value={itemsOverTarget}
                format={(v) => `${Math.round(v)} / ${items.length}`}
                icon={<WarningAmberRoundedIcon fontSize="small" />}
                accent={itemsOverTarget > 0 ? 'critical' : 'positive'}
                caption={itemsNeverCosted > 0 ? `${itemsNeverCosted} with no recipe, excluded` : undefined}
                index={3}
              />
            </Grid>
          </Grid>

          {itemsNeverCosted > 0 && (
            <Alert severity="info">
              {itemsNeverCosted} item{itemsNeverCosted === 1 ? '' : 's'} sold in this range {itemsNeverCosted === 1 ? 'has' : 'have'}{' '}
              no recipe defined for any of those days, so cost/profit for {itemsNeverCosted === 1 ? 'it' : 'them'} isn't included —
              quantity and revenue still are. Add a recipe on the Recipes page for a complete picture.
            </Alert>
          )}

          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                By item, most profitable first
              </Typography>
              <SearchField value={search} onChange={setSearch} placeholder="Search items…" />
            </Stack>
            <Paper variant="outlined">
              {visibleRows.length === 0 ? (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    No items match "{search}".
                  </Typography>
                </Box>
              ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="right">Qty sold</TableCell>
                      <TableCell align="right">Revenue</TableCell>
                      <TableCell align="right">Food cost</TableCell>
                      <TableCell align="right">Food cost %</TableCell>
                      <TableCell align="right">Profit</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleRows.map((it) => {
                      const hasCostData = it.costedRevenueMinor > 0;
                      const foodCostPct = hasCostData ? (it.costMinor / it.costedRevenueMinor) * 100 : null;
                      const overTarget = foodCostPct !== null && foodCostPct > targetPct;
                      // "#1" is only ever awarded to a row with real,
                      // measured profit — an item with no recipe has no
                      // profit figure to rank by at all (see mostProfitable
                      // above), so it can never claim the badge even if it
                      // happens to land at rank 0.
                      const isTopRanked = it.rank === 0 && hasCostData;
                      return (
                        <TableRow key={it.menuItemId} hover>
                          <TableCell>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                              {isTopRanked && <Chip size="small" color="success" label="#1" />}
                              <Typography variant="body2" sx={{ fontWeight: isTopRanked ? 700 : 400 }}>
                                {it.menuItemName}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">{formatNumber(it.quantity, 0)}</TableCell>
                          <TableCell align="right">{formatCurrency(it.revenueMinor, currency)}</TableCell>
                          <TableCell align="right">{hasCostData ? formatCurrency(it.costMinor, currency) : '—'}</TableCell>
                          <TableCell align="right">{foodCostPct !== null ? `${foodCostPct.toFixed(1)}%` : '—'}</TableCell>
                          <TableCell align="right">{formatCurrency(it.profitMinor, currency)}</TableCell>
                          <TableCell>
                            {!hasCostData ? (
                              <Chip size="small" label="No recipe" />
                            ) : overTarget ? (
                              <Chip size="small" color="error" label="Over target" variant="outlined" />
                            ) : (
                              <Chip size="small" color="success" label="On target" variant="outlined" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              )}
            </Paper>
          </Box>

          <Alert severity="info" variant="outlined">
            "Sales-weighted" means these percentages reflect what actually sold in this range — not, like Menu
            Costing's blended figure, a hypothetical "one of everything." The two can legitimately disagree: a
            high-margin item that barely sold moves this report's numbers less than Menu Costing's even mix would
            suggest.
          </Alert>
        </Stack>
      )}
    </Box>
  );
}
