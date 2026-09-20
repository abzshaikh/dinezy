import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  Stack,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { listDailySalesForRange } from '../../services/salesService';
import { listExpensesForRange } from '../../services/expenseService';
import { formatCompactCurrency, formatCurrency } from '../../utils/money';
import { accentPalette, monoNumeric } from '../../app/theme';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { buildTrendBuckets, bucketTrendData, resolveTrendWindow, type TrendGranularity, type TrendPoint } from '../../utils/trendData';

const GRANULARITY_OPTIONS: { value: TrendGranularity; label: string }[] = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'year', label: 'Years' },
];

// Same semantic color mapping the Dashboard's StatCards already use
// (accent = sales, warning = expenses, positive = profit) so the chart
// reads as a continuation of the cards above it rather than a new color
// language the viewer has to re-learn.
function useTrendColors() {
  const theme = useTheme();
  return accentPalette(theme);
}

type TrendTooltipProps = Partial<TooltipContentProps<number, string>> & { currency: string };

function TrendTooltip({ active, payload, currency }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as TrendPoint | undefined;
  if (!point) return null;
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '14px', p: 1.25, boxShadow: 6 }}>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.75, fontWeight: 600 }}>
        {point.fullLabel}
      </Typography>
      <Stack spacing={0.5}>
        {payload.map((entry) => (
          <Stack key={entry.dataKey as string} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ minWidth: 64 }}>
              {entry.name}
            </Typography>
            <Typography variant="caption" sx={{ ...monoNumeric, fontWeight: 700 }}>
              {formatCurrency(Number(entry.value ?? 0), currency)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export interface DashboardTrendChartProps {
  restaurantId: string;
  currency: string;
  /** Mirrors DashboardPage's own permission gate so this chart never fires a query a role can't read — see that page for the Firestore-rule reasoning. */
  canSeeSales: boolean;
  canSeeExpenses: boolean;
}

/**
 * The Dashboard's "compare over time" chart — Sales, Expenses, and Profit as
 * three lines, with a Day/Week/Month/Year switcher that re-buckets the same
 * kind of range query the stat cards and PnLPage already use (see
 * trendData.ts for the bucketing). Built with recharts rather than a
 * hand-rolled SVG so hover tooltips, the legend, and responsive resizing
 * come for free and stay maintainable as a normal React component.
 */
export function DashboardTrendChart({ restaurantId, currency, canSeeSales, canSeeExpenses }: DashboardTrendChartProps) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const colors = useTrendColors();
  const [granularity, setGranularity] = useState<TrendGranularity>('day');

  const canSeeProfit = canSeeSales && canSeeExpenses;
  const canSeeAnything = canSeeSales || canSeeExpenses;

  const { start, end } = useMemo(() => resolveTrendWindow(granularity), [granularity]);
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');

  const salesQuery = useQuery({
    queryKey: ['dashboardTrendSales', restaurantId, granularity, startStr, endStr],
    queryFn: () => listDailySalesForRange(restaurantId, startStr, endStr),
    enabled: canSeeSales,
  });
  const expensesQuery = useQuery({
    queryKey: ['dashboardTrendExpenses', restaurantId, granularity, startStr, endStr],
    queryFn: () => listExpensesForRange(restaurantId, startStr, endStr),
    enabled: canSeeExpenses,
  });

  const points = useMemo(() => {
    const buckets = buildTrendBuckets(granularity);
    return bucketTrendData(granularity, buckets, salesQuery.data ?? [], expensesQuery.data ?? []);
  }, [granularity, salesQuery.data, expensesQuery.data]);

  const isLoading = (canSeeSales && salesQuery.isFetching && salesQuery.data === undefined) || (canSeeExpenses && expensesQuery.isFetching && expensesQuery.data === undefined);
  const salesFailed = canSeeSales && salesQuery.isError;
  const expensesFailed = canSeeExpenses && expensesQuery.isError;
  const isError = salesFailed || expensesFailed;
  const hasAnyValue = points.some((p) => p.revenueMinor !== 0 || p.expensesMinor !== 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}>
      <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Sales, Expenses &amp; Profit Trend
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Compare how the restaurant is doing across days, weeks, months, or years.
            </Typography>
          </Box>
          {canSeeAnything && (
            <ToggleButtonGroup
              value={granularity}
              exclusive
              size="small"
              onChange={(_e, next: TrendGranularity | null) => next && setGranularity(next)}
              aria-label="Chart period"
            >
              {GRANULARITY_OPTIONS.map((opt) => (
                <ToggleButton key={opt.value} value={opt.value} aria-label={opt.label}>
                  {opt.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </Stack>

        {!canSeeAnything ? (
          <EmptyState
            icon={<LockRoundedIcon fontSize="inherit" />}
            title="Restricted"
            description="Ask an owner for sales or expense access to see this chart."
          />
        ) : isLoading ? (
          <LoadingIndicator label="Loading trend…" />
        ) : isError ? (
          <ErrorState
            message={toFriendlyErrorMessage(salesQuery.error ?? expensesQuery.error)}
            onRetry={() => {
              if (salesFailed) salesQuery.refetch();
              if (expensesFailed) expensesQuery.refetch();
            }}
          />
        ) : !hasAnyValue ? (
          <EmptyState
            icon={<ShowChartRoundedIcon fontSize="inherit" />}
            title="Nothing recorded in this period yet"
            description="Record some sales or expenses and this chart will fill in automatically."
          />
        ) : (
          <>
            {(canSeeSales && !canSeeExpenses) || (canSeeExpenses && !canSeeSales) ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                {canSeeSales
                  ? 'Expenses and Profit are hidden — ask an owner for expense access to see them.'
                  : 'Sales and Profit are hidden — ask an owner for sales access to see them.'}
              </Typography>
            ) : null}
            <Box sx={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={theme.palette.divider} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke={theme.palette.divider}
                    tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                    tickLine={false}
                    axisLine={{ stroke: theme.palette.divider }}
                    interval={points.length > 16 ? 'preserveStartEnd' : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                    tickLine={false}
                    axisLine={false}
                    width={isNarrow ? 44 : 68}
                    tickFormatter={(v: number) => formatCompactCurrency(v, currency)}
                  />
                  <Tooltip content={<TrendTooltip currency={currency} />} cursor={{ stroke: theme.palette.divider, strokeWidth: 1 }} />
                  <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                  {canSeeSales && (
                    <Line
                      type="monotone"
                      dataKey="revenueMinor"
                      name="Sales"
                      stroke={colors.accent}
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0, fill: colors.accent }}
                      activeDot={{ r: 6 }}
                      isAnimationActive
                    />
                  )}
                  {canSeeExpenses && (
                    <Line
                      type="monotone"
                      dataKey="expensesMinor"
                      name="Expenses"
                      stroke={colors.warning}
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0, fill: colors.warning }}
                      activeDot={{ r: 6 }}
                      isAnimationActive
                    />
                  )}
                  {canSeeProfit && (
                    <Line
                      type="monotone"
                      dataKey="profitMinor"
                      name="Profit"
                      stroke={colors.positive}
                      strokeWidth={2}
                      dot={{ r: 3, strokeWidth: 0, fill: colors.positive }}
                      activeDot={{ r: 6 }}
                      isAnimationActive
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </>
        )}
      </Card>
    </motion.div>
  );
}
