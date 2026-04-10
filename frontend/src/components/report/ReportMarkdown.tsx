import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/utils';

export function ReportMarkdownContent({
  content,
  variant = 'weekly',
}: {
  content: string;
  variant?: 'daily' | 'weekly';
}) {
  const d = variant === 'daily';

  return (
    <div className={cn(d && 'report-daily-md')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              className={cn(
                'mt-0 text-xl font-bold leading-snug text-[#333]',
                d
                  ? 'mb-5 border-b border-dotted border-b-amber-300/80 pb-4 pl-4 border-l-[5px] border-l-orange-500'
                  : 'mb-4 border-b border-amber-200/70 pb-3 tracking-tight text-amber-950'
              )}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={cn(
                'mt-0 scroll-mt-4 font-bold',
                d
                  ? 'mb-3 text-base text-[#333]'
                  : 'mb-3 mt-10 border-l-[3px] border-amber-400 pl-3 text-[1.05rem] tracking-tight text-stone-900 first:mt-0'
              )}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={cn(
                'mb-2 mt-6 text-sm font-semibold tracking-tight first:mt-0',
                d ? 'text-[#333]' : 'text-stone-800'
              )}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p
              className={cn(
                'mb-4 text-[15px] leading-[1.78] last:mb-0',
                d ? 'text-[#333]' : 'text-stone-800'
              )}
            >
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul
              className={cn(
                'mb-4 list-disc space-y-2 pl-5 text-[15px] leading-[1.75] marker:text-amber-500',
                d ? 'text-[#333]' : 'text-stone-800'
              )}
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol
              className={cn(
                'mb-4 list-decimal space-y-2 pl-5 text-[15px] leading-[1.75] marker:font-semibold marker:text-amber-700',
                d ? 'text-[#333]' : 'text-stone-800'
              )}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-0.5 [&>p]:mb-2 [&>p:last-child]:mb-0">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              className={cn(
                'my-5 rounded-r-lg border-y border-r py-3 pl-4 pr-3 text-stone-700 shadow-sm [&_p]:mb-2 [&_p]:text-[15px] [&_p]:leading-relaxed [&_p:last-child]:mb-0',
                d
                  ? 'border-amber-200/50 border-l-[3px] border-l-orange-400/90 bg-white/70'
                  : 'border-amber-100/90 border-l-[3px] border-l-amber-500 bg-white/55'
              )}
            >
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr
              className={cn(
                'my-8 border-0 border-t',
                d ? 'border-dotted border-amber-300/90' : 'border-dashed border-amber-200/90'
              )}
            />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-amber-900 underline decoration-amber-400/90 decoration-2 underline-offset-[3px] transition hover:bg-amber-100/50 hover:decoration-amber-600"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className={cn('font-semibold', d ? 'text-[#333]' : 'text-stone-900')}>{children}</strong>
          ),
          img: ({ src, alt }) => (
            <span className="my-5 block">
              <img
                src={src ?? ''}
                alt={alt ?? ''}
                className="max-h-[min(70vh,32rem)] w-auto max-w-full rounded-lg border border-stone-200/90 bg-white shadow-md"
                loading="lazy"
              />
            </span>
          ),
          pre: ({ children }) => (
            <pre className="mb-5 overflow-x-auto rounded-xl border border-stone-600/90 bg-stone-900 p-4 text-[13px] leading-relaxed text-stone-100 shadow-md [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-stone-100">
              {children}
            </pre>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className?.includes('language-'));
            return isBlock ? (
              <code className={cn(className, 'font-mono text-sm')} {...props}>
                {children}
              </code>
            ) : (
              <code
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-[0.86em] font-medium shadow-sm',
                  d
                    ? 'border border-amber-200/70 bg-white/90 text-[#333]'
                    : 'border border-amber-200/80 bg-white/80 text-amber-950'
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div
              className={cn(
                'my-5 overflow-x-auto rounded-xl border shadow-sm ring-1 ring-stone-900/5',
                d
                  ? 'border-amber-200/60 bg-white/95 [&_tbody_tr:last-child_td]:border-b-0'
                  : 'border-amber-200/80 bg-white/70'
              )}
            >
              <table className="min-w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className={d ? 'bg-[#FFF9E6]' : 'bg-gradient-to-b from-amber-100/90 to-amber-50/80'}>
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th
              className={cn(
                'border-b px-3 py-2.5 text-left text-stone-800',
                d
                  ? 'border-amber-200/80 text-[13px] font-semibold normal-case tracking-normal'
                  : 'border-amber-200/90 text-xs font-semibold uppercase tracking-wide'
              )}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className={cn(
                'border-b px-3 py-2.5 align-top',
                d ? 'border-amber-100/90 text-[15px] text-[#333]' : 'border-amber-100/90 text-stone-800'
              )}
            >
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
