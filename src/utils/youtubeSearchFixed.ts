import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';
import { Track } from '../services/musicService';

const execAsync = promisify(exec);

async function checkYtDlpAvailable(): Promise<boolean> {
  try {
    await execAsync('yt-dlp --version');
    return true;
  } catch {
    return false;
  }
}

export async function searchYouTubeYtDlp(query: string): Promise<Track | null> {
  try {
    const ytDlpAvailable = await checkYtDlpAvailable();
    if (!ytDlpAvailable) {
      logger.warn('yt-dlp is not installed. Install it for better YouTube support.');
      return null;
    }

    const { stdout } = await execAsync(`yt-dlp --dump-json --no-playlist --flat-playlist "ytsearch1:${query}"`);
    const info = JSON.parse(stdout);
    
    return {
      title: info.title || 'Unknown Title',
      duration: formatDuration(info.duration || 0),
      thumbnail: info.thumbnail || `https://img.youtube.com/vi/${info.id}/hqdefault.jpg`,
      url: info.url || `https://www.youtube.com/watch?v=${info.id}`
    };
  } catch (error) {
    logger.error('yt-dlp search failed:', error);
    return null;
  }
}

export async function searchYouTubeSimple(query: string): Promise<Track> {
  try {
    // Fallback method when yt-dlp is not available
    return {
      title: query,
      duration: 'Unknown',
      thumbnail: '',
      url: `ytsearch:${query}`
    };
  } catch (error) {
    logger.error('Simple search failed:', error);
    throw error;
  }
}

export async function searchYouTube(query: string): Promise<Track | null> {
  // Try yt-dlp first
  const ytDlpResult = await searchYouTubeYtDlp(query);
  if (ytDlpResult) return ytDlpResult;
  
  // Fallback to simple search
  return searchYouTubeSimple(query);
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return 'Unknown';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}