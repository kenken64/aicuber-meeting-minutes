'use client';
import { useEffect } from 'react';

export default function Workspace() {
  useEffect(() => { import('../src/main.js'); }, []);
  return <>
    <a className="skip" href="#main">Skip to content</a>
    <div id="app"><p className="empty">Loading your meeting workspace…</p></div>
    <div id="toast" role="status" aria-live="polite" />
    <dialog id="action-dialog" />
  </>;
}
