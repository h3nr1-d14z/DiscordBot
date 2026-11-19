import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ComponentType,
  User
} from 'discord.js';
import { BotCommand, CommandCategory, GameType } from '../../types';
import { database } from '../../services/database';

const choices = ['rock', 'paper', 'scissors'] as const;
type Choice = typeof choices[number];

const emojis: Record<Choice, string> = {
  rock: '🪨',
  paper: '📄',
  scissors: '✂️'
};

const winConditions: Record<Choice, Choice> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper'
};

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play Rock Paper Scissors!')
    .addUserOption(option =>
      option
        .setName('opponent')
        .setDescription('Challenge another user (leave empty to play against bot)')
        .setRequired(false)
    ),

  category: CommandCategory.Games,
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const opponent = interaction.options.getUser('opponent');
    const isVsBot = !opponent || opponent.id === interaction.client.user?.id;
    
    if (opponent && opponent.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ You cannot play against yourself!',
        ephemeral: true
      });
      return;
    }
    
    if (opponent && opponent.bot && opponent.id !== interaction.client.user?.id) {
      await interaction.reply({
        content: '❌ You can only play against me or other users!',
        ephemeral: true
      });
      return;
    }
    
    const gameData = {
      player1: { id: interaction.user.id, choice: null as Choice | null },
      player2: { id: isVsBot ? 'bot' : opponent!.id, choice: null as Choice | null }
    };
    
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🎮 Rock Paper Scissors')
      .setDescription(
        isVsBot 
          ? 'Choose your move!' 
          : `${interaction.user} vs ${opponent}\nBoth players need to choose!`
      )
      .setFooter({
        text: 'No bet',
        iconURL: interaction.user.displayAvatarURL()
      });

    const row = new ActionRowBuilder<ButtonBuilder>();
    choices.forEach(choice => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`rps_${choice}`)
          .setLabel(choice.charAt(0).toUpperCase() + choice.slice(1))
          .setEmoji(emojis[choice])
          .setStyle(ButtonStyle.Primary)
      );
    });
    
    const response = await interaction.reply({
      content: isVsBot ? undefined : `${opponent}, you have been challenged!`,
      embeds: [embed],
      components: [row],
      fetchReply: true
    });
    
    if (isVsBot) {
      // Bot makes its choice immediately
      gameData.player2.choice = choices[Math.floor(Math.random() * choices.length)];
    }
    
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 30000 // 30 seconds
    });
    
    collector.on('collect', async (i: ButtonInteraction) => {
      const playerId = i.user.id;
      
      // Check if this player is in the game
      if (playerId !== gameData.player1.id && playerId !== gameData.player2.id) {
        await i.reply({
          content: '❌ This game is not for you!',
          ephemeral: true
        });
        return;
      }
      
      const choice = i.customId.split('_')[1] as Choice;
      
      // Record player's choice
      if (playerId === gameData.player1.id) {
        if (gameData.player1.choice) {
          await i.reply({
            content: '❌ You already made your choice!',
            ephemeral: true
          });
          return;
        }
        gameData.player1.choice = choice;
        await i.reply({
          content: `You chose ${emojis[choice]} ${choice}!`,
          ephemeral: true
        });
      } else {
        if (gameData.player2.choice) {
          await i.reply({
            content: '❌ You already made your choice!',
            ephemeral: true
          });
          return;
        }
        gameData.player2.choice = choice;
        await i.reply({
          content: `You chose ${emojis[choice]} ${choice}!`,
          ephemeral: true
        });
      }
      
      // Check if both players have chosen
      if (gameData.player1.choice && gameData.player2.choice) {
        await handleGameEnd(interaction, response, gameData, isVsBot, opponent);
        collector.stop();
      } else {
        // Update embed to show waiting status
        const waitingEmbed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setTitle('🎮 Rock Paper Scissors')
          .setDescription('Waiting for the other player...')
          .addFields(
            { 
              name: interaction.user.username, 
              value: gameData.player1.choice ? '✅ Ready' : '⏳ Choosing...',
              inline: true
            },
            { 
              name: isVsBot ? 'Bot' : opponent!.username, 
              value: gameData.player2.choice ? '✅ Ready' : '⏳ Choosing...',
              inline: true
            }
          )
          .setFooter({
            text: 'No bet',
            iconURL: interaction.user.displayAvatarURL()
          });
        
        await response.edit({ embeds: [waitingEmbed] });
      }
    });
    
    collector.on('end', async () => {
      if (!gameData.player1.choice || !gameData.player2.choice) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('⏰ Game Timeout!')
          .setDescription('One or both players failed to make a choice in time.')
          .setFooter({ 
            text: 'Game cancelled',
            iconURL: interaction.user.displayAvatarURL()
          });
        
        await response.edit({ 
          embeds: [timeoutEmbed], 
          components: [] 
        }).catch(() => {});
      }
    });
  },
};

async function handleGameEnd(
  interaction: ChatInputCommandInteraction,
  response: any,
  gameData: any,
  isVsBot: boolean,
  opponent: User | null
) {
  const p1Choice = gameData.player1.choice! as Choice;
  const p2Choice = gameData.player2.choice! as Choice;
  
  let result: 'win' | 'lose' | 'draw';
  let winnerId: string | null = null;
  let loserId: string | null = null;
  
  if (p1Choice === p2Choice) {
    result = 'draw';
  } else if (winConditions[p1Choice] === p2Choice) {
    result = 'win';
    winnerId = gameData.player1.id;
    loserId = gameData.player2.id === 'bot' ? null : gameData.player2.id;
  } else {
    result = 'lose';
    winnerId = gameData.player2.id === 'bot' ? null : gameData.player2.id;
    loserId = gameData.player1.id;
  }
  
  // Update game stats
  for (const playerId of [gameData.player1.id, gameData.player2.id].filter(id => id !== 'bot')) {
    const user = await database.getUser(playerId);
    if (!user) {
      await database.createUser(playerId, playerId === gameData.player1.id ? interaction.user.username : opponent!.username);
    }
    
    const statsUpdate: any = {};
    if (playerId === winnerId) {
      statsUpdate.wins = 1;
      await database.updateUser(playerId, { xp: (user?.xp || 0) + 15 });
    } else if (playerId === loserId) {
      statsUpdate.losses = 1;
      await database.updateUser(playerId, { xp: (user?.xp || 0) + 5 });
    } else if (result === 'draw') {
      statsUpdate.draws = 1;
      await database.updateUser(playerId, { xp: (user?.xp || 0) + 10 });
    }
    
    await database.updateGameStats(playerId, GameType.RockPaperScissors, statsUpdate);
  }
  
  // Create result embed
  const resultEmbed = new EmbedBuilder()
    .setColor(result === 'win' ? 0x00FF00 : result === 'lose' ? 0xFF0000 : 0xFFFF00)
    .setTitle(
      result === 'win' ? '🎉 You Win!' : 
      result === 'lose' ? '😢 You Lose!' : 
      '🤝 It\'s a Draw!'
    )
    .addFields(
      { 
        name: interaction.user.username, 
        value: `${emojis[p1Choice]} ${p1Choice}`,
        inline: true
      },
      { 
        name: 'VS',
        value: '⚔️',
        inline: true
      },
      { 
        name: isVsBot ? 'Bot' : opponent!.username, 
        value: `${emojis[p2Choice]} ${p2Choice}`,
        inline: true
      }
    );
  
  resultEmbed.addFields({
    name: 'XP Earned',
    value: result === 'win' ? '⭐ 15 XP' : result === 'lose' ? '⭐ 5 XP' : '⭐ 10 XP',
    inline: false
  });
  
  resultEmbed.setFooter({
    text: 'Thanks for playing!',
    iconURL: interaction.user.displayAvatarURL()
  });
  
  await response.edit({
    embeds: [resultEmbed],
    components: []
  });
}

export default command;