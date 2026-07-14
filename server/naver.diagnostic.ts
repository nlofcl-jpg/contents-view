/**
 * Diagnostic module for testing individual Naver APIs
 * Purpose: Identify which API is causing 504 timeout
 */

interface DiagnosticResult {
  api: string;
  startTime: string;
  endTime: string;
  responseTimes: number;
  statusCode: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultCount: number;
  dataPointCount: number;
  success: boolean;
  rawResponse?: any;
}

/**
 * Test Search Trend API independently
 */
export async function testSearchTrendAPI(
  clientId: string,
  clientSecret: string,
  keywords: string[],
  startDate: string,
  endDate: string,
  timeUnit: string
): Promise<DiagnosticResult> {
  const startTime = new Date();
  const result: DiagnosticResult = {
    api: "Search Trend API",
    startTime: startTime.toISOString(),
    endTime: "",
    responseTimes: 0,
    statusCode: null,
    errorCode: null,
    errorMessage: null,
    resultCount: 0,
    dataPointCount: 0,
    success: false,
  };

  try {
    const requestBody = {
      startDate,
      endDate,
      timeUnit,
      keywordGroups: keywords.map(kw => ({
        groupName: kw,
        keywords: [kw],
      })),
    };

    console.log("[Diagnostic] Search Trend API - Request started", {
      timestamp: startTime.toISOString(),
      keywords: keywords.length,
      startDate,
      endDate,
      timeUnit,
    });

    // Create abort controller with 10 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://openapi.naver.com/v1/datalab/search", {
      method: "POST",
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const endTime = new Date();
    result.endTime = endTime.toISOString();
    result.responseTimes = endTime.getTime() - startTime.getTime();
    result.statusCode = response.status;

    const data = await response.json();

    if (response.ok) {
      result.success = true;
      result.resultCount = data.results?.length || 0;
      result.dataPointCount = (data.results || []).reduce(
        (sum: number, item: any) => sum + (item.data?.length || 0),
        0
      );
      result.rawResponse = data;

      console.log("[Diagnostic] Search Trend API - Success", {
        timestamp: endTime.toISOString(),
        responseTimes: result.responseTimes,
        statusCode: result.statusCode,
        resultCount: result.resultCount,
        dataPointCount: result.dataPointCount,
      });
    } else {
      result.errorCode = data.errorCode || "UNKNOWN";
      result.errorMessage = data.errorMessage || "Unknown error";
      result.rawResponse = data;

      console.error("[Diagnostic] Search Trend API - Failed", {
        timestamp: endTime.toISOString(),
        responseTimes: result.responseTimes,
        statusCode: result.statusCode,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
    }
  } catch (error) {
    const endTime = new Date();
    result.endTime = endTime.toISOString();
    result.responseTimes = endTime.getTime() - startTime.getTime();

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        result.errorCode = "TIMEOUT";
        result.errorMessage = "Request timeout (10 seconds)";
      } else {
        result.errorCode = "NETWORK_ERROR";
        result.errorMessage = error.message;
      }
    } else {
      result.errorCode = "UNKNOWN_ERROR";
      result.errorMessage = String(error);
    }

    console.error("[Diagnostic] Search Trend API - Exception", {
      timestamp: endTime.toISOString(),
      responseTimes: result.responseTimes,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
  }

  return result;
}

/**
 * Test Shopping Trend API independently
 */
export async function testShoppingTrendAPI(
  clientId: string,
  clientSecret: string,
  keywords: string[],
  category: string,
  startDate: string,
  endDate: string,
  timeUnit: string
): Promise<DiagnosticResult> {
  const startTime = new Date();
  const result: DiagnosticResult = {
    api: "Shopping Trend API",
    startTime: startTime.toISOString(),
    endTime: "",
    responseTimes: 0,
    statusCode: null,
    errorCode: null,
    errorMessage: null,
    resultCount: 0,
    dataPointCount: 0,
    success: false,
  };

  try {
    const requestBody = {
      startDate,
      endDate,
      timeUnit,
      category,
      keyword: keywords.map(kw => ({
        name: kw,
        param: [kw],
      })),
    };

    console.log("[Diagnostic] Shopping Trend API - Request started", {
      timestamp: startTime.toISOString(),
      keywords: keywords.length,
      category,
      startDate,
      endDate,
      timeUnit,
    });

    // Create abort controller with 10 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      "https://openapi.naver.com/v1/datalab/shopping/category/keywords",
      {
        method: "POST",
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    const endTime = new Date();
    result.endTime = endTime.toISOString();
    result.responseTimes = endTime.getTime() - startTime.getTime();
    result.statusCode = response.status;

    const data = await response.json();

    if (response.ok) {
      result.success = true;
      result.resultCount = data.results?.length || 0;
      result.dataPointCount = (data.results || []).reduce(
        (sum: number, item: any) => sum + (item.data?.length || 0),
        0
      );
      result.rawResponse = data;

      console.log("[Diagnostic] Shopping Trend API - Success", {
        timestamp: endTime.toISOString(),
        responseTimes: result.responseTimes,
        statusCode: result.statusCode,
        resultCount: result.resultCount,
        dataPointCount: result.dataPointCount,
      });
    } else {
      result.errorCode = data.errorCode || "UNKNOWN";
      result.errorMessage = data.errorMessage || "Unknown error";
      result.rawResponse = data;

      console.error("[Diagnostic] Shopping Trend API - Failed", {
        timestamp: endTime.toISOString(),
        responseTimes: result.responseTimes,
        statusCode: result.statusCode,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
    }
  } catch (error) {
    const endTime = new Date();
    result.endTime = endTime.toISOString();
    result.responseTimes = endTime.getTime() - startTime.getTime();

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        result.errorCode = "TIMEOUT";
        result.errorMessage = "Request timeout (10 seconds)";
      } else {
        result.errorCode = "NETWORK_ERROR";
        result.errorMessage = error.message;
      }
    } else {
      result.errorCode = "UNKNOWN_ERROR";
      result.errorMessage = String(error);
    }

    console.error("[Diagnostic] Shopping Trend API - Exception", {
      timestamp: endTime.toISOString(),
      responseTimes: result.responseTimes,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    });
  }

  return result;
}

/**
 * Run diagnostic tests for both APIs
 */
export async function runDiagnostics(
  keywords: string[],
  category: string,
  startDate: string,
  endDate: string,
  timeUnit: string
): Promise<{
  searchTrendResult: DiagnosticResult;
  shoppingTrendResult: DiagnosticResult;
  credentialsConfigured: boolean;
}> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  console.log("[Diagnostic] Starting diagnostics", {
    credentialsConfigured: !!(clientId && clientSecret),
    keywords: keywords.length,
    category,
    startDate,
    endDate,
    timeUnit,
  });

  if (!clientId || !clientSecret) {
    throw new Error("Naver credentials not configured");
  }

  // Run both tests in parallel using Promise.allSettled
  const [searchTrendSettled, shoppingTrendSettled] = await Promise.allSettled([
    testSearchTrendAPI(clientId, clientSecret, keywords, startDate, endDate, timeUnit),
    testShoppingTrendAPI(clientId, clientSecret, keywords, category, startDate, endDate, timeUnit),
  ]);

  const searchTrendResult: DiagnosticResult =
    searchTrendSettled.status === "fulfilled"
      ? searchTrendSettled.value
      : {
          api: "Search Trend API",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          responseTimes: 0,
          statusCode: null,
          errorCode: "PROMISE_REJECTED",
          errorMessage: searchTrendSettled.reason?.message || "Promise rejected",
          resultCount: 0,
          dataPointCount: 0,
          success: false,
        };

  const shoppingTrendResult: DiagnosticResult =
    shoppingTrendSettled.status === "fulfilled"
      ? shoppingTrendSettled.value
      : {
          api: "Shopping Trend API",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          responseTimes: 0,
          statusCode: null,
          errorCode: "PROMISE_REJECTED",
          errorMessage: shoppingTrendSettled.reason?.message || "Promise rejected",
          resultCount: 0,
          dataPointCount: 0,
          success: false,
        };

  console.log("[Diagnostic] Diagnostics complete", {
    searchTrendSuccess: searchTrendResult.success,
    searchTrendResponseTime: searchTrendResult.responseTimes,
    shoppingTrendSuccess: shoppingTrendResult.success,
    shoppingTrendResponseTime: shoppingTrendResult.responseTimes,
  });

  return {
    searchTrendResult,
    shoppingTrendResult,
    credentialsConfigured: true,
  };
}
