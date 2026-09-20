import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Divider,
  Grid,
  MenuItem as SelectMenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { ImageUploadField } from '../../components/common/ImageUploadField';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { updateRestaurant } from '../../services/restaurantService';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { restaurantProfileSchema, type RestaurantProfileFormValues } from '../../utils/validation';
import { DEFAULT_RESTAURANT_SETTINGS } from '../../types';

const CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'AED', label: 'AED — UAE Dirham' },
];

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'UTC'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Grid>
  );
}

export function RestaurantProfilePage() {
  const { selectedRestaurant, hasPermission, refreshRestaurants } = useRestaurant();
  const canEdit = hasPermission('restaurant.settings');

  if (!selectedRestaurant) return <LoadingIndicator label="Loading restaurant…" />;

  if (!canEdit) {
    const r = selectedRestaurant;
    return (
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          Restaurant Profile
        </Typography>
        <Alert severity="info" sx={{ mb: 3 }}>
          Ask an owner for restaurant settings access to edit this. Here's the current profile, read-only.
        </Alert>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <ReadOnlyRow label="Restaurant name" value={r.restaurantName} />
            <ReadOnlyRow label="Legal name" value={r.legalName ?? ''} />
            <ReadOnlyRow label="Address" value={r.address ?? ''} />
            <ReadOnlyRow label="City" value={r.city ?? ''} />
            <ReadOnlyRow label="State" value={r.state ?? ''} />
            <ReadOnlyRow label="Country" value={r.country} />
            <ReadOnlyRow label="Pincode" value={r.pincode ?? ''} />
            <ReadOnlyRow label="Phone" value={r.phone ?? ''} />
            <ReadOnlyRow label="Email" value={r.email ?? ''} />
            <ReadOnlyRow label="GST number" value={r.gstNumber ?? ''} />
            <ReadOnlyRow label="FSSAI number" value={r.fssaiNumber ?? ''} />
            <ReadOnlyRow label="Currency" value={r.currency} />
            <ReadOnlyRow label="Timezone" value={r.timezone} />
          </Grid>
        </Paper>
      </Box>
    );
  }

  return <RestaurantProfileForm key={selectedRestaurant.restaurantId} restaurant={selectedRestaurant} onSaved={refreshRestaurants} />;
}

function RestaurantProfileForm({
  restaurant,
  onSaved,
}: {
  restaurant: NonNullable<ReturnType<typeof useRestaurant>['selectedRestaurant']>;
  onSaved: () => Promise<void>;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [logo, setLogo] = useState<string | null>(restaurant.logo);
  const settings = restaurant.settings ?? DEFAULT_RESTAURANT_SETTINGS;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RestaurantProfileFormValues>({
    resolver: zodResolver(restaurantProfileSchema),
    defaultValues: {
      restaurantName: restaurant.restaurantName,
      legalName: restaurant.legalName ?? '',
      address: restaurant.address ?? '',
      city: restaurant.city ?? '',
      state: restaurant.state ?? '',
      country: restaurant.country ?? '',
      pincode: restaurant.pincode ?? '',
      phone: restaurant.phone ?? '',
      email: restaurant.email ?? '',
      gstNumber: restaurant.gstNumber ?? '',
      fssaiNumber: restaurant.fssaiNumber ?? '',
      currency: restaurant.currency as RestaurantProfileFormValues['currency'],
      timezone: restaurant.timezone,
      gstPercent: settings.gstPercent,
      serviceChargePercent: settings.serviceChargePercent,
      defaultWeightUnit: settings.defaultWeightUnit,
      defaultVolumeUnit: settings.defaultVolumeUnit,
      financialYearStartMonth: settings.financialYearStartMonth,
      invoicePrefix: settings.invoicePrefix,
      nextInvoiceNumber: settings.nextInvoiceNumber,
      targetFoodCostPercent: settings.targetFoodCostPercent,
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: RestaurantProfileFormValues) =>
      updateRestaurant(restaurant.restaurantId, {
        restaurantName: values.restaurantName,
        legalName: values.legalName,
        address: values.address,
        city: values.city,
        state: values.state,
        country: values.country,
        pincode: values.pincode,
        phone: values.phone,
        email: values.email,
        gstNumber: values.gstNumber,
        fssaiNumber: values.fssaiNumber,
        currency: values.currency,
        timezone: values.timezone,
        logo,
        settings: {
          gstPercent: values.gstPercent,
          serviceChargePercent: values.serviceChargePercent,
          defaultWeightUnit: values.defaultWeightUnit,
          defaultVolumeUnit: values.defaultVolumeUnit,
          financialYearStartMonth: values.financialYearStartMonth,
          invoicePrefix: values.invoicePrefix?.trim() || 'INV',
          nextInvoiceNumber: values.nextInvoiceNumber,
          targetFoodCostPercent: values.targetFoodCostPercent,
        },
      }),
    onSuccess: async () => {
      await onSaved();
      enqueueSnackbar('Restaurant profile updated.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  const onSubmit = (values: RestaurantProfileFormValues) => saveMutation.mutate(values);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Restaurant Profile
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Business details and operating settings for {restaurant.restaurantName}.
      </Typography>

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              Business Info
            </Typography>
            <Stack spacing={2.5}>
              <ImageUploadField label="Logo (optional)" value={logo} onChange={setLogo} variant="round" />

              <TextField
                label="Restaurant name"
                fullWidth
                error={!!errors.restaurantName}
                helperText={errors.restaurantName?.message}
                {...register('restaurantName')}
              />
              <TextField
                label="Legal name (optional)"
                fullWidth
                error={!!errors.legalName}
                helperText={errors.legalName?.message}
                {...register('legalName')}
              />
              <TextField
                label="Address (optional)"
                fullWidth
                error={!!errors.address}
                helperText={errors.address?.message}
                {...register('address')}
              />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="City" fullWidth error={!!errors.city} helperText={errors.city?.message} {...register('city')} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="State" fullWidth error={!!errors.state} helperText={errors.state?.message} {...register('state')} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Country"
                    fullWidth
                    error={!!errors.country}
                    helperText={errors.country?.message}
                    {...register('country')}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Pincode"
                    fullWidth
                    error={!!errors.pincode}
                    helperText={errors.pincode?.message}
                    {...register('pincode')}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Phone" fullWidth error={!!errors.phone} helperText={errors.phone?.message} {...register('phone')} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="Email" fullWidth error={!!errors.email} helperText={errors.email?.message} {...register('email')} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="GST number (optional)"
                    fullWidth
                    error={!!errors.gstNumber}
                    helperText={errors.gstNumber?.message}
                    {...register('gstNumber')}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="FSSAI number (optional)"
                    fullWidth
                    error={!!errors.fssaiNumber}
                    helperText={errors.fssaiNumber?.message}
                    {...register('fssaiNumber')}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    label="Currency"
                    fullWidth
                    defaultValue={restaurant.currency}
                    error={!!errors.currency}
                    helperText={errors.currency?.message ?? "Changes how amounts display — doesn't convert existing recorded figures."}
                    {...register('currency')}
                  >
                    {CURRENCIES.map((c) => (
                      <SelectMenuItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectMenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    label="Timezone"
                    fullWidth
                    defaultValue={restaurant.timezone}
                    error={!!errors.timezone}
                    helperText={errors.timezone?.message}
                    {...register('timezone')}
                  >
                    {TIMEZONES.map((tz) => (
                      <SelectMenuItem key={tz} value={tz}>
                        {tz}
                      </SelectMenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Defaults used across the app — GST/service charge on future billing features, units for new
              ingredients, and the target food-cost % used as a benchmark.
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="GST %"
                  type="number"
                  fullWidth
                  error={!!errors.gstPercent}
                  helperText={errors.gstPercent?.message}
                  {...register('gstPercent', { valueAsNumber: true })}
                  slotProps={{ htmlInput: { step: '0.01', min: 0, max: 100 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Service charge %"
                  type="number"
                  fullWidth
                  error={!!errors.serviceChargePercent}
                  helperText={errors.serviceChargePercent?.message}
                  {...register('serviceChargePercent', { valueAsNumber: true })}
                  slotProps={{ htmlInput: { step: '0.01', min: 0, max: 100 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Default weight unit"
                  fullWidth
                  defaultValue={settings.defaultWeightUnit}
                  error={!!errors.defaultWeightUnit}
                  helperText={errors.defaultWeightUnit?.message}
                  {...register('defaultWeightUnit')}
                >
                  <SelectMenuItem value="g">Grams (g)</SelectMenuItem>
                  <SelectMenuItem value="kg">Kilograms (kg)</SelectMenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Default volume unit"
                  fullWidth
                  defaultValue={settings.defaultVolumeUnit}
                  error={!!errors.defaultVolumeUnit}
                  helperText={errors.defaultVolumeUnit?.message}
                  {...register('defaultVolumeUnit')}
                >
                  <SelectMenuItem value="ml">Millilitres (ml)</SelectMenuItem>
                  <SelectMenuItem value="l">Litres (l)</SelectMenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Financial year starts"
                  fullWidth
                  defaultValue={settings.financialYearStartMonth}
                  error={!!errors.financialYearStartMonth}
                  helperText={errors.financialYearStartMonth?.message}
                  {...register('financialYearStartMonth', { valueAsNumber: true })}
                >
                  {MONTHS.map((m, i) => (
                    <SelectMenuItem key={m} value={i + 1}>
                      {m}
                    </SelectMenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Target food cost %"
                  type="number"
                  fullWidth
                  error={!!errors.targetFoodCostPercent}
                  helperText={errors.targetFoodCostPercent?.message}
                  {...register('targetFoodCostPercent', { valueAsNumber: true })}
                  slotProps={{ htmlInput: { step: '0.01', min: 0, max: 100 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Invoice prefix"
                  fullWidth
                  error={!!errors.invoicePrefix}
                  helperText={errors.invoicePrefix?.message}
                  {...register('invoicePrefix')}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Next invoice number"
                  type="number"
                  fullWidth
                  error={!!errors.nextInvoiceNumber}
                  helperText={errors.nextInvoiceNumber?.message}
                  {...register('nextInvoiceNumber', { valueAsNumber: true })}
                  slotProps={{ htmlInput: { step: 1, min: 1 } }}
                />
              </Grid>
            </Grid>
          </Paper>

          <Divider />

          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" size="large" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
