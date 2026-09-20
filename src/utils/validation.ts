import { z } from 'zod';
import { DIETARY_TYPES } from '../types/menu';
import { INGREDIENT_UNITS, WASTE_REASONS } from '../types/inventory';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required').max(60),
    lastName: z.string().trim().min(1, 'Last name is required').max(60),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    phone: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || /^[0-9+\- ]{7,15}$/.test(v), 'Enter a valid phone number'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

const CURRENCY_CODES = ['INR', 'USD', 'GBP', 'EUR', 'AED'] as const;

export const createRestaurantSchema = z.object({
  restaurantName: z.string().trim().min(1, 'Restaurant name is required').max(120),
  legalName: z.string().trim().max(160).optional().or(z.literal('')),
  address: z.string().trim().max(240).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  state: z.string().trim().max(80).optional().or(z.literal('')),
  country: z.string().trim().max(80).optional().or(z.literal('')),
  pincode: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9A-Za-z\- ]{3,10}$/.test(v), 'Enter a valid postal code')
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9+\- ]{7,15}$/.test(v), 'Enter a valid phone number')
    .or(z.literal('')),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
  gstNumber: z.string().trim().max(20).optional().or(z.literal('')),
  fssaiNumber: z.string().trim().max(20).optional().or(z.literal('')),
  currency: z.enum(CURRENCY_CODES),
  timezone: z.string().trim().min(1),
});
export type CreateRestaurantFormValues = z.infer<typeof createRestaurantSchema>;

const WEIGHT_UNITS = ['g', 'kg'] as const;
const VOLUME_UNITS = ['ml', 'l'] as const;

/**
 * Phase 8 — the Restaurant Profile page. Same business-info fields as
 * `createRestaurantSchema` (currency/timezone required, not optional, since
 * there's always a current value to edit) plus the `RestaurantSettings`
 * fields flattened onto the same form (the service call re-nests them into
 * `settings` at the boundary — see `restaurantService.updateRestaurant`).
 * Numeric fields use plain `z.number()` + RHF's `valueAsNumber`, same
 * pattern as every other numeric form field in this app (see the comment
 * above `menuCategorySchema`) — never `z.coerce.number()`.
 */
export const restaurantProfileSchema = z.object({
  restaurantName: z.string().trim().min(1, 'Restaurant name is required').max(120),
  legalName: z.string().trim().max(160).optional().or(z.literal('')),
  address: z.string().trim().max(240).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  state: z.string().trim().max(80).optional().or(z.literal('')),
  country: z.string().trim().max(80).optional().or(z.literal('')),
  pincode: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9A-Za-z\- ]{3,10}$/.test(v), 'Enter a valid postal code')
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9+\- ]{7,15}$/.test(v), 'Enter a valid phone number')
    .or(z.literal('')),
  email: z.string().trim().email('Enter a valid email address').optional().or(z.literal('')),
  gstNumber: z.string().trim().max(20).optional().or(z.literal('')),
  fssaiNumber: z.string().trim().max(20).optional().or(z.literal('')),
  currency: z.enum(CURRENCY_CODES),
  timezone: z.string().trim().min(1),
  gstPercent: z.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100'),
  serviceChargePercent: z.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100'),
  defaultWeightUnit: z.enum(WEIGHT_UNITS),
  defaultVolumeUnit: z.enum(VOLUME_UNITS),
  financialYearStartMonth: z.number().int('Whole numbers only').min(1).max(12),
  invoicePrefix: z.string().trim().max(10, 'Keep it short').optional().or(z.literal('')),
  nextInvoiceNumber: z.number().int('Whole numbers only').min(1, 'Must be at least 1'),
  targetFoodCostPercent: z.number().min(0, 'Cannot be negative').max(100, 'Cannot exceed 100'),
});
export type RestaurantProfileFormValues = z.infer<typeof restaurantProfileSchema>;

// Plain z.number() (not z.coerce.number()) on purpose: react-hook-form's
// `valueAsNumber` option on register() converts the <input type="number">
// string to a number BEFORE zod ever sees it, so the resolver's input and
// output types match. z.coerce.number() makes the input type `unknown`,
// which breaks useForm<FormValues>'s type inference (RHF/zod's known
// coerce-vs-generic-inference mismatch) — keep this pattern for any future
// numeric form field in this app.
export const menuCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(80),
  description: z.string().trim().max(240).optional().or(z.literal('')),
  displayOrder: z.number().int('Whole numbers only').min(0).max(9999),
});
export type MenuCategoryFormValues = z.infer<typeof menuCategorySchema>;

/** `price` here is in MAJOR units (e.g. rupees) for the form — converted to/from `priceMinor` at the service boundary via src/utils/money.ts, same pattern as everywhere else in the app. */
export const menuItemSchema = z.object({
  categoryId: z.string().trim().min(1, 'Category is required'),
  name: z.string().trim().min(1, 'Item name is required').max(120),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  price: z.number().min(0.01, 'Enter a price greater than 0'),
  dietaryType: z.enum(DIETARY_TYPES).optional().or(z.literal('')),
  displayOrder: z.number().int('Whole numbers only').min(0).max(9999),
});
export type MenuItemFormValues = z.infer<typeof menuItemSchema>;

/** `costPerUnit`/`openingStockQty` are MAJOR-unit/plain-number form fields — converted at the service boundary (money.ts for cost; quantity is already a plain number, no conversion needed). `openingStockQty` only applies at creation; editing an ingredient never touches stock (see UpdateIngredientInput). */
export const ingredientSchema = z.object({
  name: z.string().trim().min(1, 'Ingredient name is required').max(120),
  category: z.string().trim().max(80).optional().or(z.literal('')),
  unit: z.enum(INGREDIENT_UNITS),
  costPerUnit: z.number().min(0, 'Cost can’t be negative'),
  openingStockQty: z.number().min(0, 'Can’t be negative').optional(),
  reorderLevel: z.number().min(0, 'Can’t be negative').optional(),
});
export type IngredientFormValues = z.infer<typeof ingredientSchema>;

/** `expiryDate` is a plain `yyyy-MM-dd` string from an HTML date input — parsed to a Date at the submit boundary, same "don't fight the DOM's native type" reasoning as the number fields above. */
export const purchaseSchema = z.object({
  ingredientId: z.string().trim().min(1, 'Ingredient is required'),
  quantity: z.number().min(0.001, 'Enter a quantity greater than 0'),
  unitCost: z.number().min(0, 'Cost can’t be negative'),
  vendorName: z.string().trim().max(120).optional().or(z.literal('')),
  expiryDate: z.string().optional().or(z.literal('')),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});
export type PurchaseFormValues = z.infer<typeof purchaseSchema>;

export const wasteSchema = z.object({
  ingredientId: z.string().trim().min(1, 'Ingredient is required'),
  quantity: z.number().min(0.001, 'Enter a quantity greater than 0'),
  reason: z.enum(WASTE_REASONS),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});
export type WasteFormValues = z.infer<typeof wasteSchema>;

export const adjustmentSchema = z.object({
  newStockQty: z.number().min(0, 'Can’t be negative'),
  note: z.string().trim().min(1, 'A short reason is required (e.g. "Physical count correction")').max(300),
});
export type AdjustmentFormValues = z.infer<typeof adjustmentSchema>;

/** One recipe line: how much of one ingredient one unit of the menu item uses. `quantity` is in that ingredient's own unit (kg, g, pcs, ...) — no currency involved, so no minor-units conversion here. */
export const recipeLineSchema = z.object({
  ingredientId: z.string().trim().min(1, 'Choose an ingredient'),
  quantity: z.number().min(0.001, 'Enter a quantity greater than 0'),
});
export const recipeSchema = z.object({
  lines: z.array(recipeLineSchema).min(1, 'Add at least one ingredient'),
});
export type RecipeLineFormValues = z.infer<typeof recipeLineSchema>;
export type RecipeFormValues = z.infer<typeof recipeSchema>;

export const expenseCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(80),
  description: z.string().trim().max(240).optional().or(z.literal('')),
  displayOrder: z.number().int('Whole numbers only').min(0).max(9999),
});
export type ExpenseCategoryFormValues = z.infer<typeof expenseCategorySchema>;

/** `amount` is in MAJOR units for the form, converted to `amountMinor` at the service boundary (src/utils/money.ts), same pattern as everywhere else. `expenseDate` is a plain `yyyy-MM-dd` string straight from an HTML date input — see the doc comment on Expense.expenseDate for why this field skips the usual Date/Timestamp conversion. */
export const expenseSchema = z.object({
  categoryId: z.string().trim().min(1, 'Category is required'),
  amount: z.number().min(0.01, 'Enter an amount greater than 0'),
  expenseDate: z.string().trim().min(1, 'Date is required'),
  vendorName: z.string().trim().max(120).optional().or(z.literal('')),
  note: z.string().trim().max(300).optional().or(z.literal('')),
});
export type ExpenseFormValues = z.infer<typeof expenseSchema>;

/** Phase 13 — a recurring expense template. `dayOfMonth`/`dayOfWeek` are both present in the form (a toggle between them, driven by `frequency`) but only the relevant one is sent to the service — see SaveRecurringExpenseTemplateInput. */
export const recurringExpenseTemplateSchema = z.object({
  categoryId: z.string().trim().min(1, 'Category is required'),
  amount: z.number().min(0.01, 'Enter an amount greater than 0'),
  vendorName: z.string().trim().max(120).optional().or(z.literal('')),
  note: z.string().trim().max(300).optional().or(z.literal('')),
  frequency: z.enum(['weekly', 'monthly']),
  dayOfMonth: z.number().int('Whole numbers only').min(1).max(31),
  dayOfWeek: z.number().int('Whole numbers only').min(0).max(6),
});
export type RecurringExpenseTemplateFormValues = z.infer<typeof recurringExpenseTemplateSchema>;

/** Phase 10 — personal account settings (`/app/settings`), distinct from Restaurant Profile's business/financial settings. Two independent forms, two independent schemas: editing your name/phone/photo never requires a password, but changing your password does (Firebase requires a recent login — see authService.ts). An email-change form/schema shipped briefly in Phase 10 and was removed right after at the user's request. */
export const accountProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[0-9+\- ]{7,15}$/.test(v), 'Enter a valid phone number')
    .or(z.literal('')),
});
export type AccountProfileFormValues = z.infer<typeof accountProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords don't match",
    path: ['confirmNewPassword'],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

/** Phase 15 — inviting a new team member. `role` excludes 'owner' — ownership is only ever established at restaurant creation, never granted through an invite (enforced again server-side, see firestore.rules). */
export const sendInviteSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  role: z.enum(['manager', 'kitchen_manager', 'cashier', 'inventory_manager', 'accountant']),
});
export type SendInviteFormValues = z.infer<typeof sendInviteSchema>;

/** Phase 16 — creating an invoice. `lineItems` mirrors the DailySales grid pattern: one entry per menu item with a quantity, filtered to quantity > 0 at the service boundary (see createInvoice). */
export const invoiceLineSchema = z.object({
  menuItemId: z.string().trim().min(1),
  quantity: z.number().min(0),
});
export const createInvoiceSchema = z.object({
  customerName: z.string().trim().max(120).optional().or(z.literal('')),
  note: z.string().trim().max(300).optional().or(z.literal('')),
  lineItems: z.array(invoiceLineSchema),
});
export type CreateInvoiceFormValues = z.infer<typeof createInvoiceSchema>;
