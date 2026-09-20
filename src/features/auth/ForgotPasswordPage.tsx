import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { requestPasswordReset } from '../../services/authService';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../../utils/validation';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setSubmitError(null);
    try {
      await requestPasswordReset(values.email);
      setSent(true);
    } catch (err) {
      // Intentionally do not reveal whether the email exists — avoid
      // account enumeration — but still surface real errors (network, etc.)
      setSubmitError(toFriendlyErrorMessage(err));
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to reset it">
      {sent ? (
        <Stack spacing={2}>
          <Alert severity="success">
            If an account exists for that email, a password reset link is on its way.
          </Alert>
          <Typography variant="body2" align="center">
            <Link component={RouterLink} to="/login">
              Back to log in
            </Link>
          </Typography>
        </Stack>
      ) : (
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2.5}>
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <TextField
              label="Email"
              type="email"
              fullWidth
              autoFocus
              autoComplete="email"
              error={!!errors.email}
              helperText={errors.email?.message}
              {...register('email')}
            />
            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
            <Typography variant="body2" align="center" color="text.secondary">
              <Link component={RouterLink} to="/login">
                Back to log in
              </Link>
            </Typography>
          </Stack>
        </Box>
      )}
    </AuthLayout>
  );
}
