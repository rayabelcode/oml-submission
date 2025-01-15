import { CallHandler } from './callHandler';
import { notificationService } from './notifications';

export const callHandler = new CallHandler(notificationService);
