import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem as SelectMenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRestaurant } from '../../contexts/RestaurantContext';
import { formatCurrency } from '../../utils/money';
import { recipeSchema, type RecipeFormValues } from '../../utils/validation';
import type { Ingredient, MenuItem, Recipe } from '../../types';

export interface RecipeFormResult {
  lines: { ingredientId: string; quantity: number }[];
}

interface RecipeFormDialogProps {
  open: boolean;
  onClose: () => void;
  menuItem: MenuItem;
  recipe: Recipe | null; // null = no recipe defined yet
  ingredients: Ingredient[]; // active ingredients, for the picker
  ingredientsById: Map<string, Ingredient>; // full map (incl. archived), for cost math
  onSubmit: (values: RecipeFormResult) => Promise<void>;
}

export function RecipeFormDialog({
  open,
  onClose,
  menuItem,
  recipe,
  ingredients,
  ingredientsById,
  onSubmit,
}: RecipeFormDialogProps) {
  const { selectedRestaurant } = useRestaurant();
  const currency = selectedRestaurant?.currency ?? 'INR';

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      lines: recipe ? recipe.lines.map((l) => ({ ingredientId: l.ingredientId, quantity: l.quantity })) : [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const watchedLines = useWatch({ control, name: 'lines' }) ?? [];
  const previewCostMinor = watchedLines.reduce((total, line) => {
    const cost = ingredientsById.get(line.ingredientId)?.costPerUnitMinor ?? 0;
    const qty = Number.isFinite(line.quantity) ? line.quantity : 0;
    return total + Math.round(qty * cost);
  }, 0);
  const margin = menuItem.priceMinor - previewCostMinor;
  const marginPct = menuItem.priceMinor > 0 ? (margin / menuItem.priceMinor) * 100 : 0;

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (values: RecipeFormValues) => {
    try {
      await onSubmit({ lines: values.lines });
      handleClose();
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Recipe — {menuItem.name}</DialogTitle>
      <Box component="form" id="recipe-form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogContent>
          <Stack spacing={2.5}>
            {errors.root && <Alert severity="error">{errors.root.message}</Alert>}
            {errors.lines?.message && <Alert severity="error">{errors.lines.message}</Alert>}
            {ingredients.length === 0 && (
              <Alert severity="warning">Create an ingredient first (Inventory → Ingredients) before building a recipe.</Alert>
            )}

            <Typography variant="body2" color="text.secondary">
              How much of each ingredient goes into ONE {menuItem.name}.
            </Typography>

            {fields.map((field, index) => {
              const selectedIngredientId = watchedLines[index]?.ingredientId;
              const unit = selectedIngredientId ? ingredientsById.get(selectedIngredientId)?.unit : undefined;
              return (
                <Stack key={field.id} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Controller
                    name={`lines.${index}.ingredientId`}
                    control={control}
                    render={({ field: selectField }) => (
                      <TextField
                        {...selectField}
                        select
                        label="Ingredient"
                        size="small"
                        sx={{ flex: 2 }}
                        error={!!errors.lines?.[index]?.ingredientId}
                        helperText={errors.lines?.[index]?.ingredientId?.message}
                      >
                        {ingredients.map((ing) => (
                          <SelectMenuItem key={ing.ingredientId} value={ing.ingredientId}>
                            {ing.name}
                          </SelectMenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                  <TextField
                    label="Quantity"
                    type="number"
                    size="small"
                    sx={{ flex: 1 }}
                    slotProps={{ htmlInput: { step: 'any', min: 0 } }}
                    error={!!errors.lines?.[index]?.quantity}
                    helperText={errors.lines?.[index]?.quantity?.message ?? unit ?? ' '}
                    {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                  />
                  <IconButton size="small" onClick={() => remove(index)} sx={{ mt: 0.5 }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              );
            })}

            <Button
              startIcon={<AddIcon />}
              onClick={() => append({ ingredientId: '', quantity: 0 })}
              disabled={ingredients.length === 0}
              sx={{ alignSelf: 'flex-start' }}
            >
              Add Ingredient
            </Button>

            <Divider />

            <Stack spacing={0.5}>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Menu price
                </Typography>
                <Typography variant="body2">{formatCurrency(menuItem.priceMinor, currency)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Recipe cost
                </Typography>
                <Typography variant="body2">{formatCurrency(previewCostMinor, currency)}</Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Margin
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }} color={margin >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(margin, currency)} ({marginPct.toFixed(0)}%)
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="recipe-form" variant="contained" disabled={isSubmitting || ingredients.length === 0}>
            {isSubmitting ? 'Saving…' : 'Save Recipe'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
