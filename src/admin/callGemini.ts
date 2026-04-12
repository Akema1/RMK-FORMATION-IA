import { supabase } from '../lib/supabaseClient';
import type { Seminar } from './types';

interface GeminiMessage {
  role: string;
  parts: Record<string, unknown>[];
}

interface GeminiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface GeminiResult {
  text: string;
  functionCalls: unknown[] | null;
}

export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  seminars: Seminar[],
  _useSearch = false,
  tools?: GeminiTool[]
): Promise<GeminiResult> {
  try {
    const messages: GeminiMessage[] = [{ role: 'user', parts: [{ text: userPrompt }] }];

    for (let i = 0; i < 5; i++) {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, messages, tools })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      if (data.functionCalls && data.functionCalls.length > 0) {
        messages.push({ role: 'model', parts: [{ functionCall: data.functionCalls[0] }] });

        const call = data.functionCalls[0];
        if (call.name === 'check_seminar_stats') {
          const { seminarCode } = call.args;
          const s = seminars.find(x => x.code.toLowerCase() === seminarCode.toLowerCase());
          if (s) {
            const { data: participants } = await supabase.from('participants').select('*').eq('seminar', s.id);
            const confirmed = participants ? participants.filter((d: Record<string, unknown>) => d.status === "confirmed").length : 0;
            const result = `STATS ${s.code}: ${participants?.length || 0} inscrits, ${confirmed} confirmés, ${s.seats} places max.`;

            messages.push({
              role: 'user',
              parts: [{ functionResponse: { name: call.name, response: { result } } }]
            });
          } else {
            messages.push({
              role: 'user',
              parts: [{ functionResponse: { name: call.name, response: { error: "Séminaire non trouvé" } } }]
            });
          }
        }
      } else {
        return { text: data.text, functionCalls: null };
      }
    }
    return { text: "Max iterations reached", functionCalls: null };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { text: `Erreur: ${message}`, functionCalls: null };
  }
}
