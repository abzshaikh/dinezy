import { IconButton, InputAdornment, TextField } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  sx?: SxProps<Theme>;
  autoFocus?: boolean;
}

/**
 * The one search box every list page in this app uses — a plain client-side
 * text filter (no new Firestore query, no index), consistent with how this
 * codebase has always filtered already-loaded lists (e.g. Menu Items'
 * category filter since Phase 3). A search icon on the left, a clear button
 * on the right once there's text to clear, otherwise a completely ordinary
 * controlled `TextField` so it inherits the theme's rounded-field styling
 * for free.
 */
export function SearchField({ value, onChange, placeholder = 'Search…', sx, autoFocus }: SearchFieldProps) {
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      size="small"
      autoFocus={autoFocus}
      sx={{ minWidth: 220, ...sx }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Clear search" edge="end" onClick={() => onChange('')}>
                <ClearRoundedIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  );
}

/**
 * Case/diacritic-insensitive substring match, shared by every page that uses
 * SearchField — a search box with different matching rules on every page
 * would be a worse experience than a slightly less clever one used
 * consistently everywhere.
 */
export function matchesSearch(haystack: string | null | undefined, query: string): boolean {
  if (!query.trim()) return true;
  if (!haystack) return false;
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return normalize(haystack).includes(normalize(query));
}
