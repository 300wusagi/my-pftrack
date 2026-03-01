import yahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol)
    return NextResponse.json({ error: '请提供代码' }, { status: 400 });

  try {
    // 移除了 suppressNotices，避免 Next.js 生产环境打包时找不到该函数的 TypeError

    // 在真实的云服务器（Vercel）上，直接调用底层数据
    const quote = await yahooFinance.quote(symbol);

    return NextResponse.json({
      symbol: quote.symbol,
      name: quote.shortName || quote.longName || symbol,
      price: quote.regularMarketPrice,
      currency: quote.currency || 'USD',
    });
  } catch (error) {
    console.error(`[${symbol}] 抓取报错:`, error);
    return NextResponse.json(
      { error: '获取失败，请检查代码' },
      { status: 500 }
    );
  }
}