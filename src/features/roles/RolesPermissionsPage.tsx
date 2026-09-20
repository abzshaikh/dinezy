import { Fragment } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  PERMISSIONS,
  PERMISSION_GROUP_LABELS,
  ROLE_IDS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  groupPermissions,
} from '../../types';

/**
 * Read-only reference matrix — every fixed role down the columns, every
 * granular permission across the rows. This is the "what does each role
 * actually let someone do" answer; per-person adjustments on top of a role
 * happen on the Users page (permission overrides), not here.
 */
export function RolesPermissionsPage() {
  const grouped = groupPermissions(PERMISSIONS);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
        Roles & Permissions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Every restaurant uses this same fixed set of roles. An owner can grant or revoke individual permissions for
        a specific person from the Users page — those overrides aren't shown here since they vary per person.
      </Typography>

      <Paper variant="outlined">
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>Permission</TableCell>
                {ROLE_IDS.map((role) => (
                  <TableCell key={role} align="center" sx={{ fontWeight: 700, minWidth: 120 }}>
                    {ROLE_LABELS[role]}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(grouped).map(([group, perms]) => (
                <Fragment key={group}>
                  <TableRow>
                    <TableCell
                      colSpan={ROLE_IDS.length + 1}
                      sx={{ bgcolor: 'action.hover', fontWeight: 700, py: 0.75 }}
                    >
                      {PERMISSION_GROUP_LABELS[group] ?? group}
                    </TableCell>
                  </TableRow>
                  {perms.map((perm) => (
                    <TableRow key={perm} hover>
                      <TableCell>
                        <Typography variant="body2">{perm}</Typography>
                      </TableCell>
                      {ROLE_IDS.map((role) => {
                        const granted = ROLE_PERMISSIONS[role].includes(perm);
                        return (
                          <TableCell key={role} align="center">
                            {granted ? (
                              <CheckIcon fontSize="small" color="success" />
                            ) : (
                              <RemoveIcon fontSize="small" color="disabled" />
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
