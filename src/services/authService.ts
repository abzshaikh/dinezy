import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword as firebaseUpdatePassword,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { AppError } from '../utils/errors';
import type { CreateUserProfileInput, UserProfile } from '../types';

const usersCol = () => 'users';

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

/**
 * Registers a new Firebase Auth user AND creates their `users/{userId}`
 * profile document. These two things are not transactional across services
 * (Auth and Firestore are different systems), so if the Firestore write
 * fails we still return the created auth user — callers should treat a
 * missing profile as recoverable (AuthContext retries profile creation on
 * next load) rather than fatal.
 */
export async function registerUser(input: RegisterInput): Promise<FirebaseUser> {
  const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
  await updateProfile(credential.user, { displayName: `${input.firstName} ${input.lastName}`.trim() });
  await ensureUserProfile({
    userId: credential.user.uid,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone ?? null,
  });
  return credential.user;
}

export async function loginUser(email: string, password: string): Promise<FirebaseUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function resetPassword(oobCode: string, newPassword: string): Promise<void> {
  await confirmPasswordReset(auth, oobCode, newPassword);
}

/** Creates the Firestore profile doc for a user if it doesn't already exist. Idempotent. */
export async function ensureUserProfile(input: CreateUserProfileInput): Promise<UserProfile> {
  const ref = doc(db, usersCol(), input.userId);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    return existing.data() as UserProfile;
  }
  const now = serverTimestamp();
  const profile = {
    userId: input.userId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone ?? null,
    profileImage: null,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, profile);
  const created = await getDoc(ref);
  return created.data() as UserProfile;
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const ref = doc(db, usersCol(), userId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export interface UpdateUserProfileInput {
  firstName: string;
  lastName: string;
  phone: string | null;
  profileImage: string | null;
}

/**
 * Updates the `users/{userId}` profile doc — name/phone/photo only, never
 * `email` (there's no in-app email-change flow — see the note on
 * `changeUserPassword` below — so the Firestore `email` field only ever
 * changes at registration; this function never touches it, on purpose,
 * rather than accidentally letting it drift from the real Firebase Auth
 * email). Also best-effort mirrors displayName/photoURL onto the Firebase
 * Auth user itself via `updateProfile` — used by e.g. password-reset emails and any
 * future Firebase-console-level view of the account; failure there is
 * logged but doesn't fail the whole save, since the Firestore doc (what
 * this app actually reads everywhere) is the source of truth.
 */
export async function updateUserProfile(userId: string, input: UpdateUserProfileInput): Promise<void> {
  const ref = doc(db, usersCol(), userId);
  await updateDoc(ref, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    profileImage: input.profileImage,
    updatedAt: serverTimestamp(),
  });

  const current = auth.currentUser;
  if (current) {
    try {
      await updateProfile(current, {
        displayName: `${input.firstName} ${input.lastName}`.trim(),
        photoURL: input.profileImage ?? undefined,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('updateProfile (Firebase Auth mirror) failed — Firestore profile still saved', err);
    }
  }
}

/**
 * Re-proves the user's identity with their CURRENT password before a
 * sensitive change (currently just password — an email-change card existed
 * briefly in Phase 10 and was removed at the user's request; this helper
 * stayed since password changes need the same reauthentication). Firebase
 * requires this — `updatePassword` throws `auth/requires-recent-login` if
 * the sign-in is more than a few minutes old, which is normal for a
 * session that's been open a while. Throws a friendly `AppError` (routed
 * through `toFriendlyErrorMessage` like any other error) if there's no
 * signed-in user at all — shouldn't happen since this only runs from
 * inside a protected route, but keeps the function total rather than
 * assuming.
 */
async function reauthenticate(currentPassword: string): Promise<FirebaseUser> {
  const current = auth.currentUser;
  if (!current?.email) {
    throw new AppError('You need to be signed in to do this.');
  }
  const credential = EmailAuthProvider.credential(current.email, currentPassword);
  await reauthenticateWithCredential(current, credential);
  return current;
}

/** Changes the account's sign-in password after confirming the current one. */
export async function changeUserPassword(currentPassword: string, newPassword: string): Promise<void> {
  const current = await reauthenticate(currentPassword);
  await firebaseUpdatePassword(current, newPassword);
}
