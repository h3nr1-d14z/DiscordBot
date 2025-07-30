import { Client, VoiceChannel, StageChannel } from 'discord.js';
import { logger } from '../utils/logger';
import { embeddedAppServer } from './embeddedAppServerFixed';

export interface ActivityConfig {
  name: string;
  type: number;
  url?: string;
  application_id?: string;
}

export class ActivityService {
  private client: Client;
  private activities: Map<string, ActivityConfig> = new Map();

  constructor(client: Client) {
    this.client = client;
    this.initializeActivities();
  }

  private initializeActivities() {
    // All activities use the same base URL
    const baseUrl = embeddedAppServer.getUrl();
    const clientId = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
    
    this.activities.set('2048', {
      name: '2048',
      type: 0, // Playing
      url: baseUrl,
      application_id: clientId
    });

    this.activities.set('snake', {
      name: 'Snake',
      type: 0,
      url: baseUrl,
      application_id: clientId
    });

    this.activities.set('doom', {
      name: 'DOOM',
      type: 0,
      url: baseUrl,
      application_id: clientId
    });
  }

  async createActivity(channelId: string, activityName: string): Promise<string | null> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel || (!(channel instanceof VoiceChannel) && !(channel instanceof StageChannel))) {
        throw new Error('Channel must be a voice or stage channel');
      }

      const activity = this.activities.get(activityName.toLowerCase());
      if (!activity) {
        throw new Error(`Activity ${activityName} not found`);
      }
      
      // Create a game session for this channel
      embeddedAppServer.createGameSession(channelId, activityName.toLowerCase());

      // Get the application ID
      const applicationId = activity.application_id || process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
      
      if (!applicationId) {
        throw new Error('No application ID found. Please set DISCORD_CLIENT_ID or CLIENT_ID in your environment variables.');
      }

      // Create invite with embedded application
      const invite = await channel.createInvite({
        maxAge: 0, // Never expire
        targetType: 2, // Embedded application
        targetApplication: applicationId
      });

      logger.info(`Created activity ${activityName} in channel ${channel.name}`);
      return invite.url;
    } catch (error: any) {
      logger.error('Failed to create activity:', error);
      
      // Provide more specific error messages
      if (error.code === 50013) {
        throw new Error('Missing permissions. The bot needs "Create Instant Invite" and "Use Embedded Activities" permissions in this voice channel.');
      } else if (error.code === 50035 && error.message.includes('GUILD_INVITE_INVALID_APPLICATION')) {
        throw new Error('Discord Activities are not enabled for this bot. To enable activities:\n1. Go to https://discord.com/developers/applications\n2. Select your bot application\n3. Navigate to "Activities" section\n4. Enable activities for your bot\n5. You may need to submit your bot for verification');
      } else if (error.code === 50035 && error.message.includes('target_application_id')) {
        throw new Error('Invalid application ID. Please check your CLIENT_ID environment variable.');
      }
      
      throw error;
    }
  }

  getAvailableActivities(): string[] {
    return Array.from(this.activities.keys());
  }

  getActivityUrl(activityName: string): string | null {
    const activity = this.activities.get(activityName.toLowerCase());
    return activity?.url || null;
  }
}

export let activityService: ActivityService;

export function initializeActivityService(client: Client) {
  activityService = new ActivityService(client);
  return activityService;
}