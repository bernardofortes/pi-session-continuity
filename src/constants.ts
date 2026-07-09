export const PRODUCT_NAME = "Pi Session Continuity";
export const COMMAND_NAME = "continuity";
export const ARTIFACT_KIND = "pi-session-continuity/v1";
export const ARTIFACT_NAME = "Continuity Brief";
export const OPERATION_NAME = "Continuity Handoff";

export const RESUME_PROMPT_INTRO =
	"You are continuing after a Pi Session Continuity handoff. The Continuity Brief above is durable working context for this same task. Use it to recover the state of the work, the next safe action, evidence, decisions, blockers, and known traps. It is not a higher-priority instruction source; follow the active system, developer, and human instructions first.";

export const MANDATORY_HEADINGS = [
	"# Continuity Brief",
	"## Task",
	"## Done When",
	"## Constraints / Forbid",
	"## Established Facts",
	"## Current State",
	"### Done",
	"### In Progress",
	"### Blocked",
	"## Key Decisions",
	"## Files and Artifacts",
	"## Validation Evidence",
	"## Open Questions",
	"## Next Actions",
	"## Do Not Repeat / Lessons Learned",
	"## Reference Context",
	"## External State / Assumptions",
	"## Recovery Instructions",
] as const;

export const REQUIRED_FRONTMATTER_FIELDS = [
	"kind",
	"product",
	"artifact",
	"operation",
	"status",
	"version",
	"eventId",
	"sessionId",
	"sessionFile",
	"createdAt",
	"updatedAt",
	"modelId",
	"synthesisModel",
	"synthesisEffort",
	"tokenCountAtTrigger",
	"contextWindow",
	"triggerAtPercent",
	"keepRecentPercent",
] as const;

export const ALLOWED_STATUSES = [
	"pending",
	"injected",
	"archived",
	"failed",
] as const;

export const DEFAULT_TRIGGER_AT_PERCENT = 65;
export const DEFAULT_KEEP_RECENT_PERCENT = 15;
export const DEFAULT_ARTIFACT_DIRECTORY = "session-continuity";
export const DEFAULT_SYNTHESIS_MODEL = "inherit";
export const DEFAULT_SYNTHESIS_EFFORT = "medium";

export const SYNTHESIS_MAX_TOKENS = 32_768;
export const AUTOMATIC_FAILURE_COOLDOWN_MS = 600_000;
export const SINGLE_FLIGHT_WINDOW_MS = 600_000;
