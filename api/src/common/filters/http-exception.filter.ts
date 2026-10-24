import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    if (typeof rawResponse === 'string') {
      message = rawResponse;
    } else if (rawResponse && typeof rawResponse === 'object') {
      const respObj = rawResponse as Record<string, unknown>;
      if (respObj.message) {
        message = respObj.message as string | string[];
      }
    } else if (exception instanceof Error && process.env.NODE_ENV !== 'production') {
      message = exception.message;
    }

    const requestId = (request.headers['x-request-id'] as string) || 'unknown';

    // Structured logging
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status: ${status} - RequestId: ${requestId} - ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - Status: ${status} - RequestId: ${requestId} - Message: ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      message,
    });
  }
}
