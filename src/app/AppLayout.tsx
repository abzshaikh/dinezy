import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import PointOfSaleRoundedIcon from '@mui/icons-material/PointOfSaleRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import { useAuth } from '../contexts/AuthContext';
import { useRestaurant } from '../contexts/RestaurantContext';
import { logoutUser } from '../services/authService';
import { NAV_SECTIONS, type NavSection } from './navConfig';
import { ROLE_LABELS } from '../types';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { PageTransition } from '../components/common/PageTransition';
import { AuroraBackdrop } from '../components/common/AuroraBackdrop';

const DRAWER_WIDTH = 264;
const SIDEBAR_MARGIN = 20;
const SIDEBAR_OFFSET = SIDEBAR_MARGIN + DRAWER_WIDTH + SIDEBAR_MARGIN;
const BOTTOM_NAV_HEIGHT = 78;

/**
 * App shell for the "Aurora Bento" redesign (see theme.ts). Desktop gets a
 * floating glass dock sidebar (a permanent Drawer whose paper is inset with
 * margin + rounded corners rather than flush to the screen edge). Mobile
 * drops the old hamburger + full-height drawer entirely in favor of a
 * floating glass pill bottom nav with the handful of destinations people
 * actually reach for on a phone, plus a "More" tab that opens a swipe-up
 * glass sheet with the complete nav tree — a deliberately different
 * mobile IA from "shrink the desktop drawer", per the redesign brief.
 */
export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { profile } = useAuth();
  const { selectedRestaurant, membership, restaurants } = useRestaurant();
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  // Accordion — only one nav section (e.g. "Restaurant", "Menu") expanded
  // at a time. Opening a new one collapses whichever was open before,
  // rather than letting the list grow indefinitely tall as sections stack.
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  const toggleSection = (label: string) =>
    setOpenSection((prev) => (prev === label ? null : label));

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navContent = (onNavigate?: () => void) => (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ gap: 1.5 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '11px',
            backgroundImage: (t) => `linear-gradient(140deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: (t) => `0 8px 18px ${t.palette.secondary.main}59`,
            flexShrink: 0,
          }}
        >
          <RestaurantIcon fontSize="small" />
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: 14.5 }} noWrap>
          {selectedRestaurant?.restaurantName ?? 'Restaurant'}
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'divider' }} />
      <List sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1 }}>
        {NAV_SECTIONS.map((section) => (
          <NavSectionItem
            key={section.label}
            section={section}
            open={openSection === section.label}
            onToggle={() => toggleSection(section.label)}
            onNavigate={onNavigate}
          />
        ))}
      </List>
      <Divider sx={{ borderColor: 'divider' }} />
      {restaurants.length > 1 && (
        <ListItemButton
          onClick={() => {
            onNavigate?.();
            navigate('/restaurants');
          }}
          sx={{ py: 1.5 }}
        >
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Switch Restaurant" slotProps={{ primary: { variant: 'body2' } }} />
        </ListItemButton>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', position: 'relative', bgcolor: 'background.default' }}>
      {isDark && <AuroraBackdrop />}

      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${SIDEBAR_OFFSET}px)` },
          ml: { md: `${SIDEBAR_OFFSET}px` },
        }}
      >
        <Toolbar sx={{ justifyContent: 'flex-end' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            {membership && (
              <Chip size="small" label={ROLE_LABELS[membership.role]} variant="outlined" />
            )}
            <ThemeToggle size="small" />
            <Tooltip title="Account">
              <IconButton onClick={(e) => setUserMenuAnchor(e.currentTarget)} size="small">
                <Avatar
                  src={profile?.profileImage ?? undefined}
                  sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 14 }}
                >
                  {profile ? profile.firstName.charAt(0).toUpperCase() : '?'}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Stack>
          <Menu anchorEl={userMenuAnchor} open={!!userMenuAnchor} onClose={() => setUserMenuAnchor(null)}>
            <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {profile ? `${profile.firstName} ${profile.lastName}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {profile?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem
              onClick={() => {
                setUserMenuAnchor(null);
                navigate('/restaurants');
              }}
            >
              My Restaurants
            </MenuItem>
            <MenuItem
              onClick={() => {
                setUserMenuAnchor(null);
                navigate('/app/settings');
              }}
            >
              Settings
            </MenuItem>
            <MenuItem onClick={() => logoutUser()}>Log out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Desktop: floating glass dock sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: SIDEBAR_OFFSET,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            position: 'fixed',
            width: DRAWER_WIDTH,
            top: SIDEBAR_MARGIN,
            left: SIDEBAR_MARGIN,
            height: `calc(100% - ${SIDEBAR_MARGIN * 2}px)`,
            borderRadius: '28px',
            boxSizing: 'border-box',
          },
        }}
        open
      >
        {navContent()}
      </Drawer>

      {/* Mobile: swipe-up "More" sheet with the full nav tree */}
      <Drawer
        anchor="bottom"
        open={moreSheetOpen}
        onClose={() => setMoreSheetOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            borderRadius: '28px 28px 0 0',
            maxHeight: '82vh',
            pb: 2,
          },
        }}
      >
        <Box sx={{ width: 36, height: 4, borderRadius: '999px', bgcolor: 'divider', mx: 'auto', mt: 1.5, mb: 0.5 }} />
        {navContent(() => setMoreSheetOpen(false))}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 2, sm: 3 }, pb: { xs: `${BOTTOM_NAV_HEIGHT + 32}px`, md: 3 } }}>
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </Box>
      </Box>

      {/* Mobile: floating glass pill bottom nav */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          left: 16,
          right: 16,
          bottom: 16,
          zIndex: (t) => t.zIndex.appBar,
          bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'background.paper',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '999px',
          boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.4)' : '0 20px 40px rgba(28,35,33,0.14)',
          height: BOTTOM_NAV_HEIGHT,
          alignItems: 'center',
          justifyContent: 'space-around',
          px: 1,
        }}
      >
        <BottomNavItem
          icon={<DashboardRoundedIcon />}
          active={isActive('/app/dashboard')}
          onClick={() => navigate('/app/dashboard')}
        />
        <BottomNavItem
          icon={<PointOfSaleRoundedIcon />}
          active={isActive('/app/sales')}
          onClick={() => navigate('/app/sales/daily')}
        />
        <Box
          onClick={() => navigate('/app/billing/invoices/new')}
          sx={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backgroundImage: (t) => `linear-gradient(140deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
            boxShadow: (t) => `0 0 22px ${alphaHex(t.palette.secondary.main, 0.5)}`,
            color: 'primary.contrastText',
            flexShrink: 0,
          }}
        >
          <AddRoundedIcon />
        </Box>
        <BottomNavItem
          icon={<AssessmentRoundedIcon />}
          active={isActive('/app/reports')}
          onClick={() => navigate('/app/reports/sales')}
        />
        <BottomNavItem icon={<MoreHorizRoundedIcon />} active={moreSheetOpen} onClick={() => setMoreSheetOpen(true)} />
      </Box>
    </Box>
  );
}

function alphaHex(hex: string, opacity: number) {
  const alphaChannel = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${alphaChannel}`;
}

function BottomNavItem({ icon, active, onClick }: { icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: '16px',
        cursor: 'pointer',
        color: active ? 'primary.main' : 'text.secondary',
        bgcolor: active ? (t) => `${t.palette.primary.main}26` : 'transparent',
        boxShadow: active ? (t) => `0 0 16px ${t.palette.primary.main}40` : 'none',
        transition: 'background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease',
      }}
    >
      {icon}
    </Box>
  );
}

function NavSectionItem({
  section,
  open,
  onToggle,
  onNavigate,
}: {
  section: NavSection;
  open: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const Icon = section.icon;

  if (section.path) {
    const enabled = section.enabled ?? false;
    if (!enabled) {
      return (
        <Tooltip title="Coming in a later phase" placement="right">
          <span>
            <ListItemButton disabled sx={{ borderRadius: '14px', mb: 0.25 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={section.label} slotProps={{ primary: { variant: 'body2' } }} />
            </ListItemButton>
          </span>
        </Tooltip>
      );
    }
    return (
      <ListItemButton
        component={NavLink}
        to={section.path}
        onClick={onNavigate}
        sx={{
          borderRadius: '14px',
          mb: 0.25,
          '&.active': (theme) =>
            theme.palette.mode === 'dark'
              ? {
                  // Dark mode is translucent glass everywhere else in this
                  // sidebar — an opaque gradient pill here read as a jarring
                  // "abrupt background change" against it, so the active
                  // state is a soft tinted highlight + glow instead, matching
                  // the approved Ambient-Glass-palette mockup exactly.
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.16)',
                  boxShadow: `0 0 22px ${theme.palette.primary.main}47`,
                  color: theme.palette.text.primary,
                  '& .MuiListItemIcon-root': { color: theme.palette.primary.main },
                }
              : {
                  // Light mode has no translucent glass panels to clash
                  // with, so a solid gradient pill (this system's original
                  // Bento Fresh treatment) reads cleanly here.
                  backgroundImage: `linear-gradient(120deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  color: theme.palette.primary.contrastText,
                  boxShadow: `0 8px 20px ${theme.palette.secondary.main}40`,
                  '& .MuiListItemIcon-root': { color: 'inherit' },
                },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={section.label} slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 600 } } }} />
      </ListItemButton>
    );
  }

  return (
    <>
      <ListItemButton onClick={onToggle} sx={{ borderRadius: '14px', mb: 0.25 }}>
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={section.label} slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 600 } } }} />
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {section.children?.map((child) => (
            <Tooltip
              key={child.path}
              title={child.enabled ? '' : 'Coming in a later phase'}
              placement="right"
              disableHoverListener={child.enabled}
            >
              <span>
                {child.enabled ? (
                  <ListItemButton
                    component={NavLink}
                    to={child.path}
                    onClick={onNavigate}
                    sx={{
                      pl: 5,
                      borderRadius: '14px',
                      mb: 0.25,
                      '&.active': { bgcolor: 'action.selected' },
                    }}
                  >
                    <ListItemText primary={child.label} slotProps={{ primary: { variant: 'body2' } }} />
                  </ListItemButton>
                ) : (
                  <ListItemButton disabled sx={{ pl: 5, borderRadius: '14px', mb: 0.25 }}>
                    <ListItemText primary={child.label} slotProps={{ primary: { variant: 'body2' } }} />
                  </ListItemButton>
                )}
              </span>
            </Tooltip>
          ))}
        </List>
      </Collapse>
    </>
  );
}
