'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>(
    'checking',
  );

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setStatus(data.status === 'connected' ? 'connected' : 'error');
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  const statusLabel =
    status === 'connected'
      ? 'Connected'
      : status === 'error'
        ? 'Disconnected'
        : 'Checking…';

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground text-background">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8"
            aria-hidden="true"
          >
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M7 12h10" />
          </svg>
        </div>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          ScanMark
        </h1>

        <p className="mt-4 text-base text-foreground/60 sm:text-lg">
          A simple, fast attendance management system. Scan, mark, and track
          your class — all in one place.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="/"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90 sm:w-auto"
          >
            Get started
          </a>
        </div>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-foreground/10 px-3 py-1.5 text-xs text-foreground/60">
          <span
            className={`h-2 w-2 rounded-full ${
              status === 'connected'
                ? 'bg-green-500'
                : status === 'error'
                  ? 'bg-red-500'
                  : 'bg-yellow-500'
            }`}
          />
          Status: {statusLabel}
        </div>
      </div>

      <footer className="mt-16 text-xs text-foreground/40">
        MIT WPU Attendance
      </footer>
    </main>
  );
}
