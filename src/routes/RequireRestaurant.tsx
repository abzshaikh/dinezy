import { Navigate, Outlet } from 'react-router-dom';
import { useRestaurant } from '../contexts/RestaurantContext';
import { LoadingIndicator } from '../components/common/LoadingIndicator';

/** Blocks access to restaurant-scoped routes (everything under /app) until a restaurant is selected. */
export function RequireRestaurant() {
  const { selectedRestaurant, loadingRestaurants } = useRestaurant();

  if (loadingRestaurants) return <LoadingIndicator fullScreen label="Loading restaurant…" />;

  if (!selectedRestaurant) {
    return <Navigate to="/restaurants" replace />;
  }

  return <Outlet />;
}
