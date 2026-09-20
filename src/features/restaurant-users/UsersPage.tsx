import { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CancelIcon from '@mui/icons-material/Cancel';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatDate } from '../../utils/dates';
import type { SendInviteFormValues } from '../../utils/validation';
import { ROLE_IDS, ROLE_LABELS, type RestaurantInvite, type RestaurantUser, type RoleId } from '../../types';
import { listMembers, setMemberStatus, updateMemberRole } from '../../services/restaurantUserService';
import { listInvitesForRestaurant, revokeInvite, sendInvite } from '../../services/inviteService';
import { MemberPermissionsDialog } from './MemberPermissionsDialog';
import { SendInviteDialog } from './SendInviteDialog';

const NON_OWNER_ROLES = ROLE_IDS.filter((r) => r !== 'owner');

const INVITE_STATUS_COLOR: Record<RestaurantInvite['status'], 'warning' | 'success' | 'default'> = {
  pending: 'warning',
  accepted: 'success',
  revoked: 'default',
  declined: 'default',
};

const INVITE_STATUS_LABEL: Record<RestaurantInvite['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  revoked: 'Revoked',
  declined: 'Declined',
};

export function UsersPage() {
  const { profile } = useAuth();
  const { selectedRestaurant, membership: myMembership, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  // Guaranteed by RequireRestaurant wrapping every /app route.
  const restaurantId = selectedRestaurant!.restaurantId;
  const restaurantName = selectedRestaurant!.restaurantName;
  const canManage = hasPermission('users.manage');

  const [permissionsFor, setPermissionsFor] = useState<RestaurantUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<RestaurantUser | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<RestaurantInvite | null>(null);

  const membersQuery = useQuery({
    queryKey: ['restaurantUsers', restaurantId],
    queryFn: () => listMembers(restaurantId),
  });

  const invitesQuery = useQuery({
    queryKey: ['invites', restaurantId],
    queryFn: () => listInvitesForRestaurant(restaurantId),
    enabled: canManage,
  });

  const sendInviteMutation = useMutation({
    mutationFn: (values: SendInviteFormValues) =>
      sendInvite(
        restaurantId,
        restaurantName,
        values.email,
        values.role,
        profile!.userId,
        `${profile!.firstName} ${profile!.lastName}`.trim(),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', restaurantId] });
      enqueueSnackbar('Invite sent.', { variant: 'success' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', restaurantId] });
      enqueueSnackbar('Invite revoked.', { variant: 'success' });
      setRevokeTarget(null);
    },
    onError: (err) => {
      enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' });
      setRevokeTarget(null);
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: RoleId }) => updateMemberRole(restaurantId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurantUsers', restaurantId] });
      enqueueSnackbar('Role updated.', { variant: 'success' });
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'active' | 'suspended' }) =>
      setMemberStatus(restaurantId, userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurantUsers', restaurantId] });
      enqueueSnackbar('Member status updated.', { variant: 'success' });
      setStatusTarget(null);
    },
    onError: (err) => {
      enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' });
      setStatusTarget(null);
    },
  });

  if (membersQuery.isLoading) return <LoadingIndicator label="Loading team members…" />;
  if (membersQuery.isError) {
    return <ErrorState message={toFriendlyErrorMessage(membersQuery.error)} onRetry={() => membersQuery.refetch()} />;
  }

  const members = membersQuery.data ?? [];

  const invites = invitesQuery.data ?? [];
  const pendingInvites = invites.filter((i) => i.status === 'pending');

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Users
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage who has access to {selectedRestaurant?.restaurantName} and what they can do.
          </Typography>
        </Box>
        {canManage && (
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setInviteDialogOpen(true)}>
            Invite Member
          </Button>
        )}
      </Stack>

      <Paper variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Member</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Joined</TableCell>
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => {
                const isOwnerRow = member.role === 'owner';
                const isSelf = member.userId === myMembership?.userId;
                const canEditThisRow = canManage && !isOwnerRow;
                return (
                  <TableRow key={member.userId} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'secondary.main' }}>
                          {member.displayName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {member.displayName}
                            {isSelf ? ' (you)' : ''}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {member.email}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {canEditThisRow ? (
                        <Select
                          size="small"
                          value={member.role}
                          onChange={(e) =>
                            roleMutation.mutate({ userId: member.userId, role: e.target.value as RoleId })
                          }
                          disabled={roleMutation.isPending}
                        >
                          {NON_OWNER_ROLES.map((r) => (
                            <MenuItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Chip size="small" label={ROLE_LABELS[member.role]} variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={member.status === 'active' ? 'Active' : 'Suspended'}
                        color={member.status === 'active' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(member.joinedAt)}
                      </Typography>
                    </TableCell>
                    {canManage && (
                      <TableCell align="right">
                        {canEditThisRow && (
                          <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                            <Tooltip title="Permission overrides">
                              <IconButton size="small" onClick={() => setPermissionsFor(member)}>
                                <TuneIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={member.status === 'active' ? 'Suspend member' : 'Reactivate member'}>
                              <IconButton size="small" onClick={() => setStatusTarget(member)}>
                                {member.status === 'active' ? (
                                  <BlockIcon fontSize="small" />
                                ) : (
                                  <CheckCircleIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {canManage && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Invites
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {pendingInvites.length > 0
              ? `${pendingInvites.length} pending invite${pendingInvites.length === 1 ? '' : 's'}. An invite is accepted only once the person signs in with the exact email it was sent to.`
              : 'No pending invites. Send one to add a new team member — they never gain access to more than the role you pick until you change it.'}
          </Typography>
          {invitesQuery.isLoading ? (
            <LoadingIndicator label="Loading invites…" />
          ) : invites.length > 0 ? (
            <Paper variant="outlined">
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Sent</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite.inviteId} hover>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell>
                          <Chip size="small" label={ROLE_LABELS[invite.role]} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={INVITE_STATUS_LABEL[invite.status]}
                            color={INVITE_STATUS_COLOR[invite.status]}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(invite.createdAt)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {invite.status === 'pending' && (
                            <Tooltip title="Revoke invite">
                              <IconButton size="small" onClick={() => setRevokeTarget(invite)}>
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : null}
        </Box>
      )}

      <SendInviteDialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        onSubmit={(values) => sendInviteMutation.mutateAsync(values)}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke invite?"
        description={`${revokeTarget?.email} will no longer be able to accept this invite. You can always send a new one.`}
        confirmLabel="Revoke"
        destructive
        loading={revokeMutation.isPending}
        onConfirm={() => revokeTarget && revokeMutation.mutate(revokeTarget.inviteId)}
        onCancel={() => setRevokeTarget(null)}
      />

      {permissionsFor && (
        <MemberPermissionsDialog
          open
          member={permissionsFor}
          restaurantId={restaurantId}
          onClose={() => setPermissionsFor(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['restaurantUsers', restaurantId] });
            enqueueSnackbar('Permissions updated.', { variant: 'success' });
          }}
        />
      )}

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.status === 'active' ? 'Suspend member?' : 'Reactivate member?'}
        description={
          statusTarget?.status === 'active'
            ? `${statusTarget?.displayName} will immediately lose access to ${selectedRestaurant?.restaurantName}. Their history is kept and they can be reactivated any time.`
            : `${statusTarget?.displayName} will regain access to ${selectedRestaurant?.restaurantName}.`
        }
        confirmLabel={statusTarget?.status === 'active' ? 'Suspend' : 'Reactivate'}
        destructive={statusTarget?.status === 'active'}
        loading={statusMutation.isPending}
        onConfirm={() =>
          statusTarget &&
          statusMutation.mutate({
            userId: statusTarget.userId,
            status: statusTarget.status === 'active' ? 'suspended' : 'active',
          })
        }
        onCancel={() => setStatusTarget(null)}
      />
    </Box>
  );
}
