import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { createRestaurant } from '../../services/restaurantService';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { createRestaurantSchema, type CreateRestaurantFormValues } from '../../utils/validation';

const CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'AED', label: 'AED — UAE Dirham' },
];

const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'UTC'];

export function CreateRestaurantPage() {
  const navigate = useNavigate();
  const { firebaseUser, profile } = useAuth();
  const { selectRestaurant, refreshRestaurants } = useRestaurant();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateRestaurantFormValues>({
    resolver: zodResolver(createRestaurantSchema),
    defaultValues: { currency: 'INR', timezone: 'Asia/Kolkata', country: 'India' },
  });

  const onSubmit = async (values: CreateRestaurantFormValues) => {
    if (!firebaseUser) return;
    setSubmitError(null);
    try {
      const restaurant = await createRestaurant(firebaseUser.uid, values, {
        displayName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : (firebaseUser.displayName ?? ''),
        email: profile?.email ?? firebaseUser.email ?? '',
      });
      await refreshRestaurants();
      selectRestaurant(restaurant.restaurantId);
      navigate('/app/dashboard', { replace: true });
    } catch (err) {
      setSubmitError(toFriendlyErrorMessage(err));
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: 5 }}>
      <Container maxWidth="sm">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/restaurants')} sx={{ mb: 2 }}>
          Back to My Restaurants
        </Button>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
            Create a Restaurant
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            You'll be the owner with full access. You can invite other team members later.
          </Typography>

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              {submitError && <Alert severity="error">{submitError}</Alert>}

              <TextField
                label="Restaurant name"
                fullWidth
                autoFocus
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
                <Grid size={6}>
                  <TextField label="City" fullWidth error={!!errors.city} helperText={errors.city?.message} {...register('city')} />
                </Grid>
                <Grid size={6}>
                  <TextField label="State" fullWidth error={!!errors.state} helperText={errors.state?.message} {...register('state')} />
                </Grid>
                <Grid size={6}>
                  <TextField label="Country" fullWidth error={!!errors.country} helperText={errors.country?.message} {...register('country')} />
                </Grid>
                <Grid size={6}>
                  <TextField
                    label="Pincode"
                    fullWidth
                    error={!!errors.pincode}
                    helperText={errors.pincode?.message}
                    {...register('pincode')}
                  />
                </Grid>
                <Grid size={6}>
                  <TextField label="Phone" fullWidth error={!!errors.phone} helperText={errors.phone?.message} {...register('phone')} />
                </Grid>
                <Grid size={6}>
                  <TextField label="Email" fullWidth error={!!errors.email} helperText={errors.email?.message} {...register('email')} />
                </Grid>
                <Grid size={6}>
                  <TextField
                    label="GST number (optional)"
                    fullWidth
                    error={!!errors.gstNumber}
                    helperText={errors.gstNumber?.message}
                    {...register('gstNumber')}
                  />
                </Grid>
                <Grid size={6}>
                  <TextField
                    label="FSSAI number (optional)"
                    fullWidth
                    error={!!errors.fssaiNumber}
                    helperText={errors.fssaiNumber?.message}
                    {...register('fssaiNumber')}
                  />
                </Grid>
                <Grid size={6}>
                  <TextField select label="Currency" fullWidth defaultValue="INR" {...register('currency')}>
                    {CURRENCIES.map((c) => (
                      <MenuItem key={c.code} value={c.code}>
                        {c.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={6}>
                  <TextField select label="Timezone" fullWidth defaultValue="Asia/Kolkata" {...register('timezone')}>
                    {TIMEZONES.map((tz) => (
                      <MenuItem key={tz} value={tz}>
                        {tz}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>

              <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create Restaurant'}
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
