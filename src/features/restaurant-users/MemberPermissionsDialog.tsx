import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { updateMemberPermissionOverride } from '../../services/restaurantUserService';
import { toFriendlyErrorMessage } from '../../utils/errors';
import {
  PERMISSIONS,
  PERMISSION_GROUP_LABELS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  groupPermissions,
  type Permission,
  type RestaurantUser,
} from '../../types';

interface MemberPermissionsDialogProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  member: RestaurantUser;
  onSaved: () => void;
}

/**
 * Per-member permission overrides on top of their role's defaults — this is
 * the "granular permission system" piece: an owner can grant or revoke any
 * individual permission for one person without needing a whole custom role.
 * Checked = effective permission right now (role default, adjusted by any
 * existing override). Toggling a box that matches the role default again
 * clears the override entirely rather than storing a redundant one.
 */
export function MemberPermissionsDialog({ open, onClose, restaurantId, member, onSaved }: MemberPermissionsDialogProps) {
  const roleDefaults = useMemo(() => new Set(ROLE_PERMISSIONS[member.role]), [member.role]);
  const [overrides, setOverrides] = useState<Partial<Record<Permission, boolean>>>(member.permissionOverrides ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const grouped = useMemo(() => groupPermissions(PERMISSIONS), []);

  const isChecked = (perm: Permission) => overrides[perm] ?? roleDefaults.has(perm);
  const isOverridden = (perm: Permission) => perm in overrides;

  const toggle = (perm: Permission) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const currentlyChecked = next[perm] ?? roleDefaults.has(perm);
      const newValue = !currentlyChecked;
      if (newValue === roleDefaults.has(perm)) {
        delete next[perm]; // matches the role default again — no override needed
      } else {
        next[perm] = newValue;
      }
      return next;
    });
  };

  const dirtyPerms = useMemo(
    () => PERMISSIONS.filter((p) => (overrides[p] ?? null) !== (member.permissionOverrides?.[p] ?? null)),
    [overrides, member.permissionOverrides],
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const perm of dirtyPerms) {
        await updateMemberPermissionOverride(restaurantId, member.userId, perm, overrides[perm] ?? null);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(toFriendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Permissions — {member.displayName}
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400, mt: 0.5 }}>
          Base role: {ROLE_LABELS[member.role]}. Checked items follow the role by default — toggle any to grant or
          revoke it individually for this person.
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Stack spacing={2}>
          {Object.entries(grouped).map(([group, perms]) => (
            <Box key={group}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                {PERMISSION_GROUP_LABELS[group] ?? group}
              </Typography>
              <Stack sx={{ pl: 1 }}>
                {perms.map((perm) => (
                  <FormControlLabel
                    key={perm}
                    control={<Checkbox size="small" checked={isChecked(perm)} onChange={() => toggle(perm)} />}
                    label={
                      <Typography variant="body2" component="span">
                        {perm}
                        {isOverridden(perm) && (
                          <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 1 }}>
                            (override)
                          </Typography>
                        )}
                      </Typography>
                    }
                  />
                ))}
              </Stack>
              <Divider sx={{ mt: 1 }} />
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || dirtyPerms.length === 0}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
