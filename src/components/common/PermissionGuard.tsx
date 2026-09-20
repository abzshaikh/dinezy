import type { ReactNode } from 'react';
import { useRestaurant } from '../../contexts/RestaurantContext';
import type { Permission } from '../../types';

/**
 * Renders its children only if the current user has the given permission on
 * the currently-selected restaurant. This is a UX convenience for hiding
 * controls the user can't use — it is NOT the security boundary. The real
 * enforcement always happens in Firestore security rules; this component
 * just avoids showing someone a button that would fail server-side.
 */
export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: {
  permission: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasPermission } = useRestaurant();
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>;
}
