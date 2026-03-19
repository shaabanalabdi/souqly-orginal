import type { ReactNode } from 'react';

export function LoadingState({ text }: { text: string }) {
  return (
    <div className="state-loading">
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function EmptyStatePanel({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="state-empty space-y-2 text-center">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="text-sm text-muted">{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function ErrorStatePanel({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="state-error space-y-2">
      <h3 className="text-base font-bold">{title}</h3>
      <p className="text-sm">{message}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
