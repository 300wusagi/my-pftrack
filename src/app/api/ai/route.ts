import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages, portfolioContext } = await request.json();

    const systemPrompt = `你是一个专业的投资顾问助手，帮助用户分析他们的投资组合。
你的风格是：简洁直接、有数据支撑、会指出风险但不会过度悲观。
用中文回答。不要给出具体的买卖时机建议，但可以分析持仓结构和风险。

以下是用户当前的投资组合数据：

${portfolioContext}

请根据以上数据回答用户的问题。`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('');

    return NextResponse.json({ reply: text });
  } catch (err: any) {
    console.error('[ai]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
