interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm">
        <p className="text-sm text-gray-700 mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="text-sm px-3 py-1.5 bg-gray-100 text-gray-600 rounded border-none cursor-pointer hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-sm px-3 py-1.5 bg-red-500 text-white rounded border-none cursor-pointer hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
