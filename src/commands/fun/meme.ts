import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { BotCommand, CommandCategory } from '../../types';
import { logger } from '../../utils/logger';
import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';
import axios from 'axios';

// Popular meme templates
const MEME_TEMPLATES = {
  drake: {
    name: 'Drake',
    url: 'https://i.imgflip.com/30b1gx.jpg',
    textAreas: [
      { x: 350, y: 100, maxWidth: 300, align: 'left' },
      { x: 350, y: 325, maxWidth: 300, align: 'left' }
    ]
  },
  distracted: {
    name: 'Distracted Boyfriend',
    url: 'https://i.imgflip.com/1ur9b0.jpg',
    textAreas: [
      { x: 300, y: 320, maxWidth: 200, align: 'center' },
      { x: 750, y: 150, maxWidth: 200, align: 'center' },
      { x: 950, y: 250, maxWidth: 200, align: 'center' }
    ]
  },
  brain: {
    name: 'Expanding Brain',
    url: 'https://i.imgflip.com/1jwhww.jpg',
    textAreas: [
      { x: 10, y: 50, maxWidth: 380, align: 'left' },
      { x: 10, y: 280, maxWidth: 380, align: 'left' },
      { x: 10, y: 510, maxWidth: 380, align: 'left' },
      { x: 10, y: 740, maxWidth: 380, align: 'left' }
    ]
  },
  button: {
    name: 'Nut Button',
    url: 'https://i.imgflip.com/1yxkcp.jpg',
    textAreas: [
      { x: 180, y: 350, maxWidth: 250, align: 'center' },
      { x: 350, y: 50, maxWidth: 200, align: 'center' }
    ]
  },
  twobuttons: {
    name: 'Two Buttons',
    url: 'https://i.imgflip.com/1g8my4.jpg',
    textAreas: [
      { x: 100, y: 100, maxWidth: 150, align: 'center' },
      { x: 300, y: 100, maxWidth: 150, align: 'center' },
      { x: 250, y: 400, maxWidth: 300, align: 'center' }
    ]
  },
  exit12: {
    name: 'Left Exit 12',
    url: 'https://i.imgflip.com/22bdq6.jpg',
    textAreas: [
      { x: 180, y: 100, maxWidth: 250, align: 'center' },
      { x: 460, y: 100, maxWidth: 250, align: 'center' },
      { x: 680, y: 350, maxWidth: 200, align: 'center' }
    ]
  },
  waitingskeleton: {
    name: 'Waiting Skeleton',
    url: 'https://i.imgflip.com/2fm6x.jpg',
    textAreas: [
      { x: 150, y: 230, maxWidth: 200, align: 'center' },
      { x: 300, y: 50, maxWidth: 300, align: 'center' }
    ]
  },
  disaster: {
    name: 'Disaster Girl',
    url: 'https://i.imgflip.com/23ls.jpg',
    textAreas: [
      { x: 250, y: 50, maxWidth: 350, align: 'center' },
      { x: 250, y: 400, maxWidth: 350, align: 'center' }
    ]
  }
};

interface MemeTextArea {
  x: number;
  y: number;
  maxWidth: number;
  align: 'left' | 'center' | 'right';
}

class MemeGenerator {
  private vietnamesePatterns = [
    /[àáạảãâầấậẩẫăằắặẳẵ]/gi,
    /[èéẹẻẽêềếệểễ]/gi,
    /[ìíịỉĩ]/gi,
    /[òóọỏõôồốộổỗơờớợởỡ]/gi,
    /[ùúụủũưừứựửữ]/gi,
    /[ỳýỵỷỹ]/gi,
    /[đ]/gi
  ];

  isVietnamese(text: string): boolean {
    return this.vietnamesePatterns.some(pattern => pattern.test(text));
  }

  async generateMeme(templateKey: string, texts: string[]): Promise<Buffer> {
    const template = MEME_TEMPLATES[templateKey as keyof typeof MEME_TEMPLATES];
    if (!template) throw new Error('Invalid template');

    try {
      // Load template image
      const response = await axios.get(template.url, { responseType: 'arraybuffer' });
      const templateImage = await loadImage(Buffer.from(response.data));

      // Create canvas
      const canvas = createCanvas(templateImage.width, templateImage.height);
      const ctx = canvas.getContext('2d');

      // Draw template
      ctx.drawImage(templateImage, 0, 0);

      // Setup text style
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 5;
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Add texts
      texts.forEach((text, index) => {
        if (index >= template.textAreas.length) return;
        
        const area = template.textAreas[index];
        this.drawText(ctx, text, area);
      });

      return canvas.toBuffer();
    } catch (error) {
      logger.error('Error generating meme:', error);
      throw error;
    }
  }

  private drawText(ctx: any, text: string, area: MemeTextArea): void {
    // Determine font based on text content
    const isViet = this.isVietnamese(text);
    let fontSize = 40;
    
    // Set font - using default system fonts that support Vietnamese
    ctx.font = `bold ${fontSize}px ${isViet ? 'Arial, sans-serif' : 'Impact, Arial'}`;
    
    // Text wrapping and sizing
    const words = text.toUpperCase().split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > area.maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Adjust font size if needed
    while (fontSize > 20 && lines.length * fontSize > 150) {
      fontSize -= 5;
      ctx.font = `bold ${fontSize}px ${isViet ? 'Arial, sans-serif' : 'Impact, Arial'}`;
    }

    // Draw text with outline
    const lineHeight = fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;
    const startY = area.y - totalHeight / 2;

    lines.forEach((line, index) => {
      const y = startY + (index + 0.5) * lineHeight;
      let x = area.x;
      
      if (area.align === 'center') {
        x = area.x;
        ctx.textAlign = 'center';
      } else if (area.align === 'right') {
        x = area.x + area.maxWidth;
        ctx.textAlign = 'right';
      } else {
        ctx.textAlign = 'left';
      }
      
      // Draw outline
      ctx.strokeText(line, x, y);
      // Draw fill
      ctx.fillText(line, x, y);
    });
  }

  async generateCustomMeme(imageUrl: string, topText: string, bottomText: string): Promise<Buffer> {
    try {
      // Load custom image
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const image = await loadImage(Buffer.from(response.data));

      // Create canvas
      const canvas = createCanvas(image.width, image.height);
      const ctx = canvas.getContext('2d');

      // Draw image
      ctx.drawImage(image, 0, 0);

      // Setup text style
      ctx.strokeStyle = 'black';
      ctx.lineWidth = Math.max(3, image.width / 200);
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Calculate font size based on image dimensions
      const fontSize = Math.max(20, Math.min(60, image.width / 10));
      const isTopViet = this.isVietnamese(topText);
      const isBottomViet = this.isVietnamese(bottomText);

      // Draw top text
      if (topText) {
        ctx.font = `bold ${fontSize}px ${isTopViet ? 'Arial, sans-serif' : 'Impact, Arial'}`;
        const area: MemeTextArea = {
          x: image.width / 2,
          y: fontSize * 1.5,
          maxWidth: image.width * 0.9,
          align: 'center'
        };
        this.drawText(ctx, topText, area);
      }

      // Draw bottom text
      if (bottomText) {
        ctx.font = `bold ${fontSize}px ${isBottomViet ? 'Arial, sans-serif' : 'Impact, Arial'}`;
        const area: MemeTextArea = {
          x: image.width / 2,
          y: image.height - fontSize * 1.5,
          maxWidth: image.width * 0.9,
          align: 'center'
        };
        this.drawText(ctx, bottomText, area);
      }

      return canvas.toBuffer();
    } catch (error) {
      logger.error('Error generating custom meme:', error);
      throw error;
    }
  }
}

const command: BotCommand = {
  category: CommandCategory.Fun,
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Generate a meme with custom text (supports Vietnamese!)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('template')
        .setDescription('Create a meme using popular templates')
        .addStringOption(option =>
          option.setName('template')
            .setDescription('Choose a meme template')
            .setRequired(true)
            .addChoices(
              { name: 'Drake', value: 'drake' },
              { name: 'Distracted Boyfriend', value: 'distracted' },
              { name: 'Expanding Brain', value: 'brain' },
              { name: 'Nut Button', value: 'button' },
              { name: 'Two Buttons', value: 'twobuttons' },
              { name: 'Left Exit 12', value: 'exit12' },
              { name: 'Waiting Skeleton', value: 'waitingskeleton' },
              { name: 'Disaster Girl', value: 'disaster' }
            ))
        .addStringOption(option =>
          option.setName('text1')
            .setDescription('First text (supports Vietnamese)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('text2')
            .setDescription('Second text (supports Vietnamese)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('text3')
            .setDescription('Third text (for multi-panel memes)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('text4')
            .setDescription('Fourth text (for brain meme)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('custom')
        .setDescription('Create a meme with your own image')
        .addStringOption(option =>
          option.setName('image')
            .setDescription('Image URL')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('top')
            .setDescription('Top text (supports Vietnamese)')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('bottom')
            .setDescription('Bottom text (supports Vietnamese)')
            .setRequired(false))),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    
    const generator = new MemeGenerator();
    
    try {
      let buffer: Buffer;
      let filename: string;
      
      if (interaction.options.getSubcommand() === 'template') {
        const template = interaction.options.getString('template', true);
        const texts = [
          interaction.options.getString('text1', true),
          interaction.options.getString('text2') || '',
          interaction.options.getString('text3') || '',
          interaction.options.getString('text4') || ''
        ].filter(text => text.length > 0);
        
        buffer = await generator.generateMeme(template, texts);
        filename = `${template}-meme.png`;
      } else {
        const imageUrl = interaction.options.getString('image', true);
        const topText = interaction.options.getString('top') || '';
        const bottomText = interaction.options.getString('bottom') || '';
        
        if (!topText && !bottomText) {
          await interaction.editReply({
            content: '❌ Please provide at least one text (top or bottom)!'
          });
          return;
        }
        
        buffer = await generator.generateCustomMeme(imageUrl, topText, bottomText);
        filename = 'custom-meme.png';
      }
      
      const attachment = new AttachmentBuilder(buffer, { name: filename });
      
      const embed = new EmbedBuilder()
        .setTitle('🎨 Your Meme is Ready!')
        .setImage(`attachment://${filename}`)
        .setColor(0x00FF00)
        .setFooter({ text: `Created by ${interaction.user.username}` })
        .setTimestamp();
      
      await interaction.editReply({
        embeds: [embed],
        files: [attachment]
      });
      
    } catch (error) {
      logger.error('Error in meme command:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error Creating Meme')
        .setDescription('Failed to generate your meme. Please check the image URL or try again.')
        .setColor(0xFF0000)
        .setTimestamp();
      
      await interaction.editReply({
        embeds: [errorEmbed]
      });
    }
  },
};

export default command;