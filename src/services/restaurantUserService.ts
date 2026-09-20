import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppError } from '../utils/errors';
import { restaurantUserDocId, type Permission, type RestaurantUser, type RestaurantUserStatus, type RoleId } from '../types';

const restaurantUsersCol = () => collection(db, 'restaurantUsers');

/** Lists every member (active or suspended) of a restaurant, oldest first. */
export async function listMembers(restaurantId: string): Promise<RestaurantUser[]> {
  const q = query(restaurantUsersCol(), where('restaurantId', '==', restaurantId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as RestaurantUser);
}

/** Changes a non-owner member's role and resets any permission overrides (a fresh role starts from that role's defaults). */
export async function updateMemberRole(restaurantId: string, userId: string, role: RoleId): Promise<void> {
  if (role === 'owner') {
    throw new AppError('Ownership can’t be reassigned this way.');
  }
  const ref = doc(restaurantUsersCol(), restaurantUserDocId(restaurantId, userId));
  await updateDoc(ref, { role, permissionOverrides: null, updatedAt: serverTimestamp() });
}

/** Suspends or reactivates a non-owner member. Suspended members keep their history but lose access (enforced by firestore.rules' isMember() check). */
export async function setMemberStatus(restaurantId: string, userId: string, status: RestaurantUserStatus): Promise<void> {
  const ref = doc(restaurantUsersCol(), restaurantUserDocId(restaurantId, userId));
  await updateDoc(ref, { status, updatedAt: serverTimestamp() });
}

/** Grants/revokes one specific permission for a member, on top of their role's defaults. */
export async function updateMemberPermissionOverride(
  restaurantId: string,
  userId: string,
  permission: Permission,
  granted: boolean | null,
): Promise<void> {
  const ref = doc(restaurantUsersCol(), restaurantUserDocId(restaurantId, userId));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new AppError('That member could not be found.');
  const current = (snap.data() as RestaurantUser).permissionOverrides ?? {};
  const next = { ...current };
  if (granted === null) {
    delete next[permission];
  } else {
    next[permission] = granted;
  }
  await updateDoc(ref, { permissionOverrides: Object.keys(next).length ? next : null, updatedAt: serverTimestamp() });
}
