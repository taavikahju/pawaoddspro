// Declaration file for node-cron
declare module 'node-cron' {
  /**
   * Schedules a task to be executed according to the cron pattern
   * @param cronExpression The cron pattern to use
   * @param task The task to execute
   * @param options Optional scheduling options
   */
  export function schedule(
    cronExpression: string,
    task: () => void,
    options?: {
      scheduled?: boolean;
      timezone?: string;
    }
  ): ScheduledTask;

  export interface ScheduledTask {
    /**
     * Stops the scheduled task
     */
    stop(): void;
    
    /**
     * Starts the scheduled task
     */
    start(): void;
    
    /**
     * Gets the current state of the scheduled task
     */
    getStatus(): string;
  }

  /**
   * Validates a cron expression
   * @param cronExpression The cron pattern to validate
   * @returns true if the expression is valid
   */
  export function validate(cronExpression: string): boolean;
}