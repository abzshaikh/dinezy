import type { Timestamp } from 'firebase/firestore';
import type { RoleId } from './permissions';

/**
 * `pending` -> `accepted` (by the invitee) or `revoked` (by an owner/admin)
 * or `declined` (by the invitee). Terminal states are never reopened — a
 * fresh invite is sent instead, same "never edit history, create a new
 * record" spirit as the append-only collections elsewhere in this app.
 */
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'declined';

/**
 * Team invite document, stored at the TOP LEVEL: `invites/{inviteId}`.
 *
 * Deliberately NOT a `restaurants/{restaurantId}/invites` subcollection.
 * That shape was tried in Phase 2, discovered via a `collectionGroup('invites')`
 * query, and permanently removed after three independent security-rules
 * redesigns all hit the same `permission-denied` error live-testing against
 * the real project — a Firestore rules query-provability limitation that
 * couldn't be resolved without live access to test against (see
 * PHASE_2_REPORT.md and the project doc's "IMPORTANT — Firestore rule
 * constraint" note). A top-level collection lets the invitee's own
 * `where('email','==', myEmail)` lookup stay a pure field comparison with
 * NO `get()`/`exists()` call anywhere near it, and lets the
 * restaurant-admin side's `where('restaurantId','==', X)` lookup pin its
 * `canManageUsers()` check to that same filtered value — mirroring the
 * `restaurantUsers` collection's own already-proven-working read rule
 * exactly (see PHASE_15_REPORT.md for the full design rationale).
 */
export interface RestaurantInvite {
  inviteId: string;
  restaurantId: string;
  /** Denormalized so the invitee's banner can show a restaurant name before they're a member and can read the restaurant doc. */
  restaurantName: string;
  /** Always lowercased/trimmed — compared against the invitee's Auth token email, also lowercased, on read/accept. */
  email: string;
  /** Never 'owner' — ownership is only ever established at restaurant creation, not granted through an invite. */
  role: RoleId;
  invitedBy: string;
  /** Denormalized so the invitee's banner can show who invited them without reading the inviter's own users/{userId} profile doc (self-only by rule). */
  invitedByName: string;
  status: InviteStatus;
  createdAt: Timestamp;
  acceptedAt: Timestamp | null;
  acceptedByUserId: string | null;
}

/** Shape used when sending a new invite (server-set fields omitted). */
export interface SendInviteInput {
  email: string;
  role: RoleId;
}
