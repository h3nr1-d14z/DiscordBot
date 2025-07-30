import { VoiceChannel, StageChannel } from 'discord.js';
import { logger } from '../utils/logger';

// Discord's built-in activity IDs
export const DiscordActivities = {
  // Gaming
  POKER_NIGHT: '755827207812677713',
  BETRAYAL_IO: '773336526917861400',
  FISHING: '814288819477020702',
  CHESS_IN_THE_PARK: '832012774040141894',
  CHECKERS_IN_THE_PARK: '832013003968348200',
  LETTER_LEAGUE: '879863686565621790',
  WORD_SNACKS: '879863976006127627',
  SKETCH_HEADS: '902271654783242291',
  SPELL_CAST: '852509694341283871',
  PUTT_PARTY: '945737671223947305',
  LAND_IO: '903769130790969345',
  BOBBLE_LEAGUE: '947957217959759964',
  ASK_AWAY: '976052223358406656',
  KNOW_WHAT_I_MEME: '950505761862189096',
  BASH_OUT: '1006584476094177371',
  GARTIC_PHONE: '1007373802981822582',
  
  // Watching/Entertainment
  WATCH_TOGETHER: '880218394199220334',
  YOUTUBE_TOGETHER: '880218394199220334', // Same as watch together
  
  // Productivity
  WHITEBOARD: '1070087967294631976',
  
  // Holiday/Seasonal
  BLAZING_8S: '832025144389533716',
} as const;

export type ActivityName = keyof typeof DiscordActivities;

export async function createDiscordActivity(
  channel: VoiceChannel | StageChannel,
  activityId: string
): Promise<string | null> {
  try {
    const invite = await channel.createInvite({
      maxAge: 0, // Never expire
      targetType: 2, // Embedded application
      targetApplication: activityId
    });

    logger.info(`Created Discord activity in channel ${channel.name}`);
    return invite.url;
  } catch (error) {
    logger.error('Failed to create Discord activity:', error);
    throw error;
  }
}

export function getActivityInfo(activityName: ActivityName): { name: string; description: string } {
  const activities: Record<ActivityName, { name: string; description: string }> = {
    POKER_NIGHT: { name: 'Poker Night', description: 'Play poker with friends!' },
    BETRAYAL_IO: { name: 'Betrayal.io', description: 'Find the betrayer among your crewmates!' },
    FISHING: { name: 'Fishington.io', description: 'Catch fish and compete with friends!' },
    CHESS_IN_THE_PARK: { name: 'Chess', description: 'Play chess in a relaxing park setting!' },
    CHECKERS_IN_THE_PARK: { name: 'Checkers', description: 'Classic checkers game!' },
    LETTER_LEAGUE: { name: 'Letter League', description: 'Spell words and compete!' },
    WORD_SNACKS: { name: 'Word Snacks', description: 'Find words in a grid!' },
    SKETCH_HEADS: { name: 'Sketch Heads', description: 'Draw and guess with friends!' },
    SPELL_CAST: { name: 'SpellCast', description: 'Cast spells by forming words!' },
    PUTT_PARTY: { name: 'Putt Party', description: 'Mini golf with friends!' },
    LAND_IO: { name: 'Land-io', description: 'Claim territory and dominate!' },
    BOBBLE_LEAGUE: { name: 'Bobble League', description: 'Soccer with a twist!' },
    ASK_AWAY: { name: 'Ask Away', description: 'Answer questions about your friends!' },
    KNOW_WHAT_I_MEME: { name: 'Know What I Meme', description: 'Create and judge memes!' },
    BASH_OUT: { name: 'Bash Out', description: 'Action-packed brawler!' },
    GARTIC_PHONE: { name: 'Gartic Phone', description: 'Telephone game with drawings!' },
    WATCH_TOGETHER: { name: 'Watch Together', description: 'Watch videos together!' },
    YOUTUBE_TOGETHER: { name: 'YouTube Together', description: 'Watch YouTube videos together!' },
    WHITEBOARD: { name: 'Whiteboard', description: 'Collaborate on a shared whiteboard!' },
    BLAZING_8S: { name: 'Blazing 8s', description: 'Fast-paced card game!' },
  };

  return activities[activityName];
}