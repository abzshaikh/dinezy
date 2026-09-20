import { Box, CircularProgress, Typography } from '@mui/material';

export function LoadingIndicator({ label, fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: fullScreen ? 0 : 6,
        height: fullScreen ? '100vh' : 'auto',
      }}
    >
      <CircularProgress size={32} />
      {label && (
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      )}
    </Box>
  );
}
