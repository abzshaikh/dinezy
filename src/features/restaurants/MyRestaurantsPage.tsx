import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { logoutUser } from '../../services/authService';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { EmptyState } from '../../components/common/EmptyState';
import { PendingInvitesBanner } from './PendingInvitesBanner';

export function MyRestaurantsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { restaurants, loadingRestaurants, selectRestaurant } = useRestaurant();

  const handleSelect = (restaurantId: string) => {
    selectRestaurant(restaurantId);
    navigate('/app/dashboard');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between', py: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Restaurant Manager
            </Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {profile ? `${profile.firstName} ${profile.lastName}` : ''}
              </Typography>
              <Button startIcon={<LogoutIcon />} onClick={() => logoutUser()} size="small">
                Log out
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              My Restaurants
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select a restaurant to manage, or create a new one.
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/restaurants/new')}>
            New Restaurant
          </Button>
        </Stack>

        <PendingInvitesBanner />

        {loadingRestaurants ? (
          <LoadingIndicator label="Loading your restaurants…" />
        ) : restaurants.length === 0 ? (
          <EmptyState
            icon={<StorefrontIcon fontSize="inherit" />}
            title="No restaurants yet"
            description="Create your first restaurant to start managing menu, inventory, purchases, and profit & loss."
            actionLabel="Create Restaurant"
            onAction={() => navigate('/restaurants/new')}
          />
        ) : (
          <Grid container spacing={3}>
            {restaurants.map((restaurant) => (
              <Grid key={restaurant.restaurantId} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant="outlined">
                  <CardActionArea onClick={() => handleSelect(restaurant.restaurantId)}>
                    <CardContent>
                      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 1.5 }}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {restaurant.restaurantName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
                            {restaurant.restaurantName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {[restaurant.city, restaurant.country].filter(Boolean).join(', ') || 'No address set'}
                          </Typography>
                        </Box>
                      </Stack>
                      <Chip
                        size="small"
                        label={restaurant.status === 'active' ? 'Active' : restaurant.status}
                        color={restaurant.status === 'active' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
