import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { messages, portfolioContext } = await request.json();

    const systemPrompt = `你是一个专业的投资顾问助手，帮助用户分析他们的投资组合。用中文回答。
对于重要的持仓或者用户询问的投资标的，你需要在尽量权威的网站(比如seeking alpha,YahooFinance,かぶたん等)上搜索最近的股价变化及财务数据,从以下角度进行分析
1.财务面 
(1)财务报表分析 判断增长逻辑有无变化 
(2)重要财务指标分析:营收,利润是否有持续增长。PER,PEG,PBR,ROE在最近3-5年的变化,判断其现在估值处在一个什么样的位置 
(3)股息率。是否有增加派息的倾向等。 
2.技术面 
(1)分析各种代表趋势的指标:包括MACD,KJD，各个EMA的金叉或死叉的出现与否,SAR信号等。并且通过观察是否有背离形态判断趋势的动能改变。
(2)分析各种评估超买超卖的指标:包括布林带,RSI ，KJD
(3)通过过去股价描绘出抵抗线和支撑线(可使用斐波那契回撤等分析工具),判断是否形成三角形态,头肩线形态等信号,也需结合筹码分布进行判断抵抗与支撑的有效性 
(4)分析K线形态并结合成交量大小判断是否出现有效的止跌或滞涨等形态信号 

综合以上分析给出投资建议。
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
