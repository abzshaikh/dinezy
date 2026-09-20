import DashboardIcon from '@mui/icons-material/Dashboard';
import StorefrontIcon from '@mui/icons-material/Storefront';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SettingsIcon from '@mui/icons-material/Settings';
import type { SvgIconProps } from '@mui/material';
import type { ComponentType } from 'react';

type SvgIconComponent = ComponentType<SvgIconProps>;

export interface NavLeaf {
  label: string;
  path: string;
  /** false = shown but disabled with a "Coming soon" hint; the feature ships in a later phase. */
  enabled: boolean;
}

export interface NavSection {
  label: string;
  icon: SvgIconComponent;
  path?: string; // if the section itself is a single link (e.g. Dashboard)
  enabled?: boolean; // only relevant when `path` is set; defaults to false
  children?: NavLeaf[];
}

/**
 * Full navigation structure per the product spec. Only Dashboard is enabled
 * in Phase 1 — everything else renders as a disabled placeholder so the
 * eventual shape of the app is visible without shipping dead/broken routes.
 * As each phase lands, flip the relevant `enabled` flags to true.
 */
export const NAV_SECTIONS: NavSection[] = [
  { label: 'Dashboard', icon: DashboardIcon, path: '/app/dashboard', enabled: true },
  {
    label: 'Restaurant',
    icon: StorefrontIcon,
    children: [
      { label: 'Restaurant Profile', path: '/app/restaurant/profile', enabled: true },
      { label: 'Users', path: '/app/restaurant/users', enabled: true },
      { label: 'Roles & Permissions', path: '/app/restaurant/roles', enabled: true },
    ],
  },
  {
    label: 'Menu',
    icon: RestaurantMenuIcon,
    children: [
      { label: 'Categories', path: '/app/menu/categories', enabled: true },
      { label: 'Menu Items', path: '/app/menu/items', enabled: true },
      { label: 'Recipes', path: '/app/menu/recipes', enabled: true },
      { label: 'Menu Costing', path: '/app/menu/costing', enabled: true },
    ],
  },
  {
    label: 'Sales',
    icon: PointOfSaleIcon,
    children: [
      { label: 'Orders', path: '/app/sales/orders', enabled: false },
      { label: 'Daily Sales', path: '/app/sales/daily', enabled: true },
      { label: 'Payments', path: '/app/sales/payments', enabled: false },
    ],
  },
  {
    label: 'Inventory',
    icon: Inventory2Icon,
    children: [
      { label: 'Ingredients', path: '/app/inventory/ingredients', enabled: true },
      { label: 'Stock', path: '/app/inventory/stock', enabled: false },
      { label: 'Stock Ledger', path: '/app/inventory/ledger', enabled: true },
      { label: 'Suppliers', path: '/app/inventory/suppliers', enabled: false },
      { label: 'Purchases', path: '/app/inventory/purchases', enabled: true },
      { label: 'Waste', path: '/app/inventory/waste', enabled: true },
      { label: 'Expiry', path: '/app/inventory/expiry', enabled: true },
    ],
  },
  {
    label: 'Billing',
    icon: ReceiptIcon,
    children: [{ label: 'Invoices', path: '/app/billing/invoices', enabled: true }],
  },
  {
    label: 'Expenses',
    icon: ReceiptLongIcon,
    children: [
      { label: 'Expenses', path: '/app/expenses/list', enabled: true },
      { label: 'Recurring Expenses', path: '/app/expenses/recurring', enabled: true },
      { label: 'Expense Categories', path: '/app/expenses/categories', enabled: true },
    ],
  },
  {
    label: 'Reports',
    icon: AssessmentIcon,
    children: [
      { label: 'Sales Report', path: '/app/reports/sales', enabled: true },
      { label: 'Purchase Report', path: '/app/reports/purchases', enabled: false },
      { label: 'Inventory Report', path: '/app/reports/inventory', enabled: false },
      { label: 'Food Cost Report', path: '/app/reports/food-cost', enabled: false },
      { label: 'Expense Report', path: '/app/reports/expenses', enabled: false },
      { label: 'Profit & Loss', path: '/app/reports/pnl', enabled: true },
      { label: 'Menu Profitability', path: '/app/reports/menu-profitability', enabled: true },
    ],
  },
  { label: 'Settings', icon: SettingsIcon, path: '/app/settings', enabled: true },
];
