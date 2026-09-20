import { alpha, createTheme, type PaletteMode, type Theme } from '@mui/material/styles';

/**
 * "Aurora Bento" design system — the app-wide redesign chosen (2026-09) from
 * three mocked-up directions (Bento Fresh, Kinetic Brutalist, Ambient Glass)
 * shown to the user as a canvas of live artboards, then merged per their
 * pick: Bento Fresh's layout (floating dock sidebar, bento-grid dashboard,
 * hero + two-up mobile stat stacking) rebuilt in Ambient Glass's dark aurora
 * palette (translucent frosted panels floating over a deep-navy background
 * with blurred teal/violet/pink light blooms behind them), with a glass
 * pill bottom nav + swipe-up sheet for mobile navigation. Dark is the
 * flagship mode this system was designed for; light is a matching Bento-style
 * companion (solid white cards, soft shadows, same accent hues deepened for
 * contrast) for anyone who prefers it. See `ThemeModeContext` for the toggle,
 * `AppLayout.tsx` for the aurora background + floating sidebar + bottom nav,
 * and `PHASE_18_REPORT.md` for the full design writeup.
 *
 * Every screen should pull color/spacing/shape from this theme rather than
 * hardcoding values — MUI's component-level `styleOverrides` below cascade
 * to every Card, Paper, Button, Chip, Table, etc. already in the app, so the
 * redesign applies consistently without editing each screen by hand.
 */

// Money/data figures render in a monospace face with tabular numerals
// throughout the app (stat cards, table amount columns) — spread this
// into an sx prop wherever a figure needs that treatment.
export const monoNumeric = {
  fontFamily: '"Fira Code", "Roboto Mono", monospace',
  fontVariantNumeric: 'tabular-nums',
} as const;

// The three light blooms drifting behind the dark-mode UI (teal, violet,
// pink) — purely decorative, so they're fixed regardless of semantic
// palette. Consumed by AppLayout to paint the fixed aurora background.
export const AURORA_STOPS = ['#2DD4BF', '#8B5CF6', '#F472B6'] as const;

interface ModeTokens {
  bg: string;
  surface: string;
  surfaceSolid: string;
  ink: string;
  inkMuted: string;
  border: string;
  accent: string;
  accentLight: string;
  accentContrast: string;
  secondary: string;
  secondaryContrast: string;
  positive: string;
  positiveContrast: string;
  warning: string;
  warningContrast: string;
  critical: string;
  criticalContrast: string;
}

const DARK: ModeTokens = {
  bg: '#0F1024',
  surface: 'rgba(255,255,255,0.06)',
  surfaceSolid: '#181A38',
  ink: '#F1F0FA',
  inkMuted: '#A9A7C4',
  border: 'rgba(255,255,255,0.12)',
  accent: '#2DD4BF',
  accentLight: '#5EEAD4',
  accentContrast: '#0F1024',
  secondary: '#8B5CF6',
  secondaryContrast: '#F1F0FA',
  positive: '#34D399',
  positiveContrast: '#0F1024',
  warning: '#FBBF24',
  warningContrast: '#0F1024',
  critical: '#FB7185',
  criticalContrast: '#0F1024',
};

const LIGHT: ModeTokens = {
  bg: '#F4F7F3',
  surface: '#FFFFFF',
  surfaceSolid: '#FFFFFF',
  ink: '#1C2321',
  inkMuted: '#5C6B64',
  border: '#E4EBE1',
  accent: '#0D9488',
  accentLight: '#14B8A6',
  accentContrast: '#FFFFFF',
  secondary: '#7C3AED',
  secondaryContrast: '#FFFFFF',
  positive: '#059669',
  positiveContrast: '#FFFFFF',
  warning: '#B45309',
  warningContrast: '#FFFFFF',
  critical: '#E11D48',
  criticalContrast: '#FFFFFF',
};

export function getAppTheme(mode: PaletteMode): Theme {
  const t = mode === 'dark' ? DARK : LIGHT;
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: { main: t.accent, light: t.accentLight, contrastText: t.accentContrast },
      secondary: { main: t.secondary, contrastText: t.secondaryContrast },
      success: { main: t.positive, contrastText: t.positiveContrast },
      warning: { main: t.warning, contrastText: t.warningContrast },
      error: { main: t.critical, contrastText: t.criticalContrast },
      background: { default: t.bg, paper: t.surface },
      text: { primary: t.ink, secondary: t.inkMuted },
      divider: t.border,
      action: {
        hover: alpha(t.accent, isDark ? 0.1 : 0.06),
        selected: alpha(t.accent, isDark ? 0.16 : 0.1),
      },
    },
    shape: { borderRadius: 20 },
    typography: {
      fontFamily: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'].join(','),
      h1: { fontWeight: 800, letterSpacing: '-0.01em' },
      h2: { fontWeight: 800, letterSpacing: '-0.01em' },
      h3: { fontWeight: 700, letterSpacing: '-0.01em' },
      h4: { fontWeight: 700, letterSpacing: '-0.01em' },
      h5: { fontWeight: 700, letterSpacing: '-0.005em' },
      h6: { fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 700 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: t.bg,
            transition: 'background-color 0.25s ease, color 0.25s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            transition: 'transform 0.14s cubic-bezier(.34,1.4,.44,1), box-shadow 0.18s ease, background 0.14s ease',
          },
          outlined: { borderWidth: 1.5, '&:hover': { borderWidth: 1.5 } },
        },
        variants: [
          {
            props: { variant: 'contained', color: 'primary' },
            style: {
              backgroundImage: `linear-gradient(135deg, ${t.accent}, ${t.secondary})`,
              color: t.accentContrast,
              boxShadow: `0 1px 2px ${alpha(t.accent, 0.25)}, 0 10px 24px ${alpha(t.secondary, isDark ? 0.4 : 0.22)}`,
              '&:hover': {
                backgroundImage: `linear-gradient(135deg, ${t.accent}, ${t.secondary})`,
                boxShadow: `0 2px 6px ${alpha(t.accent, 0.3)}, 0 12px 30px ${alpha(t.secondary, isDark ? 0.45 : 0.28)}`,
                transform: 'translateY(-1px)',
              },
              '&:active': { transform: 'scale(0.97)' },
            },
          },
        ],
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? t.surface : t.surface,
            ...(isDark
              ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
              : {}),
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 22,
            border: `1px solid ${t.border}`,
            boxShadow: isDark ? 'none' : '0 1px 2px rgba(30,40,35,0.04), 0 12px 26px rgba(30,40,35,0.05)',
            backgroundImage: 'none',
            backgroundColor: t.surface,
            ...(isDark
              ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
              : {}),
          },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? 'rgba(15,16,36,0.55)' : alpha(t.surface, 0.9),
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            borderBottom: `1px solid ${t.border}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: t.surface,
            border: `1px solid ${t.border}`,
            ...(isDark
              ? { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }
              : { boxShadow: '0 20px 40px rgba(28,35,33,0.08)' }),
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 700, borderRadius: 999 },
        },
        variants: [
          {
            props: { variant: 'filled', color: 'success' },
            style: { backgroundColor: alpha(t.positive, isDark ? 0.18 : 0.12), color: t.positive },
          },
          {
            props: { variant: 'filled', color: 'warning' },
            style: { backgroundColor: alpha(t.warning, isDark ? 0.18 : 0.12), color: t.warning },
          },
          {
            props: { variant: 'filled', color: 'error' },
            style: { backgroundColor: alpha(t.critical, isDark ? 0.18 : 0.12), color: t.critical },
          },
        ],
      },
      MuiTableCell: {
        styleOverrides: {
          head: ({ theme }) => ({
            fontFamily: '"Fira Code", monospace',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: theme.palette.text.secondary,
          }),
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 14 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: { transition: 'background-color 0.18s ease, color 0.18s ease' },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: t.surfaceSolid,
            color: t.ink,
            fontSize: 12,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: t.surfaceSolid,
            border: `1px solid ${t.border}`,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: t.surfaceSolid,
            border: `1px solid ${t.border}`,
          },
        },
      },
    },
  });
}

// Semantic accent shortcuts used by the reusable StatCard component and any
// page that needs to pick a card accent color by meaning rather than by
// literal palette key (e.g. "this metric is a warning, that one is neutral").
export function accentPalette(theme: Theme) {
  return {
    accent: theme.palette.primary.main,
    positive: theme.palette.success.main,
    warning: theme.palette.warning.main,
    critical: theme.palette.error.main,
  };
}
