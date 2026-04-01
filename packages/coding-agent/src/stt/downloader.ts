import { logger, spawnProcessSync, whichSync } from "@oh-my-pi/pi-utils";
import { resolvePython } from "./transcriber";

export interface DownloadProgress {
	stage: string;
	percent?: number;
}

export interface EnsureOptions {
	modelName?: string;
	onProgress?: (progress: DownloadProgress) => void;
}

// ── Recording tool ─────────────────────────────────────────────────

function runQuiet(command: string, args: readonly string[]): { exitCode: number | null; stderr: string } {
	const result = spawnProcessSync(command, args, { stdio: "pipe" });
	return {
		exitCode: result.error ? null : (result.status ?? null),
		stderr: result.stderr?.toString("utf8").trim() ?? result.error?.message ?? "",
	};
}

async function ensureRecordingTool(options?: EnsureOptions): Promise<void> {
	if (whichSync("sox")) return;
	if (whichSync("ffmpeg")) return;
	if (process.platform === "linux" && whichSync("arecord")) return;

	// Windows: PowerShell mciSendString is always available as fallback
	if (process.platform === "win32") {
		// Try to get ffmpeg for better quality, but don't block on failure
		options?.onProgress?.({ stage: "Trying to install FFmpeg via winget..." });
		const winget = whichSync("winget");
		if (!winget) return;
		const result = runQuiet(winget, [
			"install",
			"--id",
			"Gyan.FFmpeg",
			"-e",
			"--accept-source-agreements",
			"--accept-package-agreements",
		]);
		if (result.exitCode === 0) {
			logger.debug("FFmpeg installed via winget");
		}
		return;
	}

	throw new Error(
		"No audio recording tool found. Install SoX: sudo apt install sox, or FFmpeg: sudo apt install ffmpeg",
	);
}

// ── Python whisper ─────────────────────────────────────────────────

async function ensurePythonWhisper(options?: EnsureOptions): Promise<void> {
	const pythonCmd = resolvePython();
	if (!pythonCmd) {
		throw new Error("Python not found. Install Python 3.8+ from https://python.org");
	}

	// Check if whisper module is already importable
	const check = spawnProcessSync(pythonCmd, ["-c", "import whisper"], { stdio: "pipe" });
	if (!check.error && check.status === 0) return;

	options?.onProgress?.({ stage: "Installing openai-whisper (this may take a few minutes)..." });
	logger.debug("Installing openai-whisper via pip");

	const install = runQuiet(pythonCmd, ["-m", "pip", "install", "-q", "openai-whisper"]);
	if (install.exitCode !== 0) {
		throw new Error(`Failed to install openai-whisper: ${install.stderr.split("\n").pop()}`);
	}
	logger.debug("openai-whisper installed successfully");
}

// ── Public API ─────────────────────────────────────────────────────

export async function ensureSTTDependencies(options?: EnsureOptions): Promise<void> {
	await ensureRecordingTool(options);
	await ensurePythonWhisper(options);
}
