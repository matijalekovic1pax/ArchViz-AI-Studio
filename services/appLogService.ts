import type {
  AppGenerationLogDetailResult,
  AppGenerationLogListParams,
  AppGenerationLogListResult,
} from './apiGateway';
import {
  getAppGenerationLog,
  listAppGenerationLogs,
} from './apiGateway';

export const appLogService = {
  list: (params: AppGenerationLogListParams = {}): Promise<AppGenerationLogListResult> =>
    listAppGenerationLogs(params),

  get: (identifier: string): Promise<AppGenerationLogDetailResult> =>
    getAppGenerationLog(identifier),
};
