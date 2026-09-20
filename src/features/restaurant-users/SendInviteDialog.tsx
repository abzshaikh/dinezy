import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material';
import { sendInviteSchema, type SendInviteFormValues } from '../../utils/validation';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { ROLE_IDS, ROLE_LABELS } from '../../types';

const NON_OWNER_ROLES = ROLE_IDS.filter((r) => r !== 'owner');

interface SendInviteDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: SendInviteFormValues) => Promise<void>;
}

/**
 * Sends an invite by email — does NOT create any account or membership
 * itself. The invitee (who must sign up or log in with this exact email)
 * sees it as a banner on "My Restaurants" and accepts/declines it there —
 * see PendingInvitesBanner.tsx. Nothing here can grant the 'owner' role.
 */
export function SendInviteDialog({ open, onClose, onSubmit }: SendInviteDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SendInviteFormValues>({
    resolver: zodResolver(sendInviteSchema),
    defaultValues: { email: '', role: 'manager' },
  });

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
      reset();
      onClose();
    } catch (err) {
      setError(toFriendlyErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Invite a team member</DialogTitle>
      <form onSubmit={submit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Email address"
              fullWidth
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message ?? "They'll need to sign in with this exact email to see the invite."}
            />
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Role" fullWidth error={!!errors.role} helperText={errors.role?.message}>
                  {NON_OWNER_ROLES.map((r) => (
                    <MenuItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send Invite'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
