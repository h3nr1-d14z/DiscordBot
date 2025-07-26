import {
  VoiceConnection,
  AudioPlayer,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus,
  AudioPlayerStatus,
  AudioResource,
} from '@discordjs/voice';
import ytdl from '@distube/ytdl-core';
import { Guild, VoiceBasedChannel, TextBasedChannel } from 'discord.js';
import { logger } from '../utils/logger';
import { searchYouTube } from '../utils/youtubeSearchFixed';
import { searchYoutubeHttp } from '../utils/youtubeSearchHttp';

export interface Track {
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
  requestedBy?: string;
}

export interface MusicQueue {
  textChannel: TextBasedChannel;
  voiceChannel: VoiceBasedChannel;
  connection: VoiceConnection | null;
  player: AudioPlayer;
  tracks: Track[];
  volume: number;
  playing: boolean;
  loop: boolean;
  loopQueue: boolean;
}

export class MusicService {
  private queues: Map<string, MusicQueue>;
  private initialized: boolean = false;

  constructor() {
    this.queues = new Map();
    this.initialize();
  }

  private async initialize() {
    try {
      this.initialized = true;
      logger.info('Music service initialized with @distube/ytdl-core');
    } catch (error) {
      logger.error('Failed to initialize music service:', error);
    }
  }

  async join(voiceChannel: VoiceBasedChannel, _textChannel: TextBasedChannel): Promise<VoiceConnection> {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      return connection;
    } catch (error) {
      connection.destroy();
      throw error;
    }
  }

  getQueue(guildId: string): MusicQueue | undefined {
    return this.queues.get(guildId);
  }

  private createQueue(guild: Guild, voiceChannel: VoiceBasedChannel, textChannel: TextBasedChannel): MusicQueue {
    const player = createAudioPlayer();
    
    const queue: MusicQueue = {
      textChannel,
      voiceChannel,
      connection: null,
      player,
      tracks: [],
      volume: 100,
      playing: false,
      loop: false,
      loopQueue: false,
    };

    player.on(AudioPlayerStatus.Playing, () => {
      queue.playing = true;
      logger.info(`Music started playing in guild ${guild.id}`);
    });

    player.on(AudioPlayerStatus.Idle, () => {
      queue.playing = false;
      
      if (queue.loop && queue.tracks.length > 0) {
        this.play(guild.id);
      } else if (queue.loopQueue && queue.tracks.length > 0) {
        const track = queue.tracks.shift();
        if (track) queue.tracks.push(track);
        this.play(guild.id);
      } else {
        queue.tracks.shift();
        if (queue.tracks.length > 0) {
          this.play(guild.id);
        } else {
          this.leave(guild.id);
        }
      }
    });

    player.on('error', error => {
      logger.error(`Music player error in guild ${guild.id}:`, error);
      queue.textChannel.send('❌ An error occurred while playing music!').catch(() => {});
      queue.tracks.shift();
      if (queue.tracks.length > 0) {
        this.play(guild.id);
      }
    });

    this.queues.set(guild.id, queue);
    return queue;
  }

  async addTrack(guild: Guild, track: Track, voiceChannel: VoiceBasedChannel, textChannel: TextBasedChannel) {
    let queue = this.getQueue(guild.id);
    
    if (!queue) {
      queue = this.createQueue(guild, voiceChannel, textChannel);
    }
    
    queue.tracks.push(track);
    
    if (!queue.connection) {
      try {
        queue.connection = await this.join(voiceChannel, textChannel);
        queue.connection.subscribe(queue.player);
      } catch (error) {
        logger.error('Failed to join voice channel:', error);
        this.queues.delete(guild.id);
        throw error;
      }
    }
    
    if (!queue.playing) {
      await this.play(guild.id);
    }
  }

  async play(guildId: string) {
    const queue = this.getQueue(guildId);
    if (!queue || queue.tracks.length === 0) return;
    
    const track = queue.tracks[0];
    
    try {
      const stream = ytdl(track.url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
      });
      
      const resource = createAudioResource(stream, {
        inlineVolume: true,
      });
      
      resource.volume?.setVolume(queue.volume / 100);
      
      queue.player.play(resource);
      queue.playing = true;
      
      queue.textChannel.send({
        embeds: [{
          color: 0x0099FF,
          title: '🎵 Now Playing',
          description: `[${track.title}](${track.url})`,
          fields: [
            { name: 'Duration', value: track.duration, inline: true },
            { name: 'Requested by', value: track.requestedBy ? `<@${track.requestedBy}>` : 'Unknown', inline: true },
          ],
          thumbnail: { url: track.thumbnail },
        }]
      }).catch(() => {});
    } catch (error) {
      logger.error('Failed to play track:', error);
      queue.tracks.shift();
      if (queue.tracks.length > 0) {
        await this.play(guildId);
      }
    }
  }

  async searchTrack(query: string): Promise<Track | null> {
    try {
      // Check if it's a YouTube URL
      if (ytdl.validateURL(query)) {
        const info = await ytdl.getInfo(query);
        return {
          title: info.videoDetails.title,
          url: info.videoDetails.video_url,
          duration: this.formatDuration(parseInt(info.videoDetails.lengthSeconds)),
          thumbnail: info.videoDetails.thumbnails[0]?.url || '',
        };
      }
      
      // Search YouTube
      try {
        return await searchYouTube(query);
      } catch (error) {
        logger.warn('Primary YouTube search failed, trying HTTP method:', error);
        return await searchYoutubeHttp(query);
      }
    } catch (error) {
      logger.error('Failed to search track:', error);
      return null;
    }
  }

  pause(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue || !queue.playing) return false;
    
    queue.player.pause();
    return true;
  }

  resume(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue || queue.playing) return false;
    
    queue.player.unpause();
    return true;
  }

  skip(guildId: string): Track | null {
    const queue = this.getQueue(guildId);
    if (!queue || queue.tracks.length === 0) return null;
    
    const skippedTrack = queue.tracks[0];
    queue.player.stop();
    return skippedTrack;
  }

  stop(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;
    
    queue.tracks = [];
    queue.player.stop();
    return true;
  }

  leave(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;
    
    queue.tracks = [];
    queue.player.stop();
    
    if (queue.connection) {
      queue.connection.destroy();
    }
    
    this.queues.delete(guildId);
    return true;
  }

  setVolume(guildId: string, volume: number): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;
    
    queue.volume = Math.max(0, Math.min(100, volume));
    
    if (queue.player.state.status === AudioPlayerStatus.Playing) {
      const resource = queue.player.state.resource as AudioResource<any>;
      resource.volume?.setVolume(queue.volume / 100);
    }
    
    return true;
  }

  shuffle(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue || queue.tracks.length <= 1) return false;
    
    // Keep the current track at index 0
    const currentTrack = queue.tracks.shift()!;
    
    // Shuffle the rest
    for (let i = queue.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
    }
    
    // Put the current track back
    queue.tracks.unshift(currentTrack);
    
    return true;
  }

  setLoop(guildId: string, mode: 'off' | 'track' | 'queue'): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;
    
    queue.loop = mode === 'track';
    queue.loopQueue = mode === 'queue';
    
    return true;
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

export const musicService = new MusicService();