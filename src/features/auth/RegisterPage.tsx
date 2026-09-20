import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Grid, Link, Stack, TextField, Typography } from '@mui/material';
import { registerUser } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { registerSchema, type RegisterFormValues } from '../../utils/validation';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterFormValues) => {
    setSubmitError(null);
    try {
      await registerUser(values);
      // Belt-and-suspenders: by the time registerUser() resolves, the
      // correct profile doc is guaranteed to exist in Firestore. Force a
      // fresh read into AuthContext so the topbar shows the real name
      // immediately, regardless of what the auth-state listener's own
      // (independent, racing) load may have set in the meantime.
      await refreshProfile();
      navigate('/restaurants', { replace: true });
    } catch (err) {
      setSubmitError(toFriendlyErrorMessage(err));
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Set up your restaurant management workspace">
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack spacing={2.5}>
          {submitError && <Alert severity="error">{submitError}</Alert>}
          <Grid container spacing={2}>
            <Grid size={6}>
              <TextField
                label="First name"
                fullWidth
                autoFocus
                error={!!errors.firstName}
                helperText={errors.firstName?.message}
                {...register('firstName')}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                label="Last name"
                fullWidth
                error={!!errors.lastName}
                helperText={errors.lastName?.message}
                {...register('lastName')}
              />
            </Grid>
          </Grid>
          <TextField
            label="Email"
            type="email"
            fullWidth
            autoComplete="email"
            error={!!errors.email}
            helperText={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Phone (optional)"
            fullWidth
            error={!!errors.phone}
            helperText={errors.phone?.message}
            {...register('phone')}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            autoComplete="new-password"
            error={!!errors.password}
            helperText={errors.password?.message}
            {...register('password')}
          />
          <TextField
            label="Confirm password"
            type="password"
            fullWidth
            autoComplete="new-password"
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
          <Typography variant="body2" align="center" color="text.secondary">
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">
              Log in
            </Link>
          </Typography>
        </Stack>
      </Box>
    </AuthLayout>
  );
}
