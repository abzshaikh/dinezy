import type { ReactNode } from 'react';
import { Box, Card, Stack, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { monoNumeric } from '../../app/theme';
import { useCountUp } from '../../hooks/useCountUp';

export type StatCardAccent = 'accent' | 'positive' | 'warning' | 'critical';

export interface StatCardProps {
  label: string;
  /** Numeric value to count up to on mount. */
  value: number;
  /** Formats the (partially animated) numeric value for display. */
  format?: (value: number) => string;
  icon: ReactNode;
  accent?: StatCardAccent;
  trend?: { label: string; direction: 'up' | 'down' | 'flat' };
  caption?: string;
  /** Stagger index — later cards animate in slightly after earlier ones. */
  index?: number;
  /**
   * Shows a lock icon and a muted "restricted" caption instead of the
   * figure — for a viewer whose role can't read the underlying data (e.g.
   * a role without `expense.view` on the Dashboard). Showing "0" in that
   * case would misleadingly read as "nothing recorded" rather than "you
   * can't see this" — this makes the distinction explicit.
   */
  locked?: boolean;
  lockedCaption?: string;
}

/**
 * The flagship component of the "Aurora Bento" design system's animation
 * language: a tinted icon chip on a frosted-glass card, a count-up figure
 * in tabular monospace, and a staggered entrance + hover-lift. No left
 * accent bar — that read as dated next to the glass panels elsewhere in
 * the redesign, so the accent color lives only in the icon chip and the
 * hover glow. Built once here so every report/dashboard screen that shows
 * headline numbers gets the same look — see DashboardPage for the
 * reference usage.
 */
export function StatCard({
  label,
  value,
  format = (v) => Math.round(v).toLocaleString('en-IN'),
  icon,
  accent = 'accent',
  trend,
  caption,
  index = 0,
  locked = false,
  lockedCaption = "Ask an owner for access",
}: StatCardProps) {
  const theme = useTheme();
  const animated = useCountUp(locked ? 0 : value);

  const accentColor =
    accent === 'positive'
      ? theme.palette.success.main
      : accent === 'warning'
        ? theme.palette.warning.main
        : accent === 'critical'
          ? theme.palette.error.main
          : theme.palette.primary.main;

  const trendColor =
    trend?.direction === 'up' ? theme.palette.success.main : trend?.direction === 'down' ? theme.palette.error.main : theme.palette.text.secondary;
  const trendArrow = trend?.direction === 'up' ? '▲' : trend?.direction === 'down' ? '▼' : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      style={{ height: '100%' }}
    >
      <Card
        sx={{
          height: '100%',
          p: 2.25,
          position: 'relative',
          overflow: 'hidden',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': locked
            ? undefined
            : {
                borderColor: accentColor,
                boxShadow: (t) => (t.palette.mode === 'dark' ? `0 0 30px ${accentColor}26` : undefined),
              },
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: locked ? 'action.hover' : (t) => (t.palette.mode === 'dark' ? `${accentColor}29` : `${accentColor}1F`),
              color: locked ? 'text.disabled' : accentColor,
            }}
          >
            {locked ? <LockRoundedIcon fontSize="small" /> : icon}
          </Box>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.75 }}>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ ...monoNumeric, fontWeight: 700, mb: 0.75, color: locked ? 'text.disabled' : 'text.primary' }}>
          {locked ? '—' : format(animated)}
        </Typography>
        {locked ? (
          <Typography variant="caption" color="text.secondary">
            {lockedCaption}
          </Typography>
        ) : trend ? (
          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700, color: trendColor }}>
            {trendArrow} {trend.label}
          </Typography>
        ) : (
          caption && (
            <Typography variant="caption" color="text.secondary">
              {caption}
            </Typography>
          )
        )}
      </Card>
    </motion.div>
  );
}
