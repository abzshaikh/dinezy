import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ReceiptIcon from '@mui/icons-material/Receipt';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchField, matchesSearch } from '../../components/common/SearchField';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/money';
import { listMenuItems } from '../../services/menuService';
import { createInvoice } from '../../services/invoiceService';
import { exportInvoiceToPdf } from './invoicePdf';

export function NewInvoicePage() {
  const navigate = useNavigate();
  const { firebaseUser, profile } = useAuth();
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const { enqueueSnackbar } = useSnackbar();

  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';
  const settings = selectedRestaurant!.settings;

  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');

  const itemsQuery = useQuery({ queryKey: ['menuItems', restaurantId], queryFn: () => listMenuItems(restaurantId) });

  // Only items sellable RIGHT NOW — unlike Daily Sales (which logs what
  // already happened, so an item 86'd today can still be entered
  // retroactively), a new invoice reflects what's actually on offer today.
  const items = useMemo(
    () => (itemsQuery.data ?? []).filter((i) => i.isActive && i.isAvailable),
    [itemsQuery.data],
  );

  const canCreate = hasPermission('orders.create');

  // Search only narrows which rows are SHOWN in the entry grid — `items`
  // (every sellable item) stays what `lineRows`/totals/`createInvoice` use,
  // so a quantity typed for an item then hidden by a search edit still
  // bills correctly.
  const visibleItems = useMemo(() => items.filter((item) => matchesSearch(item.name, search)), [items, search]);

  const lineRows = useMemo(
    () =>
      items
        .map((item) => {
          const raw = quantities[item.itemId];
          const quantity = raw ? Number(raw) : 0;
          return { item, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0 };
        })
        .filter((r) => r.quantity > 0),
    [items, quantities],
  );

  const subtotalMinor = lineRows.reduce((sum, r) => sum + Math.round(r.item.priceMinor * r.quantity), 0);
  const serviceChargeMinor = Math.round((subtotalMinor * settings.serviceChargePercent) / 100);
  const gstMinor = Math.round(((subtotalMinor + serviceChargeMinor) * settings.gstPercent) / 100);
  const totalMinor = subtotalMinor + serviceChargeMinor + gstMinor;

  const createMutation = useMutation({
    mutationFn: () => {
      const menuItemsById = new Map(items.map((i) => [i.itemId, i]));
      return createInvoice(
        restaurantId,
        {
          customerName,
          note,
          lineItems: lineRows.map((r) => ({ menuItemId: r.item.itemId, quantity: r.quantity })),
        },
        menuItemsById,
        { userId: firebaseUser!.uid, name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Unknown' },
      );
    },
    onSuccess: (invoice) => {
      enqueueSnackbar(`Invoice ${invoice.invoiceNumber} created.`, { variant: 'success' });
      exportInvoiceToPdf(invoice, selectedRestaurant!);
      navigate('/app/billing/invoices');
    },
    onError: (err) => enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' }),
  });

  if (!canCreate) {
    return (
      <Alert severity="info">You don't have permission to create invoices. Ask an owner or manager for access.</Alert>
    );
  }

  return (
    <Box>
      <Stack sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          New Invoice
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Enter quantities for what's being billed. GST ({settings.gstPercent}%) and service charge (
          {settings.serviceChargePercent}%) are applied automatically from Settings.
        </Typography>
      </Stack>

      {itemsQuery.isLoading ? (
        <LoadingIndicator label="Loading menu…" />
      ) : itemsQuery.isError ? (
        <ErrorState message={toFriendlyErrorMessage(itemsQuery.error)} onRetry={() => itemsQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon fontSize="inherit" />}
          title="No sellable menu items"
          description="Make sure at least one menu item is active and available (Menu → Menu Items) before creating an invoice."
        />
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Paper variant="outlined" sx={{ flex: 2 }}>
            <Box sx={{ p: 2, pb: 0 }}>
              <SearchField value={search} onChange={setSearch} placeholder="Search menu items…" />
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Price</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                          No items match "{search}".
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {visibleItems.map((item) => {
                    const raw = quantities[item.itemId] ?? '';
                    const qty = Number(raw) || 0;
                    return (
                      <TableRow key={item.itemId} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {item.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{formatCurrency(item.priceMinor, currency)}</TableCell>
                        <TableCell align="right" sx={{ width: 120 }}>
                          <TextField
                            type="number"
                            size="small"
                            fullWidth
                            placeholder="0"
                            slotProps={{ htmlInput: { step: 1, min: 0 } }}
                            value={raw}
                            onChange={(e) => setQuantities((q) => ({ ...q, [item.itemId]: e.target.value }))}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {qty > 0 ? formatCurrency(Math.round(item.priceMinor * qty), currency) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper variant="outlined" sx={{ flex: 1, p: 2.5, alignSelf: 'flex-start' }}>
            <Stack spacing={2}>
              <TextField
                label="Customer name (optional)"
                size="small"
                fullWidth
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <TextField
                label="Note (optional)"
                size="small"
                fullWidth
                multiline
                minRows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Divider />
              <Stack spacing={0.75}>
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    Subtotal
                  </Typography>
                  <Typography variant="body2">{formatCurrency(subtotalMinor, currency)}</Typography>
                </Stack>
                {settings.serviceChargePercent > 0 && (
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      Service Charge ({settings.serviceChargePercent}%)
                    </Typography>
                    <Typography variant="body2">{formatCurrency(serviceChargeMinor, currency)}</Typography>
                  </Stack>
                )}
                {settings.gstPercent > 0 && (
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">
                      GST ({settings.gstPercent}%)
                    </Typography>
                    <Typography variant="body2">{formatCurrency(gstMinor, currency)}</Typography>
                  </Stack>
                )}
                <Divider />
                <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    Total
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {formatCurrency(totalMinor, currency)}
                  </Typography>
                </Stack>
              </Stack>
              <Button
                variant="contained"
                size="large"
                disabled={lineRows.length === 0 || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Creating…' : 'Create Invoice'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Assigns the next invoice number ({settings.invoicePrefix}-
                {String(settings.nextInvoiceNumber).padStart(4, '0')}) and downloads a PDF automatically. Once
                created, an invoice can be voided but not edited.
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      )}
    </Box>
  );
}
