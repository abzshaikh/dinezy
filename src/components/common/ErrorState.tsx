import { Alert, AlertTitle, Button, Stack } from '@mui/material';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Stack sx={{ py: 4 }}>
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          )
        }
      >
        <AlertTitle>Something went wrong</AlertTitle>
        {message}
      </Alert>
    </Stack>
  );
}
