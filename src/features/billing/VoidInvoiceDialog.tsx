import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import type { Invoice } from '../../types';

interface VoidInvoiceDialogProps {
  open: boolean;
  invoice: Invoice | null;
  loading: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** A dedicated dialog rather than the generic ConfirmDialog — voiding needs a reason field, kept on the invoice for the audit trail. */
export function VoidInvoiceDialog({ open, invoice, loading, onConfirm, onCancel }: VoidInvoiceDialogProps) {
  const [reason, setReason] = useState('');

  const handleCancel = () => {
    setReason('');
    onCancel();
  };

  const handleConfirm = () => {
    onConfirm(reason);
    setReason('');
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Void invoice {invoice?.invoiceNumber}?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          This can't be undone. The invoice number stays reserved and the record is kept — it won't be reused or
          deleted. Create a fresh invoice if the customer still needs a bill.
        </DialogContentText>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Amounts on a voided invoice can never be edited afterward either.
        </Alert>
        <TextField
          label="Reason (optional)"
          fullWidth
          size="small"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} color="error" variant="contained" disabled={loading}>
          {loading ? 'Voiding…' : 'Void Invoice'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
