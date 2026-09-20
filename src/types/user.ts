import type { Timestamp } from 'firebase/firestore';

/**
 * User profile document stored at: users/{userId}
 * This is the ONLY collection keyed directly by Firebase Auth uid at top level
 * besides restaurantUsers. It holds identity info that is NOT restaurant-specific.
 */
export interface UserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Shape used when creating a new user profile (server-set fields omitted). */
export interface CreateUserProfileInput {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
}
