import { FirebaseError } from 'firebase/app';

/**
 * Converts a raw Firebase/Firestore error into a short, user-friendly
 * message. Never render `error.message` from Firebase directly in the UI —
 * always route it through this first. Full error details still go to the
 * console for debugging.
 */
export function toFriendlyErrorMessage(error: unknown): string {
  // eslint-disable-next-line no-console
  console.error(error);

  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'That email address looks invalid.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact support for help.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect email or password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try logging in instead.';
      case 'auth/weak-password':
        return 'Please choose a stronger password (at least 6 characters).';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled.';
      case 'auth/requires-recent-login':
        return 'For security, please log out and log back in before trying this again.';
      case 'auth/operation-not-allowed':
        return 'This isn’t enabled for your account yet. Contact support for help.';
      case 'permission-denied':
        return "You don't have permission to perform this action.";
      case 'not-found':
        return 'The requested item could not be found.';
      case 'already-exists':
        return 'That item already exists.';
      case 'unavailable':
        return 'Service is temporarily unavailable. Please try again shortly.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}

/** App-level error carrying an already-friendly message, thrown by services for business-rule violations. */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}
