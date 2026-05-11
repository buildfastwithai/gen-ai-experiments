// ═══════════════════════════════════════════════════════════════
// 🍪 Cookie — Planning Engine
// "Plan the work, work the plan. Then improvise."
// ═══════════════════════════════════════════════════════════════

import { nanoid } from 'nanoid';
import { eventBus } from '../core/events.js';

export interface TaskStep {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface Plan {
  id: string;
  goal: string;
  steps: TaskStep[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

export class PlanningEngine {
  private currentPlan: Plan | null = null;

  /**
   * Create a new plan from a goal description
   */
  createPlan(goal: string, steps: string[]): Plan {
    const plan: Plan = {
      id: nanoid(8),
      goal,
      steps: steps.map(desc => ({
        id: nanoid(6),
        description: desc,
        status: 'pending',
      })),
      status: 'planning',
      createdAt: Date.now(),
    };

    this.currentPlan = plan;
    eventBus.emit('plan:created', plan);
    return plan;
  }

  /**
   * Start executing the current plan
   */
  startExecution(): void {
    if (!this.currentPlan) return;
    this.currentPlan.status = 'executing';
  }

  /**
   * Mark the current step as running
   */
  startStep(stepId: string): void {
    if (!this.currentPlan) return;
    const step = this.currentPlan.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'running';
      step.startedAt = Date.now();
      eventBus.emit('plan:step', { planId: this.currentPlan.id, step });
    }
  }

  /**
   * Mark a step as completed
   */
  completeStep(stepId: string, result?: string): void {
    if (!this.currentPlan) return;
    const step = this.currentPlan.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'done';
      step.result = result;
      step.completedAt = Date.now();

      // Check if all steps are done
      if (this.currentPlan.steps.every(s => s.status === 'done' || s.status === 'skipped')) {
        this.currentPlan.status = 'completed';
        this.currentPlan.completedAt = Date.now();
        eventBus.emit('plan:complete', this.currentPlan);
      }
    }
  }

  /**
   * Mark a step as failed
   */
  failStep(stepId: string, error: string): void {
    if (!this.currentPlan) return;
    const step = this.currentPlan.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'failed';
      step.error = error;
      step.completedAt = Date.now();
    }
  }

  /**
   * Get the next pending step
   */
  getNextStep(): TaskStep | null {
    if (!this.currentPlan) return null;
    return this.currentPlan.steps.find(s => s.status === 'pending') || null;
  }

  /**
   * Get plan progress
   */
  getProgress(): { completed: number; total: number; percentage: number } {
    if (!this.currentPlan) return { completed: 0, total: 0, percentage: 0 };
    const total = this.currentPlan.steps.length;
    const completed = this.currentPlan.steps.filter(s => s.status === 'done' || s.status === 'skipped').length;
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }

  /**
   * Format the plan for display
   */
  formatPlan(): string {
    if (!this.currentPlan) return 'No active plan.';
    const lines = [`📋 Plan: ${this.currentPlan.goal}\n`];
    for (const step of this.currentPlan.steps) {
      const icon = { pending: '⬜', running: '🔄', done: '✅', failed: '❌', skipped: '⏭️' }[step.status];
      lines.push(`  ${icon} ${step.description}`);
      if (step.error) lines.push(`     └─ Error: ${step.error}`);
    }
    const progress = this.getProgress();
    lines.push(`\n  Progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
    return lines.join('\n');
  }

  getCurrentPlan(): Plan | null {
    return this.currentPlan;
  }
}
