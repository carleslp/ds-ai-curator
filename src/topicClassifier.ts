import type { CandidateResource } from "./collectCandidates.js";
import { cleanText } from "./textUtils.js";

export type AiTopic =
  | "LLM"
  | "Agents"
  | "MCP"
  | "Code Generation"
  | "Design-to-Code"
  | "RAG"
  | "Copilot"
  | "QA Automation"
  | "Accessibility AI";

export type DesignSystemTopic =
  | "Storybook"
  | "Figma"
  | "Code Connect"
  | "Design Tokens"
  | "Documentation"
  | "Governance"
  | "Component APIs"
  | "React"
  | "React Native"
  | "Metadata"
  | "Dev Mode"
  | "Variables"
  | "Accessibility"
  | "Design-to-Code"
  | "QA Automation"
  | "Component Generation"
  | "Enterprise";

export type WorkflowTopic =
  | "Designer Workflow"
  | "Developer Workflow"
  | "Design QA"
  | "Design Review"
  | "Design System Agent"
  | "Internal Tools";

export type TopicClassification = {
  title: string;
  url: string;
  source: string;
  aiTopics: AiTopic[];
  designSystemTopics: DesignSystemTopic[];
  workflowTopics: WorkflowTopic[];
};

type TopicRule<TTopic extends string> = {
  topic: TTopic;
  terms: string[];
};

const aiTopicRules: TopicRule<AiTopic>[] = [
  { topic: "LLM", terms: ["llm", "large language model", "gpt", "claude", "gemini"] },
  { topic: "Agents", terms: ["agent", "agents", "agentic"] },
  { topic: "MCP", terms: ["mcp", "model context protocol"] },
  { topic: "Code Generation", terms: ["code generation", "ui code generation", "generate code", "generated code"] },
  { topic: "Design-to-Code", terms: ["design-to-code", "design to code", "mockups to code", "figma2code"] },
  { topic: "RAG", terms: ["rag", "retrieval augmented generation", "retrieval-augmented generation"] },
  { topic: "Copilot", terms: ["copilot"] },
  { topic: "QA Automation", terms: ["qa automation", "automated qa", "test automation", "visual regression"] },
  { topic: "Accessibility AI", terms: ["accessibility automation", "accessibility ai", "ai accessibility"] }
];

const designSystemTopicRules: TopicRule<DesignSystemTopic>[] = [
  { topic: "Storybook", terms: ["storybook"] },
  { topic: "Figma", terms: ["figma"] },
  { topic: "Code Connect", terms: ["code connect"] },
  { topic: "Design Tokens", terms: ["design tokens", "tokens", "variables"] },
  { topic: "Documentation", terms: ["documentation", "docs", "docgen"] },
  { topic: "Governance", terms: ["governance", "standards", "guardrails"] },
  { topic: "Component APIs", terms: ["component api", "component apis", "component props", "component metadata"] },
  { topic: "React", terms: ["react"] },
  { topic: "React Native", terms: ["react native"] },
  { topic: "Metadata", terms: ["metadata", "manifest", "schema"] },
  { topic: "Dev Mode", terms: ["dev mode"] },
  { topic: "Variables", terms: ["variables", "figma variables"] },
  { topic: "Accessibility", terms: ["accessibility", "accessibility automation", "a11y"] },
  { topic: "Design-to-Code", terms: ["design-to-code", "design to code", "mockups to code", "figma2code"] },
  { topic: "QA Automation", terms: ["qa automation", "automated qa", "visual regression"] },
  { topic: "Component Generation", terms: ["component generation", "ui code generation", "generate components"] },
  { topic: "Enterprise", terms: ["enterprise design system", "enterprise workflow", "governance", "internal design system"] }
];

const workflowTopicRules: TopicRule<WorkflowTopic>[] = [
  { topic: "Designer Workflow", terms: ["designer", "figma", "design workflow", "design review"] },
  { topic: "Developer Workflow", terms: ["developer", "frontend", "storybook", "react", "code generation", "component api"] },
  { topic: "Design QA", terms: ["design qa", "qa automation", "visual regression", "accessibility automation"] },
  { topic: "Design Review", terms: ["design review", "review", "checklist"] },
  {
    topic: "Design System Agent",
    terms: ["design system agent", "qa design system agent", "agent consuming component", "agent consuming storybook", "agent consuming figma"]
  },
  { topic: "Internal Tools", terms: ["internal tool", "internal tools", "internal ai tool", "internal ai agent", "enterprise design system"] }
];

function textForClassification(candidate: Pick<CandidateResource, "title" | "source" | "url" | "snippet" | "rawText" | "cleanSummary">): string {
  return ` ${cleanText(
    `${candidate.title} ${candidate.source} ${candidate.url} ${candidate.snippet} ${candidate.rawText} ${candidate.cleanSummary}`
  ).toLowerCase()} `;
}

function classifyTopicGroup<TTopic extends string>(text: string, rules: TopicRule<TTopic>[]): TTopic[] {
  const topics = new Set<TTopic>();

  for (const rule of rules) {
    if (rule.terms.some((term) => text.includes(term))) {
      topics.add(rule.topic);
    }
  }

  return [...topics];
}

export function classifyCandidateTopics(candidate: CandidateResource): TopicClassification {
  const text = textForClassification(candidate);

  return {
    title: candidate.title,
    url: candidate.url,
    source: candidate.source,
    aiTopics: classifyTopicGroup(text, aiTopicRules),
    designSystemTopics: classifyTopicGroup(text, designSystemTopicRules),
    workflowTopics: classifyTopicGroup(text, workflowTopicRules)
  };
}

export function classifyCandidatesTopics(candidates: CandidateResource[]): TopicClassification[] {
  return candidates.map(classifyCandidateTopics);
}
