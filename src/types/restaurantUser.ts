import type { Timestamp } from 'firebase/firestore';
import type { Permission, RoleId } from './permissions';

export type RestaurantUserStatus = 'active' | 'suspended';

/**
 * Membership document stored at: restaurantUsers/{restaurantId}_{userId}
 * The composite doc ID lets Firestore security rules do a single get()
 * to check membership, instead of running a query inside a rule.
 * Also independently queryable by `userId` (for "my restaurants") and by
 * `restaurantId` (for "manage users" screens) via indexes.
 *
 * `displayName`/`email` are deliberately DENORMALIZED (copied from the
 * user's own profile at join time) so the Users page can list members
 * without needing to read other users' `users/{userId}` profile docs —
 * those stay strictly self-only in firestore.rules.
 *
 * `invitedBy`/`invitedEmail`/`acceptedFromInviteId` were reserved fields
 * from a team-invite feature attempted and removed in Phase 2 (see
 * PHASE_2_REPORT.md) — null for every doc created before Phase 15. As of
 * Phase 15, a membership doc created by accepting an invite (see
 * acceptInvite() in inviteService.ts) populates all three; the restaurant's
 * original owner's doc still sets them to null (see createRestaurant() in
 * restaurantService.ts) since there was no invite involved.
 */
export interface RestaurantUser {
  restaurantId: string;
  userId: string;
  displayName: string;
  email: string;
  role: RoleId;
  /** Grant (true) or revoke (false) individual permissions on top of the role's defaults. */
  permissionOverrides: Partial<Record<Permission, boolean>> | null;
  status: RestaurantUserStatus;
  /** uid of whoever sent the invite this membership was accepted from (null for the restaurant's original owner). */
  invitedBy: string | null;
  /** email the invite was sent to (should match `email` above; kept for audit trail). */
  invitedEmail: string | null;
  /** id of the RestaurantInvite doc this membership was created from (null for the owner). */
  acceptedFromInviteId: string | null;
  joinedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export function restaurantUserDocId(restaurantId: string, userId: string): string {
  return `${restaurantId}_${userId}`;
}
