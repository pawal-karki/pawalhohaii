import Build from './Build';
import StackIcon from './StackIcon';
import { profile } from '../content';

function LinkedInIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className} aria-hidden="true">
            <path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2.5 7.5V18h2.6v-7.5H6.5Zm1.3-4.3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm3.6 4.3V18H14v-4c0-1.1.5-1.8 1.4-1.8.9 0 1.2.6 1.2 1.8v4h2.6v-4.6c0-2.4-1.2-3.1-2.8-3.1-1.2 0-2 .6-2.4 1.2v-1h-2.6Z" />
        </svg>
    );
}

function GlobeIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
        </svg>
    );
}

export function MailIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
        </svg>
    );
}

function LinkIcon({ link }) {
    if (link.label === 'GitHub') return <StackIcon name="github" className="size-4" />;
    if (link.label === 'LinkedIn') return <LinkedInIcon className="size-4" />;
    return <GlobeIcon className="size-4" />;
}

/** GitHub / LinkedIn / site links. `icons` renders compact icon-only buttons (hero). */
export function SocialLinks({ className = '', icons = false }) {
    return (
        <ul className={`flex flex-wrap gap-2 ${className}`}>
            {profile.links.map((l) => (
                <li key={l.label}>
                    <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 rounded-full border border-line text-sm text-muted transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-fg ${icons ? 'size-10 justify-center' : 'px-3 py-1.5'}`}
                    >
                        <LinkIcon link={l} />
                        <span className={icons ? 'sr-only' : ''}>{l.label}</span>
                        <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                </li>
            ))}
        </ul>
    );
}

export default function Contact() {
    const tel = `+977${profile.phone}`;

    return (
        <section id="contact" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24 sm:px-8 sm:py-32">
            <Build
                title="Let's build something."
                headingClass="text-[clamp(2.25rem,6vw,3.75rem)] leading-[1.05] font-semibold tracking-[-0.03em]"
                className="rounded-2xl border border-line bg-surface p-6 sm:p-12"
                bodyClass="mt-5"
            >
                <p className="max-w-xl text-lg text-muted">A SaaS that needs shipping, a legacy app that needs taming, or an AI feature that needs guardrails: tell me about it.</p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                    <a href={`mailto:${profile.email}`} className="inline-flex max-w-full items-center gap-2 rounded-full bg-fg px-5 py-2.5 font-medium text-bg transition-opacity [overflow-wrap:anywhere] hover:opacity-85">
                        <MailIcon className="size-4 shrink-0" />
                        {profile.email}
                    </a>
                    <a href={profile.cv} download className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 font-medium transition-colors hover:border-line-strong hover:bg-surface-2">
                        Download CV <span className="font-mono text-xs text-muted">PDF</span>
                    </a>
                </div>

                <dl className="mt-10 grid gap-6 border-t border-line pt-8 text-sm sm:grid-cols-3">
                    <div>
                        <dt className="text-muted">Phone</dt>
                        <dd className="mt-1 font-medium">
                            <a href={`tel:${tel}`} className="transition-colors hover:text-accent">
                                +977 {profile.phone}
                            </a>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted">Based in</dt>
                        <dd className="mt-1 font-medium">{profile.location} · UTC+5:45</dd>
                    </div>
                    <div>
                        <dt className="text-muted">Elsewhere</dt>
                        <dd className="mt-2">
                            <SocialLinks />
                        </dd>
                    </div>
                </dl>
            </Build>
        </section>
    );
}
