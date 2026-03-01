import YahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

const yahooFinance = new YahooFinance();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol)
    return NextResponse.json({ error: '请提供代码' }, { status: 400 });

  try {
    const quote = await yahooFinance.quote(symbol);

    const currentPrice = quote.regularMarketPrice;
    const previousClose = quote.regularMarketPreviousClose;
    const changePercent =
      previousClose && currentPrice
        ? ((currentPrice - previousClose) / previousClose) * 100
        : null;

    return NextResponse.json({
      symbol: quote.symbol,
      name: quote.shortName || quote.longName || symbol,
      price: currentPrice,
      previousClose,
      changePercent,
      currency: quote.currency || 'USD',
    });
  } catch (error) {
    console.error(`[${symbol}] 抓取报错:`, error?.message || error);
    return NextResponse.json(
      { error: '获取失败，请检查代码是否正确' },
      { status: 500 }
    );
  }
}
