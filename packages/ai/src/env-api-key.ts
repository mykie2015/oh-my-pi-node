import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { $env, $pickenv } from "@oh-my-pi/pi-utils";

let cachedVertexAdcCredentialsExists: boolean | null = null;

function hasVertexAdcCredentials(): boolean {
	if (cachedVertexAdcCredentialsExists === null) {
		const gacPath = $env.GOOGLE_APPLICATION_CREDENTIALS;
		if (gacPath) {
			cachedVertexAdcCredentialsExists = fs.existsSync(gacPath);
		} else {
			cachedVertexAdcCredentialsExists = fs.existsSync(
				path.join(os.homedir(), ".config", "gcloud", "application_default_credentials.json"),
			);
		}
	}
	return cachedVertexAdcCredentialsExists;
}

type KeyResolver = string | (() => string | undefined);

function isFoundryEnabled(): boolean {
	const value = $env.CLAUDE_CODE_USE_FOUNDRY;
	if (!value) return false;
	const normalized = value.trim().toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

const serviceProviderMap: Record<string, KeyResolver> = {
	"alibaba-coding-plan": "ALIBABA_CODING_PLAN_API_KEY",
	openai: "OPENAI_API_KEY",
	google: "GEMINI_API_KEY",
	groq: "GROQ_API_KEY",
	cerebras: "CEREBRAS_API_KEY",
	xai: "XAI_API_KEY",
	openrouter: "OPENROUTER_API_KEY",
	kilo: "KILO_API_KEY",
	"vercel-ai-gateway": "AI_GATEWAY_API_KEY",
	zai: "ZAI_API_KEY",
	mistral: "MISTRAL_API_KEY",
	minimax: "MINIMAX_API_KEY",
	"minimax-code": "MINIMAX_CODE_API_KEY",
	"minimax-code-cn": "MINIMAX_CODE_CN_API_KEY",
	"opencode-go": "OPENCODE_API_KEY",
	"opencode-zen": "OPENCODE_API_KEY",
	cursor: "CURSOR_ACCESS_TOKEN",
	"azure-openai-responses": "AZURE_OPENAI_API_KEY",
	exa: "EXA_API_KEY",
	jina: "JINA_API_KEY",
	brave: "BRAVE_API_KEY",
	perplexity: "PERPLEXITY_API_KEY",
	tavily: "TAVILY_API_KEY",
	parallel: "PARALLEL_API_KEY",
	kagi: "KAGI_API_KEY",
	"github-copilot": () => $pickenv("COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"),
	anthropic: () =>
		isFoundryEnabled()
			? $pickenv("ANTHROPIC_FOUNDRY_API_KEY", "ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_API_KEY")
			: $pickenv("ANTHROPIC_OAUTH_TOKEN", "ANTHROPIC_API_KEY"),
	"gitlab-duo": "GITLAB_TOKEN",
	"google-vertex": () => {
		if ($env.GOOGLE_CLOUD_API_KEY) {
			return $env.GOOGLE_CLOUD_API_KEY;
		}
		const hasCredentials = hasVertexAdcCredentials();
		const hasProject = !!($env.GOOGLE_CLOUD_PROJECT || $env.GCLOUD_PROJECT);
		const hasLocation = !!$env.GOOGLE_CLOUD_LOCATION;
		if (hasCredentials && hasProject && hasLocation) {
			return "<authenticated>";
		}
	},
	"amazon-bedrock": () => {
		const hasEcsCredentials =
			!!$env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || !!$env.AWS_CONTAINER_CREDENTIALS_FULL_URI;
		const hasWebIdentity = !!$env.AWS_WEB_IDENTITY_TOKEN_FILE && !!$env.AWS_ROLE_ARN;
		if (
			$env.AWS_PROFILE ||
			($env.AWS_ACCESS_KEY_ID && $env.AWS_SECRET_ACCESS_KEY) ||
			$env.AWS_BEARER_TOKEN_BEDROCK ||
			hasEcsCredentials ||
			hasWebIdentity
		) {
			return "<authenticated>";
		}
	},
	synthetic: "SYNTHETIC_API_KEY",
	"cloudflare-ai-gateway": "CLOUDFLARE_AI_GATEWAY_API_KEY",
	huggingface: () => $pickenv("HUGGINGFACE_HUB_TOKEN", "HF_TOKEN"),
	litellm: "LITELLM_API_KEY",
	moonshot: "MOONSHOT_API_KEY",
	nvidia: "NVIDIA_API_KEY",
	nanogpt: "NANO_GPT_API_KEY",
	"lm-studio": "LM_STUDIO_API_KEY",
	ollama: "OLLAMA_API_KEY",
	"llama.cpp": "LLAMA_CPP_API_KEY",
	qianfan: "QIANFAN_API_KEY",
	"qwen-portal": () => $pickenv("QWEN_OAUTH_TOKEN", "QWEN_PORTAL_API_KEY"),
	together: "TOGETHER_API_KEY",
	zenmux: "ZENMUX_API_KEY",
	venice: "VENICE_API_KEY",
	vllm: "VLLM_API_KEY",
	xiaomi: "XIAOMI_API_KEY",
};

export function getEnvApiKey(provider: string): string | undefined {
	const resolver = serviceProviderMap[provider];
	if (typeof resolver === "string") {
		return $env[resolver];
	}
	return resolver?.();
}
