import { BaseInteraction } from 'discord.js';
import { logger } from './logger';

/**
 * Check if a Discord interaction is still valid (not expired)
 * Discord interactions expire after 15 minutes
 */
export function isInteractionValid(interaction: BaseInteraction): boolean {
  const now = Date.now();
  const interactionAge = now - interaction.createdTimestamp;
  const maxAge = 15 * 60 * 1000; // 15 minutes in milliseconds
  
  return interactionAge <= maxAge;
}

/**
 * Safely handle an interaction response with fallback to followUp
 * Returns true if successful, false if failed
 */
export async function safeInteractionReply(
  interaction: any,
  originalInteraction: any,
  content: any,
  operation: 'reply' | 'update' = 'reply'
): Promise<boolean> {
  try {
    if (operation === 'update') {
      await interaction.update(content);
    } else {
      await interaction.reply(content);
    }
    return true;
  } catch (error: any) {
    if (error.code === 10062) { // Unknown interaction
      logger.warn(`Interaction expired, attempting fallback for ${operation}`);
      try {
        // Try to send as followUp from original slash command
        await originalInteraction.followUp({
          ...content,
          ephemeral: content.ephemeral !== false // Default to ephemeral for fallbacks
        });
        return true;
      } catch (followUpError: any) {
        logger.error('Failed to send fallback message:', followUpError);
        return false;
      }
    } else {
      logger.error(`Failed to ${operation} interaction:`, error);
      return false;
    }
  }
}

/**
 * Wrapper for interaction operations that automatically handles expiration
 */
export class SafeInteractionHandler {
  constructor(private originalInteraction: any) {}

  async reply(interaction: any, content: any): Promise<boolean> {
    if (!isInteractionValid(interaction)) {
      logger.warn('Ignored expired interaction (reply)');
      return false;
    }
    
    return safeInteractionReply(interaction, this.originalInteraction, content, 'reply');
  }

  async update(interaction: any, content: any): Promise<boolean> {
    if (!isInteractionValid(interaction)) {
      logger.warn('Ignored expired interaction (update)');
      return false;
    }
    
    return safeInteractionReply(interaction, this.originalInteraction, content, 'update');
  }
}