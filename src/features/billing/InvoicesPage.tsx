import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ReceiptIcon from '@mui/icons-material/Receipt';
import DownloadIcon from '@mui/icons-material/Download';
import CancelIcon from '@mui/icons-material/Cancel';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../contexts/AuthContext';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { SearchField, matchesSearch } from '../../components/common/SearchField';
import { toFriendlyErrorMessage } from '../../utils/errors';
import { formatCurrency } from '../../utils/money';
import { listInvoices, voidInvoice } from '../../services/invoiceService';
import { exportInvoiceToPdf } from './invoicePdf';
import { VoidInvoiceDialog } from './VoidInvoiceDialog';
import type { Invoice } from '../../types';

export function InvoicesPage() {
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const { selectedRestaurant, hasPermission } = useRestaurant();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const restaurantId = selectedRestaurant!.restaurantId;
  const currency = selectedRestaurant?.currency ?? 'INR';
  const canCreate = hasPermission('orders.create');
  const canVoid = hasPermission('orders.edit');

  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [search, setSearch] = useState('');

  const invoicesQuery = useQuery({ queryKey: ['invoices', restaurantId], queryFn: () => listInvoices(restaurantId) });

  const voidMutation = useMutation({
    mutationFn: ({ invoice, reason }: { invoice: Invoice; reason: string }) =>
      voidInvoice(restaurantId, invoice.invoiceId, reason, firebaseUser!.uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', restaurantId] });
      enqueueSnackbar('Invoice voided.', { variant: 'success' });
      setVoidTarget(null);
    },
    onError: (err) => {
      enqueueSnackbar(toFriendlyErrorMessage(err), { variant: 'error' });
      setVoidTarget(null);
    },
  });

  if (invoicesQuery.isLoading) return <LoadingIndicator label="Loading invoices…" />;
  if (invoicesQuery.isError) {
    return <ErrorState message={toFriendlyErrorMessage(invoicesQuery.error)} onRetry={() => invoicesQuery.refetch()} />;
  }

  const allInvoices = invoicesQuery.data ?? [];
  const invoices = allInvoices.filter((inv) => matchesSearch(inv.invoiceNumber, search) || matchesSearch(inv.customerName, search));

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Invoices
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manually billed invoices — GST and service charge applied from Settings, numbered automatically.
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search invoice #, customer…" />
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/app/billing/invoices/new')}>
              New Invoice
            </Button>
          )}
        </Stack>
      </Stack>

      {invoices.length === 0 && allInvoices.length === 0 ? (
        <EmptyState
          icon={<ReceiptIcon fontSize="inherit" />}
          title="No invoices yet"
          description={
            canCreate
              ? 'Create your first invoice to start billing customers directly from the menu.'
              : "No invoices have been created yet. Ask an owner or manager for billing access if you need to create one."
          }
          actionLabel={canCreate ? 'New Invoice' : undefined}
          onAction={canCreate ? () => navigate('/app/billing/invoices/new') : undefined}
        />
      ) : invoices.length === 0 ? (
        <EmptyState icon={<ReceiptIcon fontSize="inherit" />} title="No invoices match" description="Try a different search term." />
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.invoiceId} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {invoice.invoiceNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{invoice.invoiceDate}</TableCell>
                    <TableCell>{invoice.customerName || '—'}</TableCell>
                    <TableCell align="right">{formatCurrency(invoice.totalMinor, currency)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={invoice.status === 'issued' ? 'Issued' : 'Voided'}
                        color={invoice.status === 'issued' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <Tooltip title="Download PDF">
                          <IconButton size="small" onClick={() => exportInvoiceToPdf(invoice, selectedRestaurant!)}>
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {canVoid && invoice.status === 'issued' && (
                          <Tooltip title="Void invoice">
                            <IconButton size="small" onClick={() => setVoidTarget(invoice)}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <VoidInvoiceDialog
        open={!!voidTarget}
        invoice={voidTarget}
        loading={voidMutation.isPending}
        onConfirm={(reason) => voidTarget && voidMutation.mutate({ invoice: voidTarget, reason })}
        onCancel={() => setVoidTarget(null)}
      />
    </Box>
  );
}
