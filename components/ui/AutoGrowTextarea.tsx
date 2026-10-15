'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * A textarea that is always as tall as its content — `rows` is the minimum.
 * Height is measured from scrollHeight rather than using CSS field-sizing,
 * which Firefox and Safari don't support yet. It re-measures when the text
 * changes and when the window is resized (a narrower box wraps onto more lines).
 */
export function AutoGrowTextarea({
  value,
  rows = 2,
  className = '',
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    function resize() {
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={rows}
      // overflow-hidden: the box is sized to fit, so a scrollbar would only flash in mid-resize.
      className={`resize-none overflow-hidden ${className}`}
      {...rest}
    />
  );
}
