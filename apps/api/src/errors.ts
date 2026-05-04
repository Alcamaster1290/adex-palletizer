export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
    timestamp: string;
  };
}

export function buildErrorBody(code: string, message: string, requestId: string): ApiErrorBody {
  return {
    error: {
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}
