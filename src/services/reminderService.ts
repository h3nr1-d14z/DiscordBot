import * as cron from 'node-cron';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { database } from './database';
import { clickupService } from './clickupService';
import { logger } from '../utils/logger';

export class ReminderService {
  private client: Client;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  async initialize() {
    await this.scheduleAllReminders();
    
    cron.schedule('0 * * * *', async () => {
      await this.scheduleAllReminders();
    });

    logger.info('Reminder service initialized');
  }

  private async scheduleAllReminders() {
    try {
      const reminders = await database.all(
        'SELECT * FROM user_reminders WHERE is_enabled = 1'
      );

      for (const reminder of reminders) {
        const jobKey = `${reminder.user_id}_${reminder.reminder_time}`;
        
        if (this.scheduledJobs.has(jobKey)) {
          continue;
        }

        const [hour, minute] = reminder.reminder_time.split(':');
        const cronExpression = `${minute} ${hour} * * *`;

        const job = cron.schedule(cronExpression, async () => {
          await this.sendReminder(reminder.user_id, reminder.channel_id);
        });

        this.scheduledJobs.set(jobKey, job);
        logger.info(`Scheduled reminder for user ${reminder.user_id} at ${reminder.reminder_time}`);
      }

      for (const [key, job] of this.scheduledJobs.entries()) {
        const exists = reminders.some(r => `${r.user_id}_${r.reminder_time}` === key);
        if (!exists) {
          job.stop();
          this.scheduledJobs.delete(key);
          logger.info(`Unscheduled reminder ${key}`);
        }
      }
    } catch (error) {
      logger.error('Error scheduling reminders:', error);
    }
  }

  private async sendReminder(userId: string, channelId: string) {
    try {
      const channel = this.client.channels.cache.get(channelId) as TextChannel;
      
      if (!channel) {
        logger.warn(`Channel ${channelId} not found for reminder`);
        return;
      }

      const tasks = await clickupService.getUpcomingTasks(userId, 2);
      
      const todayTasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        const today = new Date();
        return due.toDateString() === today.toDateString();
      });

      const tomorrowTasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return due.toDateString() === tomorrow.toDateString();
      });

      const overdueTasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        return due < new Date() && due.toDateString() !== new Date().toDateString();
      });

      const embed = new EmbedBuilder()
        .setTitle('📋 Daily Task Reminder')
        .setColor(0x7B68EE)
        .setTimestamp();

      let hasContent = false;

      if (overdueTasks.length > 0) {
        embed.addFields({
          name: `❌ Overdue Tasks (${overdueTasks.length})`,
          value: overdueTasks.slice(0, 5).map(t => `• ${t.taskName}`).join('\n') + 
                 (overdueTasks.length > 5 ? `\n... and ${overdueTasks.length - 5} more` : ''),
          inline: false
        });
        hasContent = true;
      }

      if (todayTasks.length > 0) {
        embed.addFields({
          name: `🚨 Due Today (${todayTasks.length})`,
          value: todayTasks.slice(0, 5).map(t => `• ${t.taskName}`).join('\n') + 
                 (todayTasks.length > 5 ? `\n... and ${todayTasks.length - 5} more` : ''),
          inline: false
        });
        hasContent = true;
      }

      if (tomorrowTasks.length > 0) {
        embed.addFields({
          name: `📅 Due Tomorrow (${tomorrowTasks.length})`,
          value: tomorrowTasks.slice(0, 5).map(t => `• ${t.taskName}`).join('\n') + 
                 (tomorrowTasks.length > 5 ? `\n... and ${tomorrowTasks.length - 5} more` : ''),
          inline: false
        });
        hasContent = true;
      }

      if (!hasContent) {
        embed.setDescription('✨ No tasks due today or tomorrow. Enjoy your day!');
      } else {
        embed.setFooter({ text: 'Use /tasks to view all your upcoming tasks' });
      }

      const user = await this.client.users.fetch(userId);
      await channel.send({
        content: `${user}`,
        embeds: [embed]
      });

      await database.run(
        'UPDATE user_reminders SET last_sent = date(\'now\') WHERE user_id = ?',
        [userId]
      );

      logger.info(`Sent reminder to user ${userId} in channel ${channelId}`);
    } catch (error) {
      logger.error(`Error sending reminder to user ${userId}:`, error);
    }
  }
}

export let reminderService: ReminderService;