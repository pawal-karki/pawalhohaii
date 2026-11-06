import { STACK } from '../content';

/** Monochrome Simple Icons SVG from /logos/stack, tinted with currentColor via CSS mask. */
export default function StackIcon({ name, className = 'size-4', label = false }) {
    const mask = `url(/logos/stack/${name}.svg) center / contain no-repeat`;
    return (
        <span
            role={label ? 'img' : undefined}
            aria-label={label ? STACK[name] : undefined}
            aria-hidden={label ? undefined : 'true'}
            className={`inline-block shrink-0 bg-current ${className}`}
            style={{ mask, WebkitMask: mask }}
        />
    );
}
