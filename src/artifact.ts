import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
	ALLOWED_STATUSES,
	ARTIFACT_KIND,
	ARTIFACT_NAME,
	MANDATORY_HEADINGS,
	OPERATION_NAME,
	PRODUCT_NAME,
	REQUIRED_FRONTMATTER_FIELDS,
	RESUME_PROMPT_INTRO,
} from "./constants.js";

export type ContinuityStatus = (typeof ALLOWED_STATUSES)[number];

export interface ContinuityFrontmatter {
	kind: string;
	product: string;
	artifact: string;
	operation: string;
	status: ContinuityStatus;
	version: number;
	eventId: string;
	sessionId: string;
	sessionFile: string;
	createdAt: string;
	updatedAt: string;
	modelId: string;
	synthesisModel: string;
	synthesisEffort?: string;
	tokenCountAtTrigger: number;
	contextWindow: number;
	triggerAtPercent: number;
	keepRecentPercent: number;
	branchLeafBefore?: string | null;
}

export interface ArtifactPaths {
	sessionRoot: string;
	pendingDir: string;
	archiveDir: string;
	failedDir: string;
	lockDir: string;
	pendingPath: string;
	lockPath: string;
}

export interface ParsedBrief {
	frontmatter: Record<string, string | number | null>;
	body: string;
}

export interface ValidationResult {
	ok: boolean;
	errors: string[];
}

function safePathPart(value: string): string {
	return value.replace(/[^A-Za-z0-9_.-]/g, "_");
}

export function createEventId(): string {
	return randomUUID();
}

export function buildArtifactPaths(
	artifactDirectory: string,
	sessionId: string,
	eventId: string,
): ArtifactPaths {
	const safeSessionId = safePathPart(sessionId);
	const safeEventId = safePathPart(eventId);
	const sessionRoot = join(artifactDirectory, safeSessionId);
	const pendingDir = join(sessionRoot, "pending");
	const archiveDir = join(sessionRoot, "archive");
	const failedDir = join(sessionRoot, "failed");
	const lockDir = join(sessionRoot, "lock");
	return {
		sessionRoot,
		pendingDir,
		archiveDir,
		failedDir,
		lockDir,
		pendingPath: join(pendingDir, `${safeEventId}.md`),
		lockPath: join(lockDir, `${safeEventId}.json`),
	};
}

export function buildFrontmatter(
	input: Omit<
		ContinuityFrontmatter,
		"kind" | "product" | "artifact" | "operation" | "version"
	>,
): ContinuityFrontmatter {
	return {
		kind: ARTIFACT_KIND,
		product: PRODUCT_NAME,
		artifact: ARTIFACT_NAME,
		operation: OPERATION_NAME,
		version: 1,
		...input,
	};
}

function yamlScalar(value: string | number | null | undefined): string {
	if (value === null) return "null";
	if (value === undefined) return "null";
	if (typeof value === "number") return String(value);
	return JSON.stringify(value);
}

export function serializeFrontmatter(
	frontmatter: ContinuityFrontmatter,
): string {
	const lines = [
		"---",
		`kind: ${yamlScalar(frontmatter.kind)}`,
		`product: ${yamlScalar(frontmatter.product)}`,
		`artifact: ${yamlScalar(frontmatter.artifact)}`,
		`operation: ${yamlScalar(frontmatter.operation)}`,
		`status: ${yamlScalar(frontmatter.status)}`,
		`version: ${yamlScalar(frontmatter.version)}`,
		`eventId: ${yamlScalar(frontmatter.eventId)}`,
		`sessionId: ${yamlScalar(frontmatter.sessionId)}`,
		`sessionFile: ${yamlScalar(frontmatter.sessionFile)}`,
		`createdAt: ${yamlScalar(frontmatter.createdAt)}`,
		`updatedAt: ${yamlScalar(frontmatter.updatedAt)}`,
		`modelId: ${yamlScalar(frontmatter.modelId)}`,
		`synthesisModel: ${yamlScalar(frontmatter.synthesisModel)}`,
		...(frontmatter.synthesisEffort !== undefined
			? [`synthesisEffort: ${yamlScalar(frontmatter.synthesisEffort)}`]
			: []),
		`tokenCountAtTrigger: ${yamlScalar(frontmatter.tokenCountAtTrigger)}`,
		`contextWindow: ${yamlScalar(frontmatter.contextWindow)}`,
		`triggerAtPercent: ${yamlScalar(frontmatter.triggerAtPercent)}`,
		`keepRecentPercent: ${yamlScalar(frontmatter.keepRecentPercent)}`,
	];
	if (frontmatter.branchLeafBefore !== undefined) {
		lines.push(`branchLeafBefore: ${yamlScalar(frontmatter.branchLeafBefore)}`);
	}
	lines.push("---");
	return `${lines.join("\n")}\n`;
}

export function serializeBrief(
	frontmatter: ContinuityFrontmatter,
	body: string,
): string {
	return `${serializeFrontmatter(frontmatter)}${body.trim()}\n`;
}

function parseScalar(raw: string): string | number | null {
	const value = raw.trim();
	if (value === "null") return null;
	if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		try {
			return JSON.parse(value);
		} catch {
			return value.slice(1, -1);
		}
	}
	return value;
}

export function parseBrief(content: string): ParsedBrief {
	if (!content.startsWith("---\n")) {
		throw new Error("Continuity Brief must start with YAML frontmatter");
	}
	const end = content.indexOf("\n---", 4);
	if (end === -1) {
		throw new Error("Continuity Brief frontmatter is not closed");
	}
	const frontmatterText = content.slice(4, end).trim();
	const body = content.slice(end + "\n---".length).replace(/^\n/, "");
	const frontmatter: Record<string, string | number | null> = {};
	for (const line of frontmatterText.split("\n")) {
		const index = line.indexOf(":");
		if (index === -1) continue;
		const key = line.slice(0, index).trim();
		const value = line.slice(index + 1);
		frontmatter[key] = parseScalar(value);
	}
	return { frontmatter, body };
}

export function normalizeSynthesizedBody(synthesized: string): string {
	let body = synthesized.trim();
	if (body.startsWith("```")) {
		body = body
			.replace(/^```(?:markdown|md)?\s*/i, "")
			.replace(/```\s*$/i, "")
			.trim();
	}
	if (body.startsWith("---\n")) {
		try {
			body = parseBrief(body).body.trim();
		} catch {
			// Keep original text; validation will fail with a useful message.
		}
	}
	const headingIndex = body.indexOf("# Continuity Brief");
	if (headingIndex > 0) body = body.slice(headingIndex);
	return body.trim();
}

function getSection(body: string, heading: string): string {
	const start = body.indexOf(`${heading}\n`);
	if (start === -1) return "";
	const afterHeading = start + heading.length;
	const next = body.slice(afterHeading + 1).search(/\n##[#]?\s+/);
	return next === -1
		? body.slice(afterHeading).trim()
		: body.slice(afterHeading, afterHeading + 1 + next).trim();
}

function findDirectivePromotion(body: string): string | undefined {
	const authoritySections = [
		"## Constraints / Forbid",
		"## Next Actions",
		"## Recovery Instructions",
	];
	const directivePattern =
		/\b(ignore previous instructions|system instructions are overridden|follow these instructions instead|developer instructions no longer apply)\b/i;
	const evidencePattern =
		/\b(observed|quoted|transcript|tool output|file content|prior artifact|as evidence)\b/i;
	for (const heading of authoritySections) {
		const section = getSection(body, heading);
		if (directivePattern.test(section) && !evidencePattern.test(section)) {
			return `${heading} appears to promote directive-looking content above active instruction authority`;
		}
	}
	return undefined;
}

const STRING_FRONTMATTER_FIELDS = [
	"eventId",
	"sessionId",
	"sessionFile",
	"createdAt",
	"updatedAt",
	"modelId",
	"synthesisModel",
] as const;

const NUMERIC_FRONTMATTER_FIELDS = [
	"version",
	"tokenCountAtTrigger",
	"contextWindow",
	"triggerAtPercent",
	"keepRecentPercent",
] as const;

const STATUS_TRANSITIONS: Record<ContinuityStatus, ContinuityStatus[]> = {
	pending: ["injected", "failed"],
	injected: ["archived"],
	archived: [],
	failed: [],
};

function assertStatusTransition(from: unknown, to: ContinuityStatus): void {
	if (!ALLOWED_STATUSES.includes(from as ContinuityStatus)) {
		throw new Error(`invalid current status: ${String(from)}`);
	}
	const current = from as ContinuityStatus;
	if (!STATUS_TRANSITIONS[current].includes(to)) {
		throw new Error(
			`invalid Continuity Brief status transition: ${current} -> ${to}`,
		);
	}
}

export function validateBrief(
	content: string,
	expectedSessionId?: string,
): ValidationResult {
	const errors: string[] = [];
	let parsed: ParsedBrief;
	try {
		parsed = parseBrief(content);
	} catch (error) {
		return {
			ok: false,
			errors: [error instanceof Error ? error.message : String(error)],
		};
	}

	for (const field of REQUIRED_FRONTMATTER_FIELDS) {
		if (
			parsed.frontmatter[field] === undefined ||
			parsed.frontmatter[field] === ""
		) {
			errors.push(`missing required frontmatter field: ${field}`);
		}
	}

	if (parsed.frontmatter.kind !== ARTIFACT_KIND)
		errors.push(`kind must be ${ARTIFACT_KIND}`);
	if (parsed.frontmatter.product !== PRODUCT_NAME)
		errors.push(`product must be ${PRODUCT_NAME}`);
	if (parsed.frontmatter.artifact !== ARTIFACT_NAME)
		errors.push(`artifact must be ${ARTIFACT_NAME}`);
	if (parsed.frontmatter.operation !== OPERATION_NAME)
		errors.push(`operation must be ${OPERATION_NAME}`);
	if (
		!ALLOWED_STATUSES.includes(parsed.frontmatter.status as ContinuityStatus)
	) {
		errors.push(`invalid status: ${String(parsed.frontmatter.status)}`);
	}
	if (parsed.frontmatter.version !== 1) errors.push("version must be 1");
	for (const field of STRING_FRONTMATTER_FIELDS) {
		if (typeof parsed.frontmatter[field] !== "string") {
			errors.push(`${field} must be a string`);
		}
	}
	for (const field of NUMERIC_FRONTMATTER_FIELDS) {
		if (
			typeof parsed.frontmatter[field] !== "number" ||
			!Number.isFinite(parsed.frontmatter[field])
		) {
			errors.push(`${field} must be a finite number`);
		}
	}
	if (
		typeof parsed.frontmatter.tokenCountAtTrigger === "number" &&
		parsed.frontmatter.tokenCountAtTrigger < 0
	) {
		errors.push("tokenCountAtTrigger must be non-negative");
	}
	if (
		typeof parsed.frontmatter.contextWindow === "number" &&
		parsed.frontmatter.contextWindow < 0
	) {
		errors.push("contextWindow must be non-negative");
	}
	if (
		typeof parsed.frontmatter.triggerAtPercent === "number" &&
		(parsed.frontmatter.triggerAtPercent <= 0 ||
			parsed.frontmatter.triggerAtPercent >= 100)
	) {
		errors.push("triggerAtPercent must be positive and below 100");
	}
	if (
		typeof parsed.frontmatter.keepRecentPercent === "number" &&
		(parsed.frontmatter.keepRecentPercent <= 0 ||
			parsed.frontmatter.keepRecentPercent >= 100)
	) {
		errors.push("keepRecentPercent must be positive and below 100");
	}
	if (
		typeof parsed.frontmatter.keepRecentPercent === "number" &&
		typeof parsed.frontmatter.triggerAtPercent === "number" &&
		parsed.frontmatter.keepRecentPercent >= parsed.frontmatter.triggerAtPercent
	) {
		errors.push("keepRecentPercent must be lower than triggerAtPercent");
	}
	if (expectedSessionId && parsed.frontmatter.sessionId !== expectedSessionId) {
		errors.push(`sessionId mismatch: expected ${expectedSessionId}`);
	}

	const bodyLines = parsed.body.split(/\r?\n/).map((line) => line.trim());
	for (const heading of MANDATORY_HEADINGS) {
		if (!bodyLines.includes(heading))
			errors.push(`missing mandatory heading: ${heading}`);
	}

	const directivePromotion = findDirectivePromotion(parsed.body);
	if (directivePromotion) errors.push(directivePromotion);

	return { ok: errors.length === 0, errors };
}

export function assertValidBrief(
	content: string,
	expectedSessionId?: string,
): void {
	const result = validateBrief(content, expectedSessionId);
	if (!result.ok) throw new Error(result.errors.join("; "));
}

export function replaceBriefStatus(
	content: string,
	status: ContinuityStatus,
	updatedAt: string,
): string {
	const parsed = parseBrief(content);
	assertStatusTransition(parsed.frontmatter.status, status);
	const nextFrontmatter = {
		...parsed.frontmatter,
		status,
		updatedAt,
	} as unknown as ContinuityFrontmatter;
	return serializeBrief(nextFrontmatter, parsed.body);
}

export function buildResumePrompt(
	savedBriefContent: string,
	expectedSessionId?: string,
): string {
	const parsed = parseBrief(savedBriefContent);
	if (parsed.frontmatter.status !== "pending") {
		throw new Error(
			`only pending Continuity Brief artifacts are valid resume input; got ${String(parsed.frontmatter.status)}`,
		);
	}
	assertValidBrief(savedBriefContent, expectedSessionId);
	return `${savedBriefContent.trim()}\n\n${RESUME_PROMPT_INTRO}`;
}

export async function ensureArtifactDirectories(
	paths: ArtifactPaths,
): Promise<void> {
	await Promise.all([
		mkdir(paths.pendingDir, { recursive: true }),
		mkdir(paths.archiveDir, { recursive: true }),
		mkdir(paths.failedDir, { recursive: true }),
		mkdir(paths.lockDir, { recursive: true }),
	]);
}

export async function writeTextFile(
	path: string,
	content: string,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content, "utf8");
}

export async function readTextFile(path: string): Promise<string> {
	return readFile(path, "utf8");
}

export async function markBriefInjected(
	pendingPath: string,
	content: string,
): Promise<string> {
	const injected = replaceBriefStatus(
		content,
		"injected",
		new Date().toISOString(),
	);
	await writeTextFile(pendingPath, injected);
	return injected;
}

export async function archiveBrief(
	pendingPath: string,
	archiveDir: string,
	eventId: string,
	content: string,
): Promise<string> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const archivePath = join(archiveDir, `${timestamp}-${eventId}.md`);
	const archived = replaceBriefStatus(
		content,
		"archived",
		new Date().toISOString(),
	);
	await writeTextFile(pendingPath, archived);
	await mkdir(archiveDir, { recursive: true });
	await rename(pendingPath, archivePath);
	return archivePath;
}

export async function writeFailedArtifact(
	paths: ArtifactPaths,
	frontmatter: ContinuityFrontmatter,
	body: string,
): Promise<string> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const failedPath = join(
		paths.failedDir,
		`${timestamp}-${frontmatter.eventId}.md`,
	);
	const failed = serializeBrief(
		{ ...frontmatter, status: "failed", updatedAt: new Date().toISOString() },
		body,
	);
	await writeTextFile(failedPath, failed);
	return failedPath;
}

export function buildFailureBody(
	phase: string,
	errorMessage: string,
	eventId: string,
	sessionId: string,
	sessionFile: string,
): string {
	return `# Continuity Brief Failure\n\nFailure phase: ${phase}\n\nError message: ${errorMessage}\n\nEvent id: ${eventId}\n\nSession id: ${sessionId}\n\nSession file: ${sessionFile}\n\nNo resume prompt was queued.\n`;
}
