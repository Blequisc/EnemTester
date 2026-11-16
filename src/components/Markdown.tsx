import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Imagens no meio de uma frase (fórmulas e símbolos, como P₀) ficam na linha do texto.
 * Imagens sozinhas num parágrafo continuam como figuras centralizadas.
 */
function rehypeInlineImages() {
  const visit = (node: any) => {
    if (node.type === "element" && node.tagName === "p") {
      const hasText = node.children.some((c: any) => c.type === "text" && c.value.trim());
      if (hasText) {
        for (const c of node.children) {
          if (c.type === "element" && c.tagName === "img") {
            c.properties = { ...c.properties, className: ["inline"] };
          }
        }
      }
    }
    node.children?.forEach(visit);
  };
  return (tree: any) => visit(tree);
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeInlineImages]}
        components={{
          img: ({ src, alt, className }) => (
            <img
              src={typeof src === "string" ? src : undefined}
              alt={alt || "Imagem da questão"}
              className={className}
              loading="lazy"
            />
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
