import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { ImageUploadField } from '../../components/common/ImageUploadField';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { changeUserPassword, updateUserProfile } from '../../services/authService';
import { toFriendlyErrorMessage } from '../../utils/errors';
import {
  accountProfileSchema,
  changePasswordSchema,
  type AccountProfileFormValues,
  type ChangePasswordFormValues,
} from '../../utils/validation';

/**
 * Personal account settings — `/app/settings`, the top-level "Settings" nav
 * item that had sat disabled since Phase 1. Deliberately distinct from
 * Restaurant Profile (`/app/restaurant/profile`, Phase 8): that page is
 * business/financial data shared by everyone at the restaurant and gated on
 * `restaurant.settings`; this page is about YOU as a signed-in user (name,
 * photo, password) and needs no restaurant permission at all — every
 * signed-in user can always edit their own account. See
 * `PHASE_10_REPORT.md` (and its "Removed" addendum — a change-email card
 * originally shipped here too but was removed at the user's request right
 * after Phase 10 landed, before ever being live-tested).
 *
 * Two independent cards/forms/mutations rather than one combined form:
 * editing your name/phone/photo is a plain Firestore write, but changing
 * your password requires re-confirming your current password (Firebase's
 * "recent login" requirement) — keeping them separate means a typo in the
 * profile fields never gets blocked on a password prompt, and vice versa.
 */
export function SettingsPage() {
  const { profile, loading, refreshProfile } = useAuth();

  if (loading || !profile) {
    return <LoadingIndicator label="Loading your account…" />;
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Your personal account — name, photo, and password. For restaurant
        business details (GST, currency, food cost target, etc.), see
        Restaurant Profile instead.
      </Typography>

      <Stack spacing={3}>
        <ProfileCard userId={profile.userId} profile={profile} onSaved={refreshProfile} />
        <ChangePasswordCard />
      </Stack>
    </Box>
  );
}

function ProfileCard({
  userId,
  profile,
  onSaved,
}: {
  userId: string;
  profile: { firstName: string; lastName: string; phone: string | null; profileImage: string | null };
  onSaved: () => Promise<void>;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [photo, setPhoto] = useState<string | null>(profile.profileImage);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountProfileFormValues>({
    resolver: zodResolver(accountProfileSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone ?? '',
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: AccountProfileFormValues) =>
      updateUserProfile(userId, {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone?.trim() || null,
        profileImage: photo,
      }),
    onSuccess: async () => {
      await onSaved();
      enqueueSnackbar('Profile updated.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Profile
      </Typography>
      <Box component="form" onSubmit={handleSubmit((v) => saveMutation.mutate(v))} noValidate>
        <Stack spacing={2.5}>
          <ImageUploadField label="Photo (optional)" value={photo} onChange={setPhoto} variant="round" />
          <TextField
            label="First name"
            fullWidth
            error={!!errors.firstName}
            helperText={errors.firstName?.message}
            {...register('firstName')}
          />
          <TextField
            label="Last name"
            fullWidth
            error={!!errors.lastName}
            helperText={errors.lastName?.message}
            {...register('lastName')}
          />
          <TextField
            label="Phone (optional)"
            fullWidth
            error={!!errors.phone}
            helperText={errors.phone?.message}
            {...register('phone')}
          />
          <Box>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save profile'}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}

function ChangePasswordCard() {
  const { enqueueSnackbar } = useSnackbar();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      changeUserPassword(values.currentPassword, values.newPassword),
    onSuccess: () => {
      reset();
      enqueueSnackbar('Password changed.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Password
      </Typography>
      <Box component="form" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <Stack spacing={2.5}>
          <TextField
            label="Current password"
            type="password"
            fullWidth
            error={!!errors.currentPassword}
            helperText={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <TextField
            label="New password"
            type="password"
            fullWidth
            error={!!errors.newPassword}
            helperText={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <TextField
            label="Confirm new password"
            type="password"
            fullWidth
            error={!!errors.confirmNewPassword}
            helperText={errors.confirmNewPassword?.message}
            {...register('confirmNewPassword')}
          />
          <Box>
            <Button type="submit" variant="contained" disabled={mutation.isPending}>
              {mutation.isPending ? 'Changing…' : 'Change password'}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
}
