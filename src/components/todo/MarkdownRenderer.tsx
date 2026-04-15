import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const components: Components = {
  p: ({ children }) => (
    <p className="text-sm text-gray-600 leading-relaxed mb-1.5 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-700">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="text-sm text-gray-600 pl-4 mb-1.5 list-disc">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="text-sm text-gray-600 pl-4 mb-1.5 list-decimal">{children}</ol>
  ),
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyan-600 hover:underline cursor-pointer"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="text-xs font-mono text-gray-700 bg-transparent p-0">
          {children}
        </code>
      );
    }
    return (
      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-pink-600">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-1.5 overflow-x-auto">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-200 pl-3 italic text-gray-500 mb-1.5">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => (
    <p className="text-base font-semibold text-gray-700 mb-1">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="text-sm font-semibold text-gray-700 mb-1">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="text-sm font-medium text-gray-700 mb-1">{children}</p>
  ),
};

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
