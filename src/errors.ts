export class KanApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'KanApiError';
  }

  static fromHttpStatus(status: number, message: string): KanApiError {
    const code = mapHttpStatusToErrorCode(status);
    return new KanApiError(status, code, message);
  }
}

function mapHttpStatusToErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'invalidInput';
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'notFound';
    case 500:
      return 'internalError';
    default:
      return 'unknownError';
  }
}

export class McpError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'McpError';
  }
}

export function toMcpError(error: unknown): McpError {
  if (error instanceof KanApiError) {
    return new McpError(error.code, error.message);
  }
  if (error instanceof Error) {
    return new McpError('unknownError', error.message);
  }
  return new McpError('unknownError', 'An unknown error occurred');
}
