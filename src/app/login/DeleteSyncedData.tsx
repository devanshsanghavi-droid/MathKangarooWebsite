'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

/**
 * "Delete my synced progress": removes the account's row and signs out. Progress in this
 * browser is left alone; clearing that is a separate, local choice.
 */
export function DeleteSyncedData() {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState('');

  const remove = async (): Promise<void> => {
    setStatus('Deleting…');
    const response = await fetch('/api/progress', { method: 'DELETE', credentials: 'same-origin' });
    if (response.ok) {
      window.location.assign('/login?deleted=1');
    } else {
      setStatus('That did not work. Please try again in a minute.');
    }
  };

  return (
    <div className="mt-6">
      {confirming ? (
        <div className="grid gap-3">
          <p className="m-0 text-sm text-ink">
            This permanently deletes the copy of your progress saved to your account and signs you
            out. Progress in this browser stays.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => void remove()}>
              Yes, delete it
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          Delete my synced progress
        </Button>
      )}
      <p className="m-0 mt-2 text-sm text-ink-2" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
