import { describe, expect, it, vi } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter.js';

describe('AllExceptionsFilter', () => {
  it('formats HttpException with requestId and timestamp', () => {
    const filter = new AllExceptionsFilter();
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    const hostMock: any = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({
          method: 'GET',
          url: '/api/test',
          headers: { 'x-request-id': 'req-1234' },
        }),
      }),
    };

    const exception = new HttpException('Access denied', HttpStatus.FORBIDDEN);
    filter.catch(exception, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.FORBIDDEN,
        requestId: 'req-1234',
        message: 'Access denied',
        path: '/api/test',
      }),
    );
  });

  it('handles unexpected errors as 500 without leaking stack traces', () => {
    const filter = new AllExceptionsFilter();
    const jsonMock = vi.fn();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    const hostMock: any = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({
          method: 'POST',
          url: '/api/crash',
          headers: {},
        }),
      }),
    };

    const exception = new Error('Database connection broke');
    filter.catch(exception, hostMock);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        path: '/api/crash',
      }),
    );
  });
});

