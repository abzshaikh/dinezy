import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { resetPassword } from '../../services/authService';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { resetPasswordSchema, type ResetPasswordFormValues } from '../../utils/validation';
import { AuthLayout } from './AuthLayout';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!oobCode) {
      setSubmitError('This reset link is invalid or has expired. Please request a new one.');
      return;
    }
    setSubmitError(null);
    try {
      await resetPassword(oobCode, values.password);
      setDone(true);
    } catch (err) {
      setSubmitError(toFriendlyErrorMessage(err));
    }
  };

  if (!oobCode) {
    return (
      <AuthLayout title="Invalid link">
        <Alert severity="error" sx={{ mb: 2 }}>
          This password reset link is invalid or has expired.
        </Alert>
        <Typography variant="body2" align="center">
          <Link component={RouterLink} to="/forgot-password">
            Request a new link
          </Link>
        </Typography>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password">
      {done ? (
        <Stack spacing={2}>
          <Alert severity="success">Your password has been reset.</Alert>
          <Typography variant="body2" align="center">
            <Link component={RouterLink} to="/login">
              Continue to log in
            </Link>
          </Typography>
        </Stack>
      ) : (
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <TextField
              label="New password"
              type="password"
              fullWidth
              autoFocus
              error={!!errors.password}
              helperText={errors.password?.message}
              {...register('password')}
            />
            <TextField
              label="Confirm new password"
              type="password"
              fullWidth
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Reset password'}
            </Button>
          </Stack>
        </Box>
      )}
    </AuthLayout>
  );
}
