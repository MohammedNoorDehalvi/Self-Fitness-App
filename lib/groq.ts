import type { EnhancementMode, GroqModel } from './types';

const SYSTEM_PROMPTS: Record<EnhancementMode, string> = {
  general: `You are an elite prompt engineer. Rewrite the user's prompt to be maximally effective, detailed, clear, and structured. Improve clarity, add necessary context, constraints, format instructions, and quality boosters while preserving the original intent.

Guidelines:
- Make the prompt specific and unambiguous
- Add structure (numbered steps, sections, or clear formatting)
- Include quality constraints (e.g., "be thorough", "provide examples")
- Add relevant context that the user likely intended
- Specify desired output format when appropriate
- Return ONLY the enhanced prompt — no explanations, no markdown wrapping, no quotes around it`,

  'image-generation': `You are an expert AI image prompt engineer specializing in Midjourney, Flux, and Stable Diffusion prompts. Rewrite the user's prompt into a highly detailed, visually descriptive image generation prompt.

Guidelines:
- Add specific visual details: lighting, composition, camera angle, art style
- Include technical parameters like aspect ratio suggestions, style references
- Use evocative descriptors for mood, atmosphere, color palette
- Add quality boosters (e.g., "masterpiece", "highly detailed", "professional photography")
- Structure with comma-separated descriptors, most important first
- Include negative prompt suggestions if applicable
- Return ONLY the enhanced prompt — no explanations, no markdown, no quotes`,

  coding: `You are a senior software architect and prompt engineer. Rewrite the user's programming/technical prompt to get the best possible code output from an AI.

Guidelines:
- Specify language, framework, and version requirements
- Define expected input/output with examples
- Add constraints: error handling, edge cases, performance requirements
- Request specific patterns: SOLID, DRY, type safety
- Ask for documentation, tests, and usage examples
- Specify code style and formatting preferences
- Return ONLY the enhanced prompt — no explanations, no markdown, no quotes`,

  'creative-writing': `You are a master writing coach and prompt engineer. Rewrite the user's creative writing prompt to elicit the most engaging, well-crafted literary output.

Guidelines:
- Define tone, voice, and narrative perspective
- Specify genre conventions and literary techniques to employ
- Add sensory details and emotional depth requirements
- Include pacing, structure, and length expectations
- Request specific literary devices (metaphor, foreshadowing, etc.)
- Define character depth and world-building expectations
- Return ONLY the enhanced prompt — no explanations, no markdown, no quotes`,

  marketing: `You are a world-class marketing strategist and prompt engineer. Rewrite the user's marketing/advertising prompt for maximum commercial impact.

Guidelines:
- Define target audience demographics and psychographics
- Specify brand voice and messaging framework
- Include call-to-action requirements
- Add channel-specific formatting (social, email, landing page)
- Request A/B test variations when applicable
- Include conversion optimization principles
- Specify emotional triggers and value propositions
- Return ONLY the enhanced prompt — no explanations, no markdown, no quotes`,

  academic: `You are a distinguished academic researcher and prompt engineer. Rewrite the user's research/academic prompt for scholarly rigor and depth.

Guidelines:
- Specify academic discipline and methodology
- Request proper citation format and sourcing
- Define analytical framework and theoretical lens
- Add requirements for evidence, data, and logical reasoning
- Include structural expectations (abstract, literature review, etc.)
- Request counterarguments and limitations analysis
- Specify academic tone and formality level
- Return ONLY the enhanced prompt — no explanations, no markdown, no quotes`,
};

export async function enhancePrompt({
  prompt,
  mode,
  apiKey,
  model,
  temperature,
  maxTokens,
  onChunk,
  signal,
}: {
  prompt: string;
  mode: EnhancementMode;
  apiKey: string;
  model: GroqModel;
  temperature: number;
  maxTokens: number;
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  if (!apiKey) {
    throw new Error('Please add your Groq API key in Settings to get started.');
  }

  if (!prompt.trim()) {
    throw new Error('Please enter a prompt to enhance.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[mode] },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your Groq API key in Settings.');
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (response.status === 503) {
      throw new Error('Groq service is temporarily unavailable. Please try again shortly.');
    }
    throw new Error(
      (errorData as { error?: { message?: string } })?.error?.message ||
        `Request failed with status ${response.status}`
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to read response stream.');
  }

  const decoder = new TextDecoder();
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}
