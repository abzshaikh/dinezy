import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AppError } from '../utils/errors';
import {
  DEFAULT_RESTAURANT_SETTINGS,
  restaurantUserDocId,
  type CreateRestaurantInput,
  type Restaurant,
  type RestaurantUser,
  type UpdateRestaurantInput,
} from '../types';

const restaurantsCol = () => collection(db, 'restaurants');
const restaurantUsersCol = () => collection(db, 'restaurantUsers');

/**
 * Creates a restaurant and the owner's membership doc together in a single
 * atomic batch write. Both documents must succeed or neither does — this is
 * the one place client-side where we need restaurant + restaurantUsers to
 * stay in lockstep, so a batch (not two separate calls) is required.
 */
export async function createRestaurant(
  ownerId: string,
  input: CreateRestaurantInput,
  owner: { displayName: string; email: string },
): Promise<Restaurant> {
  const restaurantRef = doc(restaurantsCol());
  const restaurantId = restaurantRef.id;
  const membershipRef = doc(restaurantUsersCol(), restaurantUserDocId(restaurantId, ownerId));

  const now = serverTimestamp();

  const restaurantData = {
    restaurantId,
    restaurantName: input.restaurantName.trim(),
    legalName: input.legalName?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    country: input.country?.trim() || 'India',
    pincode: input.pincode?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    gstNumber: input.gstNumber?.trim() || null,
    fssaiNumber: input.fssaiNumber?.trim() || null,
    currency: input.currency || 'INR',
    timezone: input.timezone || 'Asia/Kolkata',
    logo: null,
    ownerId,
    status: 'active' as const,
    settings: DEFAULT_RESTAURANT_SETTINGS,
    createdAt: now,
    updatedAt: now,
  };

  const membershipData = {
    restaurantId,
    userId: ownerId,
    displayName: owner.displayName,
    email: owner.email.trim().toLowerCase(),
    role: 'owner' as const,
    permissionOverrides: null,
    status: 'active' as const,
    invitedBy: null,
    invitedEmail: null,
    acceptedFromInviteId: null,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const batch = writeBatch(db);
  batch.set(restaurantRef, restaurantData);
  batch.set(membershipRef, membershipData);
  await batch.commit();

  const created = await getDoc(restaurantRef);
  if (!created.exists()) {
    throw new AppError('Restaurant was created but could not be loaded back.');
  }
  return created.data() as Restaurant;
}

/**
 * Lists every restaurant the given user has an ACTIVE membership in. Two
 * reads: first the membership docs (indexed by userId), then the
 * restaurant docs they point to. Kept as two steps rather than a Firestore
 * "in" join because membership count per user is small (a handful of
 * restaurants at most).
 */
export async function listMyRestaurants(userId: string): Promise<Restaurant[]> {
  const membershipQuery = query(
    restaurantUsersCol(),
    where('userId', '==', userId),
    where('status', '==', 'active'),
  );
  const membershipSnap = await getDocs(membershipQuery);
  const restaurantIds = membershipSnap.docs.map((d) => (d.data() as RestaurantUser).restaurantId);

  if (restaurantIds.length === 0) return [];

  const restaurants = await Promise.all(
    restaurantIds.map(async (id) => {
      const snap = await getDoc(doc(restaurantsCol(), id));
      return snap.exists() ? (snap.data() as Restaurant) : null;
    }),
  );

  return restaurants.filter((r): r is Restaurant => r !== null && r.status !== 'archived');
}

export async function fetchRestaurant(restaurantId: string): Promise<Restaurant | null> {
  const snap = await getDoc(doc(restaurantsCol(), restaurantId));
  return snap.exists() ? (snap.data() as Restaurant) : null;
}

export async function fetchMembership(restaurantId: string, userId: string): Promise<RestaurantUser | null> {
  const snap = await getDoc(doc(restaurantUsersCol(), restaurantUserDocId(restaurantId, userId)));
  return snap.exists() ? (snap.data() as RestaurantUser) : null;
}

/**
 * Updates a restaurant's business-info profile and settings (Phase 8, the
 * Restaurant Profile page). Never touches `ownerId`, `restaurantId`, or
 * `status` — this type doesn't even carry them — matching the
 * `firestore.rules` invariant on this doc's `update` rule. Plain
 * `updateDoc`, not a transaction: nothing here depends on reading a
 * current value first, it's a straight overwrite of the fields the form
 * collected.
 */
export async function updateRestaurant(restaurantId: string, input: UpdateRestaurantInput): Promise<void> {
  const ref = doc(restaurantsCol(), restaurantId);
  await updateDoc(ref, {
    restaurantName: input.restaurantName.trim(),
    legalName: input.legalName?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    country: input.country?.trim() || null,
    pincode: input.pincode?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    gstNumber: input.gstNumber?.trim() || null,
    fssaiNumber: input.fssaiNumber?.trim() || null,
    currency: input.currency,
    timezone: input.timezone,
    logo: input.logo,
    settings: input.settings,
    updatedAt: serverTimestamp(),
  });
}
