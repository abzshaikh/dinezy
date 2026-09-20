import { IconButton, Tooltip } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { useThemeMode } from '../../contexts/ThemeModeContext';

/**
 * Light/dark switch — lives in the app topbar (AppLayout) and in
 * AuthLayout so it's reachable before login too. Crossfades the icon on
 * toggle; respects prefers-reduced-motion via framer-motion's own default
 * (transform/opacity only, no layout thrash).
 */
export function ThemeToggle({ size = 'medium' }: { size?: 'small' | 'medium' }) {
  const { mode, toggleMode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        onClick={toggleMode}
        size={size}
        aria-label="Toggle color mode"
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          overflow: 'hidden',
          '&:hover': { color: 'primary.main' },
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={mode}
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.22, ease: [0.34, 1.4, 0.44, 1] }}
            style={{ display: 'flex' }}
          >
            {isDark ? (
              <LightModeRoundedIcon fontSize={size} />
            ) : (
              <DarkModeRoundedIcon fontSize={size} />
            )}
          </motion.span>
        </AnimatePresence>
      </IconButton>
    </Tooltip>
  );
}
