import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`prose-lai text-sm sm:text-[0.95rem] ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" /> }}>{children}</ReactMarkdown>
    </div>
  );
}
