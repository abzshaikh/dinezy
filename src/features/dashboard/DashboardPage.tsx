import { useMemo } from 'react';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import { Link as RouterLink } from 'react-router-dom';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { formatCurrency } from '../../utils/money';
import { resolveDateRangePreset } from '../../utils/dates';
import { listDailySalesForRange } from '../../services/salesService';
import { listExpensesForRange } from '../../services/expenseService';
import { ErrorState } from '../../components/common/ErrorState';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { StatCard, type StatCardAccent } from '../../components/common/StatCard';
import { DashboardTrendChart } from './DashboardTrendChart';

export function DashboardPage() {
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';

  // Matches the exact read-permission shape of the dailySales/expenses
  // Firestore rules (see firestore.rules) — a role that can't read the
  // collection shouldn't have this page try to anyway, or React Query
  // would just surface a permission-denied error where a quieter
  // "restricted" card is more honest and less alarming.
  const canSeeSales = hasPermission('orders.view') || hasPermission('reports.view') || hasPermission('reports.financial');
  const canSeeExpenses = hasPermission('expense.view');

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { start: monthStart, end: monthEnd } = resolveDateRangePreset('thisMonth');
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

  // One query per source, covering the whole month up to today — today's
  // figures are then just the subset of that same result where
  // date === todayStr, so this page never fires more reads than the P&L
  // report does for the same range.
  const salesQuery = useQuery({
    queryKey: ['dashboardSales', restaurantId, monthStartStr, monthEndStr],
    queryFn: () => listDailySalesForRange(restaurantId, monthStartStr, monthEndStr),
    enabled: canSeeSales,
  });
  const expensesQuery = useQuery({
    queryKey: ['dashboardExpenses', restaurantId, monthStartStr, monthEndStr],
    queryFn: () => listExpensesForRange(restaurantId, monthStartStr, monthEndStr),
    enabled: canSeeExpenses,
  });

  const totals = useMemo(() => {
    const monthEntries = (salesQuery.data ?? []).filter((e) => e.quantitySold > 0);
    const todayEntries = monthEntries.filter((e) => e.date === todayStr);
    const activeExpenses = (expensesQuery.data ?? []).filter((e) => !e.isVoided);
    const todayExpenses = activeExpenses.filter((e) => e.expenseDate === todayStr);

    const sum = (arr: { revenueMinor?: number; profitMinor?: number; amountMinor?: number }[], key: 'revenueMinor' | 'profitMinor' | 'amountMinor') =>
      arr.reduce((total, item) => total + (item[key] ?? 0), 0);

    const todayRevenueMinor = sum(todayEntries, 'revenueMinor');
    const monthRevenueMinor = sum(monthEntries, 'revenueMinor');
    const todayGrossProfitMinor = sum(todayEntries, 'profitMinor');
    const monthGrossProfitMinor = sum(monthEntries, 'profitMinor');
    const todayExpensesMinor = sum(todayExpenses, 'amountMinor');
    const monthExpensesMinor = sum(activeExpenses, 'amountMinor');

    return {
      todayRevenueMinor,
      monthRevenueMinor,
      todayExpensesMinor,
      monthExpensesMinor,
      todayNetProfitMinor: todayGrossProfitMinor - todayExpensesMinor,
      monthNetProfitMinor: monthGrossProfitMinor - monthExpensesMinor,
    };
  }, [salesQuery.data, expensesQuery.data, todayStr]);

  const canSeeProfit = canSeeSales && canSeeExpenses;

  const salesQueryFailed = canSeeSales && salesQuery.isError;
  const expensesQueryFailed = canSeeExpenses && expensesQuery.isError;

  const format_ = (v: number) => formatCurrency(v, currency);

  const STAT_CARDS: Array<{
    label: string;
    value: number;
    icon: React.ReactNode;
    accent: StatCardAccent;
    locked: boolean;
  }> = [
    { label: "Today's Sales", value: totals.todayRevenueMinor, icon: <PaidRoundedIcon fontSize="small" />, accent: 'accent', locked: !canSeeSales },
    { label: "Today's Expenses", value: totals.todayExpensesMinor, icon: <ReceiptLongRoundedIcon fontSize="small" />, accent: 'warning', locked: !canSeeExpenses },
    { label: "Today's Profit", value: totals.todayNetProfitMinor, icon: <TrendingUpRoundedIcon fontSize="small" />, accent: 'positive', locked: !canSeeProfit },
    { label: "This Month's Sales", value: totals.monthRevenueMinor, icon: <CalendarMonthRoundedIcon fontSize="small" />, accent: 'accent', locked: !canSeeSales },
    { label: "This Month's Expenses", value: totals.monthExpensesMinor, icon: <AccountBalanceWalletRoundedIcon fontSize="small" />, accent: 'warning', locked: !canSeeExpenses },
    { label: 'Net Profit (MTD)', value: totals.monthNetProfitMinor, icon: <SavingsRoundedIcon fontSize="small" />, accent: 'positive', locked: !canSeeProfit },
  ];

  return (
    <Box>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
              Welcome to {selectedRestaurant?.restaurantName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Live figures from today and month-to-date — updates as sales and expenses are recorded.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.25}>
            <Button component={RouterLink} to="/app/sales/daily" variant="outlined">
              Record Sale
            </Button>
            <Button component={RouterLink} to="/app/billing/invoices/new" variant="contained">
              + New Invoice
            </Button>
          </Stack>
        </Stack>
      </motion.div>

      {(salesQueryFailed || expensesQueryFailed) && (
        <Box sx={{ mb: 2.5 }}>
          <ErrorState
            message={toFriendlyErrorMessage(salesQuery.error ?? expensesQuery.error)}
            onRetry={() => {
              if (salesQueryFailed) salesQuery.refetch();
              if (expensesQueryFailed) expensesQuery.refetch();
            }}
          />
        </Box>
      )}

      <Grid container spacing={2.5}>
        {STAT_CARDS.map((card, index) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard
              label={card.label}
              value={card.value}
              icon={card.icon}
              accent={card.accent}
              index={index}
              locked={card.locked}
              format={format_}
            />
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 2.5 }}>
        <DashboardTrendChart
          restaurantId={restaurantId}
          currency={currency}
          canSeeSales={canSeeSales}
          canSeeExpenses={canSeeExpenses}
        />
      </Box>
    </Box>
  );
}
