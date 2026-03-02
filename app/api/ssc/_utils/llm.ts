export type LlmRequest = {
  systemPrompt: string;
  userPrompt: string;
  imageBase64?: string;
};

export type LlmClient = {
  generate: (request: LlmRequest) => Promise<string>;
};

function resolveOpenAiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  return apiKey;
}

export function createOpenAiClient(): LlmClient {
  const apiKey = resolveOpenAiKey();
  const model = process.env.SSC_OPENAI_MODEL ?? "gpt-4.1-mini";
  const endpoint = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1/responses";

  return {
    async generate(request) {
      const input = [
        {
          role: "system",
          content: [{ type: "text", text: request.systemPrompt }],
        },
        {
          role: "user",
          content: [
            { type: "text", text: request.userPrompt },
            ...(request.imageBase64
              ? [{ type: "input_image", image_base64: request.imageBase64 }]
              : []),
          ],
        },
      ];

      const body = {
        model,
        input,
        response_format: { type: "json_object" },
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`OpenAI error ${response.status}: ${errorText}`);
      }

      const payload = await response.json();
      if (typeof payload.output_text === "string") {
        return payload.output_text;
      }

      const output = payload.output?.[0];
      const content = output?.content?.[0];
      if (content?.text) {
        return content.text;
      }

      const choice = payload.choices?.[0];
      const message = choice?.message?.content;
      if (typeof message === "string") {
        return message;
      }

      throw new Error("OpenAI response missing output text");
    },
  };
}
