export type CuratedSource = {
  name: string;
  url: string;
  kind: "rss" | "html" | "arxiv";
};

export const curatedSources: CuratedSource[] = [
  { name: "Figma Blog", url: "https://www.figma.com/blog/feed/", kind: "rss" },
  { name: "Figma AI", url: "https://www.figma.com/ai/", kind: "html" },
  { name: "Figma Make", url: "https://www.figma.com/make/", kind: "html" },
  { name: "Figma Releases", url: "https://www.figma.com/release-notes/", kind: "html" },
  { name: "Storybook Blog", url: "https://storybook.js.org/blog/rss.xml", kind: "rss" },
  { name: "Storybook Releases", url: "https://github.com/storybookjs/storybook/releases.atom", kind: "rss" },
  { name: "Storybook Discussions", url: "https://github.com/storybookjs/storybook/discussions", kind: "html" },
  { name: "Zeroheight Blog", url: "https://zeroheight.com/blog/rss.xml", kind: "rss" },
  { name: "Tokens Studio Blog", url: "https://tokens.studio/blog/rss.xml", kind: "rss" },
  { name: "Style Dictionary Releases", url: "https://github.com/amzn/style-dictionary/releases.atom", kind: "rss" },
  { name: "Style Dictionary", url: "https://styledictionary.com/", kind: "html" },
  { name: "W3C Design Tokens Community Group", url: "https://www.w3.org/community/design-tokens/", kind: "html" },
  {
    name: "arXiv design systems AI",
    url: "https://export.arxiv.org/api/query?search_query=all:%22design%20systems%20AI%22&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending",
    kind: "arxiv"
  },
  {
    name: "arXiv Figma design to code",
    url: "https://export.arxiv.org/api/query?search_query=all:%22Figma%20design%20to%20code%22&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending",
    kind: "arxiv"
  },
  {
    name: "arXiv UI component generation",
    url: "https://export.arxiv.org/api/query?search_query=all:%22UI%20component%20generation%22&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending",
    kind: "arxiv"
  },
  {
    name: "arXiv design tokens",
    url: "https://export.arxiv.org/api/query?search_query=all:%22design%20tokens%22&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending",
    kind: "arxiv"
  },
  {
    name: "arXiv LLM UI generation",
    url: "https://export.arxiv.org/api/query?search_query=all:%22LLM%20UI%20generation%22&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending",
    kind: "arxiv"
  },
  {
    name: "GitHub Storybook search",
    url: "https://github.com/search?q=storybook+MCP+design+systems&type=repositories&s=updated&o=desc",
    kind: "html"
  },
  {
    name: "GitHub design tokens search",
    url: "https://github.com/search?q=design+tokens&type=repositories&s=updated&o=desc",
    kind: "html"
  },
  {
    name: "GitHub Figma MCP search",
    url: "https://github.com/search?q=figma+mcp&type=repositories&s=updated&o=desc",
    kind: "html"
  },
  {
    name: "GitHub design system agent search",
    url: "https://github.com/search?q=%22design+system%22+agent&type=repositories&s=updated&o=desc",
    kind: "html"
  },
  {
    name: "Smashing Magazine Design Systems",
    url: "https://www.smashingmagazine.com/category/design-systems/",
    kind: "html"
  },
  {
    name: "UX Collective design systems AI",
    url: "https://uxdesign.cc/tagged/design-systems",
    kind: "html"
  },
  {
    name: "Nielsen Norman Group AI UX",
    url: "https://www.nngroup.com/topic/artificial-intelligence/",
    kind: "html"
  }
];
