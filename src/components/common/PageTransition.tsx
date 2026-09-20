import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * Wraps each routed page (see AppLayout) so navigating between screens
 * gets a soft fade + rise instead of an abrupt swap — this is what gives
 * every existing page a bit of the "Neon Service" motion language for
 * free, without editing each page individually. Keyed by the caller on
 * the current route so React remounts (and re-plays the animation) on
 * navigation.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
