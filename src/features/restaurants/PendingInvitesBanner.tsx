import { useState } from 'react';
import { Alert, Avatar, Box, Button, Paper, Stack, Typography } from '@mui/material';
import MailIcon from '@mui/icons-material/Mail';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { acceptInvite, declineInvite, listPendingInvitesForEmail } from '../../services/inviteService';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { ROLE_LABELS, type RestaurantInvite } from '../../types';

/**
 * Shown on "My Restaurants" (the natural landing spot before any restaurant
 * is selected) whenever the signed-in user's email has one or more pending
 * team invites. Entirely independent of RestaurantContext's restaurant
 * list/selection — an invite is, by definition, for a restaurant this user
 * is NOT a member of yet, so it would never show up there.
 */
export function PendingInvitesBanner() {
  const { profile } = useAuth();
  const { refreshRestaurants } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [actioningId, setActioningId] = useState<string | null>(null);

  const invitesQuery = useQuery({
    queryKey: ['pendingInvites', profile?.email],
    queryFn: () => listPendingInvitesForEmail(profile!.email),
    enabled: !!profile?.email,
  });

  const acceptMutation = useMutation({
    mutationFn: (invite: RestaurantInvite) =>
      acceptInvite(invite, profile!.userId, `${profile!.firstName} ${profile!.lastName}`.trim(), profile!.email),
    onMutate: (invite) => setActioningId(invite.inviteId),
    onSuccess: async (_data, invite) => {
      await queryClient.invalidateQueries({ queryKey: ['pendingInvites', profile?.email] });
      await refreshRestaurants();
      enqueueSnackbar(`You've joined ${invite.restaurantName}.`, { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
    onSettled: () => setActioningId(null),
  });

  const declineMutation = useMutation({
    mutationFn: (invite: RestaurantInvite) => declineInvite(invite.inviteId),
    onMutate: (invite) => setActioningId(invite.inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pendingInvites', profile?.email] });
      enqueueSnackbar('Invite declined.', { variant: 'info' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
    onSettled: () => setActioningId(null),
  });

  const invites = invitesQuery.data ?? [];
  if (!profile?.email || invitesQuery.isLoading || invites.length === 0) return null;

  return (
    <Stack spacing={1.5} sx={{ mb: 3 }}>
      <Alert severity="info" icon={<MailIcon fontSize="inherit" />} sx={{ alignItems: 'flex-start' }}>
        {invites.length === 1
          ? "You've been invited to join a restaurant."
          : `You've been invited to join ${invites.length} restaurants.`}
      </Alert>
      {invites.map((invite) => (
        <Paper key={invite.inviteId} variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>{invite.restaurantName.charAt(0).toUpperCase()}</Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                  {invite.restaurantName}
                </Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  Invited by {invite.invitedByName} as {ROLE_LABELS[invite.role]}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={() => declineMutation.mutate(invite)}
                disabled={actioningId === invite.inviteId}
              >
                Decline
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => acceptMutation.mutate(invite)}
                disabled={actioningId === invite.inviteId}
              >
                Accept
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}
