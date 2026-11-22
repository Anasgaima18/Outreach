import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/Dialog';
import { Button } from '../ui/Button';
import type { Contact } from '../../types/database.types';

interface DeleteContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

export function DeleteContactDialog({
  open,
  onOpenChange,
  contact,
  onConfirm,
  loading = false,
}: DeleteContactDialogProps) {
  if (!contact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="sm" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Delete Educator Contact</DialogTitle>
          <DialogDescription>
            Are you sure you want to permanently delete{' '}
            <strong className="text-gray-900">{contact.full_name}</strong> (
            <span className="font-mono text-xs">{contact.email}</span>)?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete Contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
