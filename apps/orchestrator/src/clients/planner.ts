import { env } from '../config';

// Wire types — must stay aligned with services/planner/planner/schemas.py

export interface ScriptBeat {
  time: number;
  description: string;
}

export interface ScriptJson {
  title: string;
  hook: string;
  beats: ScriptBeat[];
  cta: string;
  tone: string;
  estimatedDurationSec: number;
}

export interface SeoOutput {
  title: string;
  description: string;
  hashtags: string[];
}

export interface PlanScriptRequest {
  userPrompt: string;
  durationTargetSec: number;
  sourceLocale: string;
  format: string;
  styleHint?: string | null;
  platformHint?: string | null;
}

export interface PlanScriptResponse {
  scriptJson: ScriptJson;
  seo: SeoOutput;
}

export interface SceneSpec {
  idx: number;
  durationSec: number;
  narrativeGoal: string;
  visualDescription: string;
  mood: string;
  location: string;
  cameraShotType: string;
  cameraMovement: string;
  cameraLens: string;
  lighting: string;
  imagePrompt: string;
  videoPrompt: string;
  musicPromptHint: string;
  sfxHints: string[];
  transitionIn?: string | null;
  transitionOut?: string | null;
  voiceText: string;
}

export interface StoryboardRequest {
  scriptJson: ScriptJson;
  format: string;
  durationTargetSec: number;
  sourceLocale: string;
  styleHint?: string | null;
}

export interface StoryboardResponse {
  scenes: SceneSpec[];
}

export interface TranslateRequest {
  text: string;
  sourceLocale: string;
  targetLocale: string;
}

export interface TranslateResponse {
  translated: string;
}

export class PlannerClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = env.PLANNER_SVC_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async planScript(req: PlanScriptRequest): Promise<PlanScriptResponse> {
    return this.post<PlanScriptResponse>('/plan-script', req);
  }

  async storyboard(req: StoryboardRequest): Promise<StoryboardResponse> {
    return this.post<StoryboardResponse>('/storyboard', req);
  }

  async translate(req: TranslateRequest): Promise<TranslateResponse> {
    return this.post<TranslateResponse>('/translate', req);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '<no body>');
      throw new Error(`planner ${path} ${res.status}: ${text.slice(0, 500)}`);
    }
    return res.json() as Promise<T>;
  }
}
