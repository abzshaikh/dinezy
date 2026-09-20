import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { fetchMembership, listMyRestaurants } from '../services/restaurantService';
import { resolvePermissions, type Permission, type Restaurant, type RestaurantUser } from '../types';

const SELECTED_RESTAURANT_STORAGE_KEY = 'rms.selectedRestaurantId';

interface RestaurantContextValue {
  restaurants: Restaurant[];
  loadingRestaurants: boolean;
  selectedRestaurant: Restaurant | null;
  membership: RestaurantUser | null;
  permissions: Set<Permission>;
  hasPermission: (permission: Permission) => boolean;
  selectRestaurant: (restaurantId: string) => void;
  clearSelectedRestaurant: () => void;
  refreshRestaurants: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextValue | undefined>(undefined);

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(() =>
    localStorage.getItem(SELECTED_RESTAURANT_STORAGE_KEY),
  );
  const [membership, setMembership] = useState<RestaurantUser | null>(null);

  const refreshRestaurants = useCallback(async () => {
    if (!firebaseUser) {
      setRestaurants([]);
      setLoadingRestaurants(false);
      return;
    }
    setLoadingRestaurants(true);
    const list = await listMyRestaurants(firebaseUser.uid);
    setRestaurants(list);
    setLoadingRestaurants(false);
  }, [firebaseUser]);

  useEffect(() => {
    void refreshRestaurants();
  }, [refreshRestaurants]);

  useEffect(() => {
    if (!firebaseUser || !selectedRestaurantId) {
      setMembership(null);
      return;
    }
    let cancelled = false;
    void fetchMembership(selectedRestaurantId, firebaseUser.uid).then((m) => {
      if (!cancelled) setMembership(m);
    });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, selectedRestaurantId]);

  // If the previously-selected restaurant is no longer in the user's list
  // (e.g. removed, or belonged to a different account), clear the selection.
  useEffect(() => {
    if (!loadingRestaurants && selectedRestaurantId && !restaurants.some((r) => r.restaurantId === selectedRestaurantId)) {
      setSelectedRestaurantId(null);
      localStorage.removeItem(SELECTED_RESTAURANT_STORAGE_KEY);
    }
  }, [loadingRestaurants, restaurants, selectedRestaurantId]);

  const selectRestaurant = useCallback((restaurantId: string) => {
    setSelectedRestaurantId(restaurantId);
    localStorage.setItem(SELECTED_RESTAURANT_STORAGE_KEY, restaurantId);
  }, []);

  const clearSelectedRestaurant = useCallback(() => {
    setSelectedRestaurantId(null);
    localStorage.removeItem(SELECTED_RESTAURANT_STORAGE_KEY);
  }, []);

  const selectedRestaurant = useMemo(
    () => restaurants.find((r) => r.restaurantId === selectedRestaurantId) ?? null,
    [restaurants, selectedRestaurantId],
  );

  const permissions = useMemo(() => {
    if (!membership) return new Set<Permission>();
    return resolvePermissions(membership.role, membership.permissionOverrides);
  }, [membership]);

  const hasPermission = useCallback((permission: Permission) => permissions.has(permission), [permissions]);

  const value = useMemo<RestaurantContextValue>(
    () => ({
      restaurants,
      loadingRestaurants,
      selectedRestaurant,
      membership,
      permissions,
      hasPermission,
      selectRestaurant,
      clearSelectedRestaurant,
      refreshRestaurants,
    }),
    [
      restaurants,
      loadingRestaurants,
      selectedRestaurant,
      membership,
      permissions,
      hasPermission,
      selectRestaurant,
      clearSelectedRestaurant,
      refreshRestaurants,
    ],
  );

  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

export function useRestaurant(): RestaurantContextValue {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error('useRestaurant must be used within RestaurantProvider');
  return ctx;
}
