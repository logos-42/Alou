import { Service, Tool, Context } from '@modelcontextprotocol/sdk';
import axios from 'axios';
import * as dfd from 'danfojs-node';

class StockAnalysisAssistant extends Service {
  private validateStockSymbol(symbol: string) {
    if (!symbol || typeof symbol !== 'string' || !/^[A-Z]{1,5}$/.test(symbol)) {
      throw new Error('Invalid stock symbol format');
    }
  }

  private validateDateRange(start: string, end: string) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) throw new Error('Invalid start date format');
    if (isNaN(endDate.getTime())) throw new Error('Invalid end date format');
    if (startDate > endDate) throw new Error('Start date cannot be after end date');
  }

  @Tool({
    name: 'YahooFinanceDataFetcher',
    description: 'Retrieves historical stock data from Yahoo Finance API'
  })
  private async fetchYahooFinanceData(
    symbol: string,
    startDate: string,
    endDate: string
  ): Promise<any> {
    this.validateStockSymbol(symbol);
    this.validateDateRange(startDate, endDate);

    try {
      const period1 = Math.floor(new Date(startDate).getTime() / 1000);
      const period2 = Math.floor(new Date(endDate).getTime() / 1000);
      const url = `https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${period1}&period2=${period2}&interval=1d&events=history`;

      const response = await axios.get(url, {
        headers: { 'User-Agent': 'MCP-StockAnalysis/1.0' }
      });

      if (response.status !== 200 || !response.data) {
        throw new Error('Failed to fetch data from Yahoo Finance');
      }

      return response.data;
    } catch (error) {
      throw new Error(`Yahoo Finance API error: ${error.message}`);
    }
  }

  @Tool({
    name: 'AlphaVantageRealtimeData',
    description: 'Fetches real-time stock quotes and technical indicators'
  })
  private async fetchAlphaVantageData(symbol: string): Promise<any> {
    this.validateStockSymbol(symbol);
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) throw new Error('Alpha Vantage API key not configured');

    try {
      const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
      const rsiUrl = `https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${apiKey}`;

      const [quoteResponse, rsiResponse] = await Promise.all([
        axios.get(quoteUrl),
        axios.get(rsiUrl)
      ]);

      if (quoteResponse.data['Error Message'] || rsiResponse.data['Error Message']) {
        throw new Error('Alpha Vantage API returned error');
      }

      return {
        quote: quoteResponse.data['Global Quote'],
        rsi: rsiResponse.data['Technical Analysis: RSI']
      };
    } catch (error) {
      throw new Error(`Alpha Vantage API error: ${error.message}`);
    }
  }

  @Tool({
    name: 'PandasDataProcessor',
    description: 'Processes financial data using Danfo.js (Pandas-like) for analysis'
  })
  private processFinancialData(historicalData: any, realtimeData: any): any {
    if (!historicalData || !realtimeData) {
      throw new Error('Missing input data for processing');
    }

    try {
      // Parse CSV historical data
      const df = new dfd.DataFrame(historicalData, {
        columns: ['Date', 'Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']
      });

      // Calculate technical indicators
      df.addColumn('SMA_50', dfd.rolling_mean(df['Close'], 50), { inplace: true });
      df.addColumn('SMA_200', dfd.rolling_mean(df['Close'], 200), { inplace: true });
      df.addColumn('Daily_Return', df['Close'].diff(), { inplace: true });

      // Extract latest RSI from Alpha Vantage
      const latestRSI = Object.values(realtimeData.rsi)[0]?.['RSI'];
      
      return {
        processedData: df.head(5), // Sample of processed data
        indicators: {
          sma50: df['SMA_50'].values[df['SMA_50'].values.length - 1],
          sma200: df['SMA_200'].values[df['SMA_200'].values.length - 1],
          currentRSI: parseFloat(latestRSI) || null
        }
      };
    } catch (error) {
      throw new Error(`Data processing error: ${error.message}`);
    }
  }

  @Context({
    description: 'Performs comprehensive stock analysis using multiple data sources',
    input: {
      symbol: { type: 'string', description: 'Stock ticker symbol (e.g. AAPL)' },
      startDate: { type: 'string', format: 'date', description: 'Analysis start date (YYYY-MM-DD)' },
      endDate: { type: 'string', format: 'date', description: 'Analysis end date (YYYY-MM-DD)' }
    }
  })
  async analyzeStock(context: { 
    symbol: string; 
    startDate: string; 
    endDate: string 
  }) {
    try {
      // Input validation
      if (!context.symbol || !context.startDate || !context.endDate) {
        throw new Error('Missing required parameters: symbol, startDate, endDate');
      }

      // Execute data collection tools
      const historicalData = await this.fetchYahooFinanceData(
        context.symbol, 
        context.startDate, 
        context.endDate
      );
      
      const realtimeData = await this.fetchAlphaVantageData(context.symbol);
      
      // Process data with Pandas-like operations
      const analysisResults = this.processFinancialData(
        historicalData, 
        realtimeData
      );

      // Generate investment recommendation
      let recommendation = 'Neutral';
      let confidence = 'Medium';
      
      if (analysisResults.indicators.currentRSI < 30 && 
          analysisResults.indicators.sma50 > analysisResults.indicators.sma200) {
        recommendation = 'Strong Buy';
        confidence = 'High';
      } else if (analysisResults.indicators.currentRSI > 70) {
        recommendation = 'Sell';
        confidence = 'High';
      }

      // Structured result with key insights
      return {
        stock: context.symbol,
        analysisPeriod: `${context.startDate} to ${context.endDate}`,
        currentPrice: realtimeData.quote['05. price'],
        keyIndicators: analysisResults.indicators,
        recommendation,
        confidence,
        reportSummary: `Technical analysis shows ${recommendation} signal with ${confidence} confidence based on moving averages and RSI`
      };
    } catch (error) {
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }
}

export default StockAnalysisAssistant;