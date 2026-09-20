import { Typography, type TypographyProps } from '@mui/material';
import { formatCurrency } from '../../utils/money';

interface CurrencyDisplayProps extends Omit<TypographyProps, 'children'> {
  amountMinor: number;
  currency?: string;
}

/** Renders a minor-unit money amount using the shared formatCurrency() utility — never format money ad hoc in a component. */
export function CurrencyDisplay({ amountMinor, currency = 'INR', ...typographyProps }: CurrencyDisplayProps) {
  return <Typography {...typographyProps}>{formatCurrency(amountMinor, currency)}</Typography>;
}
