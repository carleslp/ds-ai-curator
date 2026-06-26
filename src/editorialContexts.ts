import type { Resource } from "./emailTemplate.js";
import type { CandidateSignal, SignalEvidence } from "./editorialThesis.js";
import { cleanText, truncateText } from "./textUtils.js";

export type SlimEvidence = {
  title: string;
  url: string;
  source: string;
  role: SignalEvidence["role"];
  stance: SignalEvidence["stance"];
  contribution: string;
  independenceMarker: string;
};

export type SignalContext = {
  claim: string;
  whyNow: string;
  themeAnchor?: string;
};

export type EditorsPickContext = {
  representativeLeadEvidence: SlimEvidence | null;
  contribution: string;
  sourceMetadata: {
    title: string;
    url: string;
    source: string;
  } | null;
  claim: string;
};

export type ImpactContext = {
  claim: string;
  opportunitySurface: string;
  costOfInaction: string;
  workflowSurface: string[];
  teamContext: string;
};

export type SupportingSignalsContext = {
  representativeSupportingEvidence: SlimEvidence[];
  corroboratingEvidence: SlimEvidence[];
  contradictingEvidence: SlimEvidence[];
  contributions: string[];
};

export type MoveContext = {
  opportunityMove: string;
  preconditions: string[];
  targetSurface: string;
};

export type HorizonContext = {
  watchlist: string[];
  openQuestions: string[];
  unresolvedUncertainty: string;
  falsificationConditions: string[];
};

export type EditorialContexts = {
  signalContext: SignalContext;
  editorsPickContext: EditorsPickContext;
  impactContext: ImpactContext;
  supportingSignalsContext: SupportingSignalsContext;
  moveContext: MoveContext;
  horizonContext: HorizonContext;
};

export type EditorialContextDebug = {
  editorialContexts: {
    signalContextKeys: string[];
    editorsPickContextKeys: string[];
    impactContextKeys: string[];
    supportingSignalsContextKeys: string[];
    moveContextKeys: string[];
    horizonContextKeys: string[];
  };
  contextBoundaryViolations: string[];
};

type EditorialContextBuilderInput = {
  leadSignal?: CandidateSignal | null;
  representativeLeadEvidence?: SignalEvidence | null;
  representativeSupportingEvidence?: SignalEvidence[];
  editorsPick?: Resource | null;
  resources?: Resource[];
};

function workflowAreasFromText(value: string): string[] {
  const text = value.toLowerCase();
  const areas = new Set<string>();

  if (text.includes("figma")) areas.add("Figma");
  if (text.includes("storybook")) areas.add("Storybook");
  if (text.includes("react native")) areas.add("React Native");
  if (text.includes("react")) areas.add("React");
  if (text.includes("azure devops") || text.includes("ado")) areas.add("Azure DevOps");
  if (text.includes("governance")) areas.add("Governance");
  if (text.includes("doc")) areas.add("Documentation");
  if (text.includes("accessibility") || text.includes("a11y")) areas.add("Accessibility");
  if (text.includes("qa") || text.includes("test")) areas.add("Internal QA Agent");
  if (text.includes("ai") || text.includes("agent") || text.includes("mcp") || text.includes("llm")) {
    areas.add("Internal Design System Agent");
  }

  if (areas.size === 0) {
    areas.add("Documentation");
    areas.add("Internal Design System Agent");
  }

  return Array.from(areas);
}

function slimEvidence(evidence: SignalEvidence | null | undefined): SlimEvidence | null {
  if (!evidence) return null;

  return {
    title: evidence.resourceRef.title,
    url: evidence.resourceRef.url,
    source: evidence.resourceRef.source,
    role: evidence.role,
    stance: evidence.stance,
    contribution: truncateText(cleanText(evidence.contribution), 220),
    independenceMarker: evidence.independenceMarker
  };
}

function textFromResources(resources: Resource[]): string {
  return cleanText(
    resources
      .map((resource) =>
        [
          resource.title,
          resource.source,
          resource.summary,
          resource.cleanSummary,
          resource.directDesignSystemEvidence,
          resource.design_system_angle
        ]
          .filter(Boolean)
          .join(" ")
      )
      .join(" ")
  );
}

function themeAnchorFrom(input: EditorialContextBuilderInput): string {
  const evidenceText = [
    input.leadSignal?.claim,
    input.leadSignal?.whyNow,
    input.representativeLeadEvidence?.contribution,
    ...(input.representativeSupportingEvidence ?? []).map((evidence) => evidence.contribution),
    textFromResources(input.resources ?? [])
  ].join(" ");
  const areas = workflowAreasFromText(evidenceText);
  return areas.slice(0, 3).join(" + ");
}

function surfaceFromOpportunity(opportunity: string | undefined, fallbackText: string): string {
  const text = cleanText(opportunity || fallbackText);
  const areas = workflowAreasFromText(text);
  return areas.slice(0, 3).join(", ");
}

function costOfInactionFrom(input: EditorialContextBuilderInput): string {
  const text = `${input.leadSignal?.claim ?? ""} ${input.leadSignal?.whyNow ?? ""} ${textFromResources(input.resources ?? [])}`;
  const areas = workflowAreasFromText(text).slice(0, 3).join(", ");
  return `If we ignore this, ${areas} decisions stay dependent on interpretation instead of explicit Design System rules.`;
}

export function buildEditorialContexts(input: EditorialContextBuilderInput): EditorialContexts {
  const resources = input.resources ?? [];
  const supportingEvidence = (input.representativeSupportingEvidence ?? []).map(slimEvidence).filter(Boolean) as SlimEvidence[];
  const leadEvidence = slimEvidence(input.representativeLeadEvidence);
  const fallbackClaim =
    input.editorsPick?.editorialTitle || input.editorsPick?.title || resources[0]?.editorialTitle || resources[0]?.title || "";
  const claim = cleanText(input.leadSignal?.claim || fallbackClaim || "No strong DS x AI signal cleared the bar today.");
  const whyNow = cleanText(
    input.leadSignal?.whyNow ||
      input.editorsPick?.cleanSummary ||
      input.editorsPick?.summary ||
      "The available sources did not yet provide enough signal for a stronger briefing."
  );
  const workflowSurface = workflowAreasFromText(`${claim} ${whyNow} ${textFromResources(resources)}`);
  const opportunityMove =
    input.leadSignal?.opportunity ||
    `Audit one ${workflowSurface[0] ?? "Documentation"} workflow and identify one assumption an internal agent should not infer.`;

  return {
    signalContext: {
      claim,
      whyNow,
      themeAnchor: themeAnchorFrom(input)
    },
    editorsPickContext: {
      representativeLeadEvidence: leadEvidence,
      contribution: leadEvidence?.contribution ?? "",
      sourceMetadata: leadEvidence
        ? {
            title: leadEvidence.title,
            url: leadEvidence.url,
            source: leadEvidence.source
          }
        : null,
      claim
    },
    impactContext: {
      claim,
      opportunitySurface: surfaceFromOpportunity(input.leadSignal?.opportunity, `${claim} ${whyNow}`),
      costOfInaction: costOfInactionFrom(input),
      workflowSurface,
      teamContext:
        "Mature enterprise Design System team working across Figma, Storybook, React, React Native, Azure DevOps, governance, documentation, accessibility, internal DS agents, and QA agents."
    },
    supportingSignalsContext: {
      representativeSupportingEvidence: supportingEvidence,
      corroboratingEvidence: supportingEvidence.filter((evidence) => evidence.stance === "supports"),
      contradictingEvidence: supportingEvidence.filter((evidence) => evidence.stance === "contradicts"),
      contributions: supportingEvidence.map((evidence) => evidence.contribution).filter(Boolean)
    },
    moveContext: {
      opportunityMove,
      preconditions: [
        "Choose one high-use component",
        "Compare Figma, Storybook, implementation, documentation, and ownership metadata",
        "Capture one gap an internal agent should not infer"
      ],
      targetSurface: workflowSurface[0] ?? "Documentation"
    },
    horizonContext: {
      watchlist: [
        "Watch for tooling that exposes component metadata to AI agents",
        "Track design-to-code work that explains review quality and component reuse",
        "Look for QA, accessibility, or governance automation that can connect back to Azure DevOps"
      ],
      openQuestions: [
        "Which workflow surface is still too implicit for safe agent use?",
        "Which governance rule would fail if an AI-assisted change shipped today?"
      ],
      unresolvedUncertainty: "Whether tooling can use Design System signals reliably enough for repeated enterprise workflows.",
      falsificationConditions: [
        "The source does not connect AI tooling to mature Design System work",
        "The workflow cannot be tested against Figma, Storybook, implementation, documentation, QA, or governance signals"
      ]
    }
  };
}

function forbiddenKeyViolations(contextName: string, context: Record<string, unknown>, forbiddenKeys: string[]): string[] {
  const keys = Object.keys(context);
  return forbiddenKeys
    .filter((key) => keys.includes(key))
    .map((key) => `${contextName} contains forbidden key "${key}".`);
}

export function validateEditorialContextBoundaries(contexts: EditorialContexts): string[] {
  return [
    ...forbiddenKeyViolations("signalContext", contexts.signalContext, [
      "evidence",
      "opportunity",
      "impact",
      "supportingEvidence",
      "representativeSupportingEvidence",
      "renderedResources",
      "resources",
      "leadSignal"
    ]),
    ...forbiddenKeyViolations("editorsPickContext", contexts.editorsPickContext, [
      "supportingEvidence",
      "representativeSupportingEvidence",
      "opportunity",
      "impact",
      "renderedSupportingResources",
      "resources",
      "leadSignal"
    ]),
    ...forbiddenKeyViolations("impactContext", contexts.impactContext, [
      "move",
      "evidence",
      "supportingEvidence",
      "representativeResources",
      "resources",
      "leadSignal"
    ]),
    ...forbiddenKeyViolations("supportingSignalsContext", contexts.supportingSignalsContext, [
      "leadEvidence",
      "representativeLeadEvidence",
      "opportunity",
      "impact",
      "unrelatedEvidence",
      "leadSignal"
    ]),
    ...forbiddenKeyViolations("moveContext", contexts.moveContext, [
      "evidence",
      "impact",
      "whyNow",
      "supportingEvidence",
      "representativeSupportingEvidence",
      "leadSignal"
    ]),
    ...forbiddenKeyViolations("horizonContext", contexts.horizonContext, [
      "proof",
      "move",
      "impact",
      "leadEvidence",
      "representativeLeadEvidence",
      "leadSignal"
    ])
  ];
}

export function createEditorialContextDebug(contexts: EditorialContexts): EditorialContextDebug {
  return {
    editorialContexts: {
      signalContextKeys: Object.keys(contexts.signalContext),
      editorsPickContextKeys: Object.keys(contexts.editorsPickContext),
      impactContextKeys: Object.keys(contexts.impactContext),
      supportingSignalsContextKeys: Object.keys(contexts.supportingSignalsContext),
      moveContextKeys: Object.keys(contexts.moveContext),
      horizonContextKeys: Object.keys(contexts.horizonContext)
    },
    contextBoundaryViolations: validateEditorialContextBoundaries(contexts)
  };
}
