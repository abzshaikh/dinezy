import { Box, Paper, Stack, Typography, useTheme } from '@mui/material';
import type { ReactNode } from 'react';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import { ThemeToggle } from '../../components/common/ThemeToggle';
import { AuroraBackdrop } from '../../components/common/AuroraBackdrop';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
        position: 'relative',
      }}
    >
      {isDark && <AuroraBackdrop />}
      <Box sx={{ position: 'absolute', top: { xs: 16, sm: 24 }, right: { xs: 16, sm: 24 }, zIndex: 1 }}>
        <ThemeToggle />
      </Box>
      <Paper
        elevation={0}
        sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 5 }, border: '1px solid', borderColor: 'divider', position: 'relative', zIndex: 1 }}
      >
        <Stack spacing={0.5} sx={{ alignItems: 'center', mb: 4 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '13px',
              backgroundImage: (theme) => `linear-gradient(140deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 1,
              boxShadow: (theme) => `0 8px 18px ${theme.palette.secondary.main}59`,
            }}
          >
            <RestaurantIcon />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Stack>
        {children}
      </Paper>
    </Box>
  );
}
