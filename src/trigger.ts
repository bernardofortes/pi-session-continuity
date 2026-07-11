import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { ResolvedContinuityConfig } from "./config.js";
import { shouldTriggerHandoff } from "./config.js";

export interface ContextUsageSnapshot {
	tokens: number | null;
	contextWindow: number;
}

export type AutomaticTriggerDecision =
	| { shouldRun: true; reason: "threshold-reached" }
	| {
			shouldRun: false;
			reason:
				| "disabled"
				| "invalid-config"
				| "untrusted"
				| "usage-unavailable"
				| "window-unavailable"
				| "below-threshold";
	  };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isValidToolResultMessage(
	message: AgentMessage,
): message is Extract<AgentMessage, { role: "toolResult" }> {
	return (
		isRecord(message) &&
		message.role === "toolResult" &&
		typeof message.toolCallId === "string" &&
		message.toolCallId.length > 0 &&
		typeof message.toolName === "string" &&
		message.toolName.length > 0 &&
		Array.isArray(message.content) &&
		typeof message.isError === "boolean"
	);
}

function toolCallIdsFromAssistant(message: AgentMessage): string[] | undefined {
	if (!isRecord(message) || message.role !== "assistant") return undefined;
	if (!Array.isArray(message.content)) return undefined;
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const part of message.content) {
		if (!isRecord(part) || part.type !== "toolCall") continue;
		if (
			typeof part.id !== "string" ||
			part.id.length === 0 ||
			typeof part.name !== "string" ||
			part.name.length === 0 ||
			!isRecord(part.arguments) ||
			seen.has(part.id)
		) {
			return undefined;
		}
		seen.add(part.id);
		ids.push(part.id);
	}
	return ids;
}

export function hasCompleteAssistantToolResultBatch(
	messages: readonly AgentMessage[],
): boolean {
	if (messages.length < 2) return false;
	const toolResults: Extract<AgentMessage, { role: "toolResult" }>[] = [];
	let index = messages.length - 1;
	while (index >= 0) {
		const message = messages[index];
		if (!isValidToolResultMessage(message)) break;
		toolResults.unshift(message);
		index -= 1;
	}
	if (toolResults.length === 0 || index < 0) return false;

	const toolCallIds = toolCallIdsFromAssistant(messages[index]);
	if (!toolCallIds || toolCallIds.length === 0) return false;
	if (toolCallIds.length !== toolResults.length) return false;

	const resultIds = toolResults.map((message) => message.toolCallId);
	const uniqueResultIds = new Set(resultIds);
	if (uniqueResultIds.size !== resultIds.length) return false;

	return toolCallIds.every((id, resultIndex) => id === resultIds[resultIndex]);
}

export function decideAutomaticTrigger(
	config: ResolvedContinuityConfig,
	usage: ContextUsageSnapshot | undefined,
): AutomaticTriggerDecision {
	if (!config.trusted) return { shouldRun: false, reason: "untrusted" };
	if (!config.valid) return { shouldRun: false, reason: "invalid-config" };
	if (!config.enabled) return { shouldRun: false, reason: "disabled" };
	if (!usage) return { shouldRun: false, reason: "usage-unavailable" };
	if (usage.tokens === null || usage.contextWindow <= 0) {
		return { shouldRun: false, reason: "window-unavailable" };
	}
	return shouldTriggerHandoff(
		usage.tokens,
		usage.contextWindow,
		config.triggerAtPercent,
	)
		? { shouldRun: true, reason: "threshold-reached" }
		: { shouldRun: false, reason: "below-threshold" };
}
