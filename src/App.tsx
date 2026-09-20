import { useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { getAppTheme } from './app/theme';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeModeContext';
import { AuthProvider } from './contexts/AuthContext';
import { RestaurantProvider } from './contexts/RestaurantContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RequireRestaurant } from './routes/RequireRestaurant';
import { AppLayout } from './app/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { MyRestaurantsPage } from './features/restaurants/MyRestaurantsPage';
import { CreateRestaurantPage } from './features/restaurants/CreateRestaurantPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { UsersPage } from './features/restaurant-users/UsersPage';
import { RestaurantProfilePage } from './features/restaurants/RestaurantProfilePage';
import { RolesPermissionsPage } from './features/roles/RolesPermissionsPage';
import { MenuCategoriesPage } from './features/menu/MenuCategoriesPage';
import { MenuItemsPage } from './features/menu/MenuItemsPage';
import { IngredientsPage } from './features/inventory/IngredientsPage';
import { PurchasesPage } from './features/inventory/PurchasesPage';
import { WastePage } from './features/inventory/WastePage';
import { StockLedgerPage } from './features/inventory/StockLedgerPage';
import { ExpiryPage } from './features/inventory/ExpiryPage';
import { RecipesPage } from './features/menu/RecipesPage';
import { MenuCostingPage } from './features/menu/MenuCostingPage';
import { DailySalesPage } from './features/sales/DailySalesPage';
import { SalesReportPage } from './features/reports/SalesReportPage';
import { PnLPage } from './features/reports/PnLPage';
import { MenuProfitabilityPage } from './features/reports/MenuProfitabilityPage';
import { InvoicesPage } from './features/billing/InvoicesPage';
import { NewInvoicePage } from './features/billing/NewInvoicePage';
import { ExpensesPage } from './features/expenses/ExpensesPage';
import { ExpenseCategoriesPage } from './features/expenses/ExpenseCategoriesPage';
import { RecurringExpensesPage } from './features/expenses/RecurringExpensesPage';
import { SettingsPage } from './features/settings/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <ThemeModeProvider>
      <ThemedApp />
    </ThemeModeProvider>
  );
}

// Split out so `useThemeMode()` (which needs to be inside ThemeModeProvider)
// can pick the light/dark MUI theme before anything else renders.
function ThemedApp() {
  const { mode } = useThemeMode();
  const theme = useMemo(() => getAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <RestaurantProvider>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />

                  <Route element={<ProtectedRoute />}>
                    <Route path="/restaurants" element={<MyRestaurantsPage />} />
                    <Route path="/restaurants/new" element={<CreateRestaurantPage />} />

                    <Route element={<RequireRestaurant />}>
                      <Route path="/app" element={<AppLayout />}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<DashboardPage />} />
                        <Route path="restaurant/profile" element={<RestaurantProfilePage />} />
                        <Route path="restaurant/users" element={<UsersPage />} />
                        <Route path="restaurant/roles" element={<RolesPermissionsPage />} />
                        <Route path="menu/categories" element={<MenuCategoriesPage />} />
                        <Route path="menu/items" element={<MenuItemsPage />} />
                        <Route path="menu/recipes" element={<RecipesPage />} />
                        <Route path="menu/costing" element={<MenuCostingPage />} />
                        <Route path="inventory/ingredients" element={<IngredientsPage />} />
                        <Route path="inventory/purchases" element={<PurchasesPage />} />
                        <Route path="inventory/waste" element={<WastePage />} />
                        <Route path="inventory/ledger" element={<StockLedgerPage />} />
                        <Route path="inventory/expiry" element={<ExpiryPage />} />
                        <Route path="sales/daily" element={<DailySalesPage />} />
                        <Route path="reports/sales" element={<SalesReportPage />} />
                        <Route path="reports/pnl" element={<PnLPage />} />
                        <Route path="reports/menu-profitability" element={<MenuProfitabilityPage />} />
                        <Route path="billing/invoices" element={<InvoicesPage />} />
                        <Route path="billing/invoices/new" element={<NewInvoicePage />} />
                        <Route path="expenses/list" element={<ExpensesPage />} />
                        <Route path="expenses/recurring" element={<RecurringExpensesPage />} />
                        <Route path="expenses/categories" element={<ExpenseCategoriesPage />} />
                        <Route path="settings" element={<SettingsPage />} />
                      </Route>
                    </Route>
                  </Route>

                  <Route path="/" element={<Navigate to="/restaurants" replace />} />
                  <Route path="*" element={<Navigate to="/restaurants" replace />} />
                </Routes>
              </RestaurantProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}
