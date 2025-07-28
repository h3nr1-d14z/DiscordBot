import axios from 'axios';
import { database } from './database';
import { logger } from '../utils/logger';

interface ClickUpTask {
  id: string;
  name: string;
  description: string;
  status: {
    status: string;
    color: string;
  };
  priority: {
    priority: string;
    color: string;
  } | null;
  due_date: string | null;
  start_date: string | null;
  list: {
    name: string;
  };
  space: {
    name: string;
  };
  assignees: Array<{
    username: string;
    email: string;
  }>;
}

interface CachedTask {
  taskId: string;
  taskName: string;
  taskDescription: string;
  dueDate: string | null;
  priority: string | null;
  status: string;
  listName: string;
  spaceName: string;
}

export class ClickUpService {
  private readonly baseUrl = 'https://api.clickup.com/api/v2';

  async validateApiToken(apiToken: string): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': apiToken
        }
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getUserInfo(apiToken: string): Promise<{ id: string; username: string; email: string } | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': apiToken
        }
      });
      
      const user = response.data.user;
      return {
        id: user.id,
        username: user.username,
        email: user.email
      };
    } catch (error) {
      logger.error('Failed to get ClickUp user info:', error);
      return null;
    }
  }

  async getWorkspaces(apiToken: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await axios.get(`${this.baseUrl}/team`, {
        headers: {
          'Authorization': apiToken
        }
      });
      
      return response.data.teams.map((team: any) => ({
        id: team.id,
        name: team.name
      }));
    } catch (error) {
      logger.error('Failed to get ClickUp workspaces:', error);
      return [];
    }
  }

  async getUpcomingTasks(userId: string, days: number = 14): Promise<CachedTask[]> {
    const clickupUser = await database.getClickUpUser(userId);
    
    if (!clickupUser || !clickupUser.api_token) {
      throw new Error('ClickUp not linked. Please link your ClickUp account first.');
    }

    try {
      const tasks = await this.fetchTasksFromClickUp(clickupUser.api_token, clickupUser.workspace_id, clickupUser.clickup_user_id, days);
      
      const cachedTasks: CachedTask[] = tasks.map(task => ({
        taskId: task.id,
        taskName: task.name,
        taskDescription: task.description || '',
        dueDate: task.due_date,
        priority: task.priority?.priority || null,
        status: task.status.status,
        listName: task.list.name,
        spaceName: task.space.name
      }));

      await database.cacheClickUpTasks(userId, cachedTasks);
      
      return cachedTasks;
    } catch (error) {
      logger.error('Failed to fetch tasks from ClickUp:', error);
      
      const cachedTasks = await database.getUpcomingTasks(userId, days);
      if (cachedTasks.length > 0) {
        return cachedTasks.map(task => ({
          taskId: task.task_id,
          taskName: task.task_name,
          taskDescription: task.task_description || '',
          dueDate: task.due_date,
          priority: task.priority,
          status: task.status,
          listName: task.list_name,
          spaceName: task.space_name
        }));
      }
      
      throw error;
    }
  }

  private async fetchTasksFromClickUp(apiToken: string, workspaceId: string, clickupUserId: string, days: number): Promise<ClickUpTask[]> {
    const now = Date.now();
    const futureDate = now + (days * 24 * 60 * 60 * 1000);
    
    try {
      const response = await axios.get(`${this.baseUrl}/team/${workspaceId}/task`, {
        headers: {
          'Authorization': apiToken
        },
        params: {
          assignees: [clickupUserId],
          due_date_gt: now,
          due_date_lt: futureDate,
          include_closed: false,
          subtasks: true
        }
      });
      
      return response.data.tasks;
    } catch (error: any) {
      logger.error('ClickUp API error:', error);
      
      if (error.response?.data?.err) {
        throw new Error(`ClickUp API error: ${error.response.data.err}`);
      }
      
      throw new Error('Failed to fetch tasks from ClickUp');
    }
  }

  async createTask(userId: string, listId: string, taskData: {
    name: string;
    description?: string;
    priority?: number;
    dueDate?: Date;
  }): Promise<boolean> {
    const clickupUser = await database.getClickUpUser(userId);
    
    if (!clickupUser || !clickupUser.api_token) {
      throw new Error('ClickUp not linked. Please link your ClickUp account first.');
    }

    try {
      const payload: any = {
        name: taskData.name,
        description: taskData.description || '',
      };

      if (taskData.priority !== undefined) {
        payload.priority = taskData.priority;
      }

      if (taskData.dueDate) {
        payload.due_date = taskData.dueDate.getTime();
      }

      const response = await axios.post(
        `${this.baseUrl}/list/${listId}/task`,
        payload,
        {
          headers: {
            'Authorization': clickupUser.api_token,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.status === 200;
    } catch (error) {
      logger.error('Failed to create ClickUp task:', error);
      return false;
    }
  }

  formatTaskForDisplay(task: CachedTask): string {
    const priorityEmojis: { [key: string]: string } = {
      'urgent': '🔴',
      'high': '🟠',
      'normal': '🟡',
      'low': '🟢'
    };

    const statusEmojis: { [key: string]: string } = {
      'to do': '📋',
      'in progress': '⏳',
      'review': '👀',
      'done': '✅',
      'closed': '🔒'
    };

    let result = '';
    
    if (task.priority) {
      result += `${priorityEmojis[task.priority.toLowerCase()] || '⚪'} `;
    }
    
    result += `${statusEmojis[task.status.toLowerCase()] || '📌'} `;
    result += `**${task.taskName}**`;
    
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilDue === 0) {
        result += ' 🚨 **Due Today!**';
      } else if (daysUntilDue === 1) {
        result += ' ⚠️ Due Tomorrow';
      } else if (daysUntilDue < 0) {
        result += ' ❌ **Overdue!**';
      } else {
        result += ` 📅 Due in ${daysUntilDue} days`;
      }
    }
    
    result += `\n   📁 ${task.spaceName} > ${task.listName}`;
    
    return result;
  }
}

export const clickupService = new ClickUpService();