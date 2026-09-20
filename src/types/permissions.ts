/**
 * Granular permission strings. Every permission-gated action in the app
 * checks one of these rather than checking a role name directly, so the
 * permission model can evolve (custom roles, per-user overrides) without
 * touching call sites.
 */
export const PERMISSIONS = [
  'menu.view',
  'menu.create',
  'menu.edit',
  'menu.delete',
  'recipes.view',
  'recipes.edit',
  'inventory.view',
  'inventory.create',
  'inventory.edit',
  'inventory.adjust',
  'suppliers.view',
  'suppliers.edit',
  'purchase.view',
  'purchase.create',
  'purchase.edit',
  'orders.view',
  'orders.create',
  'orders.edit',
  'waste.view',
  'waste.create',
  'expense.view',
  'expense.create',
  'expense.edit',
  'reports.view',
  'reports.financial', // P&L, COGS, margins — gated separately from general reports
  'users.manage',
  'restaurant.settings',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_IDS = [
  'owner',
  'manager',
  'kitchen_manager',
  'cashier',
  'inventory_manager',
  'accountant',
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

/** All permissions, used for the Owner role and for admin checks. */
const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

/**
 * Fixed role -> permission set mapping. This is the source of truth for
 * what each role can do. A restaurantUsers doc stores a roleId plus an
 * optional permissionOverrides map (see restaurantUser.ts) so an owner can
 * grant/revoke individual permissions without needing a full custom-role
 * builder.
 */
export const ROLE_PERMISSIONS: Record<RoleId, readonly Permission[]> = {
  owner: ALL_PERMISSIONS,
  manager: [
    'menu.view',
    'recipes.view',
    'inventory.view',
    'inventory.create',
    'inventory.edit',
    'suppliers.view',
    'purchase.view',
    'purchase.create',
    'orders.view',
    'orders.create',
    'orders.edit',
    'waste.view',
    'waste.create',
    'expense.view',
    'expense.create',
    'reports.view',
  ],
  kitchen_manager: [
    'menu.view',
    'recipes.view',
    'recipes.edit',
    'inventory.view',
    'inventory.adjust',
    'waste.view',
    'waste.create',
  ],
  cashier: ['orders.view', 'orders.create', 'menu.view'],
  inventory_manager: [
    'inventory.view',
    'inventory.create',
    'inventory.edit',
    'inventory.adjust',
    'suppliers.view',
    'suppliers.edit',
    'purchase.view',
    'purchase.create',
    'purchase.edit',
    'waste.view',
    'waste.create',
  ],
  accountant: [
    'expense.view',
    'expense.create',
    'expense.edit',
    'purchase.view',
    'orders.view',
    'reports.view',
    'reports.financial',
  ],
};

export const ROLE_LABELS: Record<RoleId, string> = {
  owner: 'Owner',
  manager: 'Manager',
  kitchen_manager: 'Kitchen Manager',
  cashier: 'Cashier',
  inventory_manager: 'Inventory Manager',
  accountant: 'Accountant',
};

/**
 * Resolves the effective permission set for a restaurantUsers doc:
 * role's base permissions, plus any grant/revoke overrides.
 */
export function resolvePermissions(
  roleId: RoleId,
  overrides?: Partial<Record<Permission, boolean>> | null,
): Set<Permission> {
  const base = new Set<Permission>(ROLE_PERMISSIONS[roleId]);
  if (overrides) {
    for (const [perm, granted] of Object.entries(overrides) as [Permission, boolean][]) {
      if (granted) base.add(perm);
      else base.delete(perm);
    }
  }
  return base;
}

/**
 * Human-readable label for each permission group (the dot-prefix of a
 * Permission string). `orders` was reserved since Phase 1 for the
 * never-built Orders/POS module (permanently excluded — see the project
 * doc); `orders.create` was already repurposed once, in Phase 5, to gate
 * Daily Sales entry. Phase 16 repurposed the whole group again for manual
 * billing/invoicing (orders.view/orders.create/orders.edit gate the
 * Invoices page), so the label reflects what it actually gates today
 * rather than what it was originally reserved for.
 */
export const PERMISSION_GROUP_LABELS: Record<string, string> = {
  menu: 'Menu',
  recipes: 'Recipes',
  inventory: 'Inventory',
  suppliers: 'Suppliers',
  purchase: 'Purchases',
  orders: 'Billing (Invoices)',
  waste: 'Waste',
  expense: 'Expenses',
  reports: 'Reports',
  users: 'Users',
  restaurant: 'Restaurant Settings',
};

/** Groups a flat permission list by its dot-prefix, e.g. 'menu.view' -> group 'menu' — used by the Users/Roles pages to render a readable checklist or matrix instead of one long flat list. */
export function groupPermissions(perms: readonly Permission[]): Record<string, Permission[]> {
  const groups: Record<string, Permission[]> = {};
  for (const p of perms) {
    const [group] = p.split('.');
    (groups[group] ??= []).push(p);
  }
  return groups;
}
