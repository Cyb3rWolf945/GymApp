import * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn('h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-50 placeholder:text-neutral-500 focus-visible:outline-2 focus-visible:outline-emerald-400', className)}
      {...props}
    />
  );
}
