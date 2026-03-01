import YahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

// 关键修复：在处理请求之前，先创建一个全新的雅虎财经客户端实例
const yahooFinance = new YahooFinance(); 

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol)
    return NextResponse.json({ error: '请提供代码' }, { status: 400 });

  try {
    // 使用刚刚创建的实例对象去请求数据
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