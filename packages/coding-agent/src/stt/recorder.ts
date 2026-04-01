import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { logger, sleep, Snowflake, spawnProcessSync, whichSync } from "@oh-my-pi/pi-utils";

export interface RecordingHandle {
	stop(): Promise<void>;
}

const isWindows = process.platform === "win32";
type RecordingProcess = ChildProcessWithoutNullStreams & { getStderrText(): string };

function spawnRecordingProcess(command: string, args: readonly string[]): RecordingProcess {
	const proc = spawn(command, [...args], {
		stdio: ["pipe", "pipe", "pipe"],
	}) as ChildProcessWithoutNullStreams;
	let stderrText = "";
	proc.stderr.setEncoding("utf8");
	proc.stderr.on("data", chunk => {
		stderrText += chunk;
	});
	return Object.assign(proc, {
		getStderrText: () => stderrText,
	});
}

async function waitForExit(proc: ChildProcessWithoutNullStreams): Promise<number | null> {
	if (proc.exitCode !== null) return proc.exitCode;
	return await new Promise(resolve => {
		proc.once("exit", code => resolve(code));
	});
}

async function waitForOutput(proc: RecordingProcess, expected: string, timeoutMs: number): Promise<string> {
	proc.stdout.setEncoding("utf8");
	let output = "";
	return await new Promise(resolve => {
		const onData = (chunk: string | Buffer) => {
			output += typeof chunk === "string" ? chunk : chunk.toString("utf8");
			if (output.includes(expected)) {
				cleanup();
				resolve(output);
			}
		};
		const onExit = () => {
			cleanup();
			resolve(output);
		};
		const timer = setTimeout(() => {
			cleanup();
			resolve(output);
		}, timeoutMs);
		const cleanup = () => {
			clearTimeout(timer);
			proc.stdout.off("data", onData);
			proc.off("exit", onExit);
		};
		proc.stdout.on("data", onData);
		proc.once("exit", onExit);
	});
}

/**
 * Returns available recording tools in priority order.
 */
export function detectRecordingTools(): string[] {
	const tools: string[] = [];
	if (whichSync("sox")) tools.push("sox");
	if (whichSync("ffmpeg")) tools.push("ffmpeg");
	if (!isWindows && whichSync("arecord")) tools.push("arecord");
	if (isWindows) tools.push("powershell");
	return tools;
}

// ── ffmpeg dshow device detection ──────────────────────────────────

async function detectWindowsAudioDevice(): Promise<string> {
	const result = spawnProcessSync("ffmpeg", ["-f", "dshow", "-list_devices", "true", "-i", "dummy"], {
		stdio: "pipe",
	});
	const output = result.stderr?.toString("utf8") ?? result.error?.message ?? "";
	const audioDevices: string[] = [];
	const re = /"([^"]+)"\s*\(audio\)/gi;
	for (const match of output.matchAll(re)) {
		audioDevices.push(match[1]);
	}
	if (audioDevices.length === 0) {
		throw new Error("No audio input device found via ffmpeg dshow. Ensure a microphone is connected.");
	}
	logger.debug("Detected dshow audio devices", { devices: audioDevices });
	return audioDevices[0];
}

// ── Recording implementations ──────────────────────────────────────

async function startSoxRecording(outputPath: string): Promise<RecordingHandle> {
	// On Windows, "-d" (default device) often fails. Use "-t waveaudio 0" for the first input.
	const inputArgs = isWindows ? ["-t", "waveaudio", "0"] : ["-d"];

	const proc = spawnRecordingProcess("sox", [...inputArgs, "-r", "16000", "-c", "1", "-b", "16", "-t", "wav", outputPath]);
	await verifyProcessAlive(proc, "sox");
	return {
		async stop() {
			proc.kill("SIGTERM");
			await waitForExit(proc);
		},
	};
}

async function startFFmpegRecording(outputPath: string): Promise<RecordingHandle> {
	let ffmpegArgs: string[];
	if (isWindows) {
		const device = await detectWindowsAudioDevice();
		ffmpegArgs = [
			"-f",
			"dshow",
			"-i",
			`audio=${device}`,
			"-ar",
			"16000",
			"-ac",
			"1",
			"-sample_fmt",
			"s16",
			"-y",
			outputPath,
		];
	} else if (process.platform === "darwin") {
		ffmpegArgs = [
			"-f",
			"avfoundation",
			"-i",
			":0",
			"-ar",
			"16000",
			"-ac",
			"1",
			"-sample_fmt",
			"s16",
			"-y",
			outputPath,
		];
	} else {
		ffmpegArgs = [
			"-f",
			"pulse",
			"-i",
			"default",
			"-ar",
			"16000",
			"-ac",
			"1",
			"-sample_fmt",
			"s16",
			"-y",
			outputPath,
		];
	}

	const proc = spawnRecordingProcess("ffmpeg", ffmpegArgs);
	await verifyProcessAlive(proc, "ffmpeg");

	return {
		async stop() {
			try {
				proc.stdin.write("q");
				proc.stdin.end();
			} catch {
				// stdin may already be closed
			}
			const killTimer = setTimeout(() => proc.kill(), 3000);
			await waitForExit(proc);
			clearTimeout(killTimer);
		},
	};
}

async function startArecordRecording(outputPath: string): Promise<RecordingHandle> {
	const proc = spawnRecordingProcess("arecord", ["-f", "S16_LE", "-r", "16000", "-c", "1", outputPath]);
	await verifyProcessAlive(proc, "arecord");
	return {
		async stop() {
			proc.kill("SIGTERM");
			await waitForExit(proc);
		},
	};
}

// ── PowerShell mci recorder (Windows zero-dep fallback) ────────────

const PS_RECORD_SCRIPT = `
param([string]$outPath)

if ($outPath -match '["\r\n]') {
    [Console]::Error.WriteLine("Invalid output path: $outPath")
    exit 1
}


Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class MciAudio {
    [DllImport("winmm.dll", CharSet=CharSet.Auto)]
    public static extern int mciSendString(
        string command, StringBuilder buffer, int bufferSize, IntPtr callback);
}
"@

function Mci([string]$cmd) {
    $buf = New-Object System.Text.StringBuilder 256
    $r = [MciAudio]::mciSendString($cmd, $buf, 256, [IntPtr]::Zero)
    if ($r -ne 0) {
        [Console]::Error.WriteLine("MCI error $r for: $cmd")
    }
    return $r
}

$r = Mci "open new type waveaudio alias omp_rec"
if ($r -ne 0) { exit 1 }

Mci "set omp_rec channels 1 samplespersec 16000 bitspersample 16"

$r = Mci "record omp_rec"
if ($r -ne 0) {
    Mci "close omp_rec"
    exit 1
}

Write-Output "RECORDING"
[Console]::Out.Flush()

# Block until parent closes stdin or writes a line
try { [Console]::In.ReadLine() | Out-Null } catch {}

# Stop and save
Mci "stop omp_rec"
$saveCmd = 'save omp_rec "' + $outPath + '"'
$r = Mci $saveCmd
if ($r -ne 0) {
    [Console]::Error.WriteLine("Save failed for: $saveCmd")
}
Mci "close omp_rec"

if (Test-Path $outPath) {
    Write-Output "SAVED"
} else {
    Write-Error "Output file was not created: $outPath"
    exit 1
}
`;

async function startPowerShellRecording(outputPath: string): Promise<RecordingHandle> {
	// Write script to temp file — avoids quoting/escaping issues with -Command
	const scriptPath = path.join(os.tmpdir(), `omp-stt-record-${Snowflake.next()}.ps1`);
	await fs.writeFile(scriptPath, PS_RECORD_SCRIPT, "utf8");

	const proc = spawnRecordingProcess("powershell", [
		"-NoProfile",
		"-ExecutionPolicy",
		"Bypass",
		"-File",
		scriptPath,
		outputPath,
	]);

	waitForExit(proc).then(() => {
		fs.unlink(scriptPath).catch(() => {});
	});

	// Wait for "RECORDING" on stdout to confirm it started
	const output = await waitForOutput(proc, "RECORDING", 8000);

	if (!output.includes("RECORDING")) {
		proc.kill();
		await waitForExit(proc);
		const stderrText = proc.getStderrText();
		// Clean up temp script
		fs.unlink(scriptPath).catch(() => {});
		throw new Error(
			`PowerShell audio recording failed to start: ${stderrText.trim() || output.trim() || "(no output)"}`,
		);
	}

	return {
		async stop() {
			try {
				proc.stdin.write("stop\n");
				proc.stdin.end();
			} catch {
				// stdin may already be closed
			}
			// Give PowerShell time to save the file
			const killTimer = setTimeout(() => proc.kill(), 8000);
			await waitForExit(proc);
			clearTimeout(killTimer);
			// Clean up temp script
			fs.unlink(scriptPath).catch(() => {});
		},
	};
}

// ── Health check ───────────────────────────────────────────────────

async function verifyProcessAlive(proc: RecordingProcess, tool: string): Promise<void> {
	await sleep(300);

	if (proc.exitCode !== null) {
		const stderr = proc.getStderrText().trim();
		throw new Error(`${tool} exited immediately (code ${proc.exitCode}): ${stderr || "(no output)"}`);
	}
}

// ── Public API ─────────────────────────────────────────────────────

export async function startRecording(outputPath: string): Promise<RecordingHandle> {
	const tools = detectRecordingTools();
	if (tools.length === 0) {
		throw new Error(
			isWindows
				? "No audio recording tool found. Install FFmpeg or SoX and add to PATH."
				: "No audio recording tool found. Install SoX: sudo apt install sox, or FFmpeg: sudo apt install ffmpeg",
		);
	}

	const errors: string[] = [];
	for (const tool of tools) {
		logger.debug("Trying audio recording", { tool, outputPath });
		try {
			switch (tool) {
				case "sox":
					return await startSoxRecording(outputPath);
				case "ffmpeg":
					return await startFFmpegRecording(outputPath);
				case "arecord":
					return await startArecordRecording(outputPath);
				case "powershell":
					return await startPowerShellRecording(outputPath);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.debug(`Recording tool ${tool} failed, trying next`, { error: msg });
			errors.push(`${tool}: ${msg}`);
		}
	}

	throw new Error(`All recording tools failed:\n${errors.join("\n")}`);
}

/**
 * Verify a recorded audio file is usable.
 * Returns the file size in bytes, or throws.
 */
export async function verifyRecordingFile(filePath: string): Promise<number> {
	try {
		const stat = await fs.stat(filePath);
		if (stat.size < 100) {
			throw new Error(
				`Recording file is too small (${stat.size} bytes) — audio may not have been captured. ` +
					"Check that a microphone is connected and permissions are granted.",
			);
		}
		return stat.size;
	} catch (err) {
		if (err instanceof Error && err.message.includes("too small")) throw err;
		throw new Error(
			"Recording file was not created. The recording process may have failed silently. " +
				"Check that a microphone is connected.",
		);
	}
}
