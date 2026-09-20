import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppError } from '../utils/errors';
import { restaurantUserDocId, type RestaurantInvite, type RoleId } from '../types';

const invitesCol = () => collection(db, 'invites');
const restaurantUsersCol = () => collection(db, 'restaurantUsers');

/**
 * Sends a new invite. Ownership can never be granted this way — only the
 * restaurant's creator is ever an owner (see restaurantService.createRestaurant).
 */
export async function sendInvite(
  restaurantId: string,
  restaurantName: string,
  email: string,
  role: RoleId,
  invitedBy: string,
  invitedByName: string,
): Promise<void> {
  if (role === 'owner') {
    throw new AppError('Ownership can’t be granted through an invite.');
  }
  const ref = doc(invitesCol());
  await setDoc(ref, {
    inviteId: ref.id,
    restaurantId,
    restaurantName,
    email: email.trim().toLowerCase(),
    role,
    invitedBy,
    invitedByName,
    status: 'pending',
    createdAt: serverTimestamp(),
    acceptedAt: null,
    acceptedByUserId: null,
  });
}

/**
 * Every invite ever sent for a restaurant (any status), newest first.
 * Sorted CLIENT-SIDE rather than via `orderBy('createdAt')` — a
 * `where('restaurantId','==', X)` filter plus an `orderBy` on a different
 * field would need a new Firestore composite index (see the project doc's
 * "Incident 2"); a restaurant's invite list is small enough that a plain
 * equality-only query plus a client-side sort avoids that deploy step
 * entirely, same tradeoff Phase 3 made for the menu category/item lists.
 */
export async function listInvitesForRestaurant(restaurantId: string): Promise<RestaurantInvite[]> {
  const q = query(invitesCol(), where('restaurantId', '==', restaurantId));
  const snap = await getDocs(q);
  const invites = snap.docs.map((d) => d.data() as RestaurantInvite);
  return invites.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
}

/**
 * Pending invites addressed to the given (already-lowercased-at-write-time)
 * email, across ALL restaurants — this is what powers the "you've been
 * invited" banner shown before a restaurant is even selected. Both filters
 * are plain equality (`==`), so this needs no composite index either.
 */
export async function listPendingInvitesForEmail(email: string): Promise<RestaurantInvite[]> {
  const q = query(
    invitesCol(),
    where('email', '==', email.trim().toLowerCase()),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as RestaurantInvite);
}

/** Restaurant admin action: cancels a pending invite. Never reopened — send a fresh one instead. */
export async function revokeInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(invitesCol(), inviteId), { status: 'revoked' });
}

/** Invitee action: turns down a pending invite without joining. */
export async function declineInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(invitesCol(), inviteId), { status: 'declined' });
}

/**
 * Invitee action: accepts a pending invite. Creates the new restaurantUsers
 * membership doc and marks the invite accepted in one atomic batch — either
 * both happen or neither does, so an invite can never end up "accepted" with
 * no membership doc to show for it (or vice versa). Mirrors
 * restaurantService.createRestaurant's own batch-write shape for the same
 * reason: these two documents must never drift out of sync.
 */
export async function acceptInvite(
  invite: RestaurantInvite,
  userId: string,
  displayName: string,
  email: string,
): Promise<void> {
  const membershipRef = doc(restaurantUsersCol(), restaurantUserDocId(invite.restaurantId, userId));
  const inviteRef = doc(invitesCol(), invite.inviteId);
  const now = serverTimestamp();

  const batch = writeBatch(db);
  batch.set(membershipRef, {
    restaurantId: invite.restaurantId,
    userId,
    displayName,
    email: email.trim().toLowerCase(),
    role: invite.role,
    permissionOverrides: null,
    status: 'active',
    invitedBy: invite.invitedBy,
    invitedEmail: invite.email,
    acceptedFromInviteId: invite.inviteId,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  batch.update(inviteRef, {
    status: 'accepted',
    acceptedAt: now,
    acceptedByUserId: userId,
  });
  await batch.commit();
}
