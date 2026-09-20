import { Box } from '@mui/material';
import { AURORA_STOPS } from '../../app/theme';

/**
 * Fixed, pointer-events-none decorative background: three blurred colored
 * blobs drifting behind the glass panels — the "aurora" in the app's
 * "Aurora Bento" dark mode. Shared between AppLayout (the authenticated
 * app shell) and AuthLayout (login/signup) so the redesign's dark mode
 * looks the same from the very first screen a visitor sees.
 */
export function AuroraBackdrop() {
  return (
    <Box sx={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <Box
        sx={{
          position: 'absolute',
          top: '-15%',
          left: '-10%',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: AURORA_STOPS[0],
          opacity: 0.22,
          filter: 'blur(110px)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '-18%',
          right: '5%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: AURORA_STOPS[1],
          opacity: 0.2,
          filter: 'blur(120px)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-20%',
          left: '35%',
          width: 640,
          height: 640,
          borderRadius: '50%',
          background: AURORA_STOPS[2],
          opacity: 0.16,
          filter: 'blur(130px)',
        }}
      />
    </Box>
  );
}
