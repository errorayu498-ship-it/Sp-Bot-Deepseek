const { PremiumEmbed } = require('../utils/embedBuilder');
const User = require('../models/User');
const Guild = require('../models/Guild');
const { logger } = require('../utils/logger');

const cooldowns = new Map();
const XP_PER_MESSAGE = 5;
const XP_COOLDOWN = 60000; // 1 minute

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // Handle prefix commands
        const guildData = await Guild.findOne({ guildId: message.guild.id });
        const prefix = guildData?.settings?.prefix || '!';

        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            const command = client.prefixCommands.get(commandName);
            
            if (command) {
                try {
                    await command.prefixExecute(message, args, client);
                } catch (error) {
                    logger.error(`Error executing prefix command ${commandName}:`, error);
                    
                    const errorEmbed = new PremiumEmbed()
                        .setError()
                        .setTitle('Command Error')
                        .setDescription('An error occurred while executing this command.');
                    
                    await message.reply({ embeds: [errorEmbed] });
                }
            }
        }

        // XP System
        if (guildData?.settings?.xpEnabled) {
            const xpChannel = guildData.settings.xpChannel;
            
            if (xpChannel && message.channel.id !== xpChannel) return;
            
            const cooldownKey = `${message.guild.id}-${message.author.id}`;
            const now = Date.now();
            
            if (cooldowns.has(cooldownKey)) {
                const cooldownTime = cooldowns.get(cooldownKey);
                if (now < cooldownTime) return;
            }
            
            cooldowns.set(cooldownKey, now + XP_COOLDOWN);
            
            try {
                let userData = await User.findOne({ 
                    userId: message.author.id, 
                    guildId: message.guild.id 
                });
                
                if (!userData) {
                    userData = new User({
                        userId: message.author.id,
                        guildId: message.guild.id
                    });
                }
                
                const oldLevel = userData.level;
                
                userData.xp += XP_PER_MESSAGE;
                userData.totalXp += XP_PER_MESSAGE;
                userData.messages += 1;
                userData.lastMessage = new Date();
                
                // Level up calculation
                const newLevel = Math.floor(0.1 * Math.sqrt(userData.totalXp));
                
                if (newLevel > oldLevel) {
                    userData.level = newLevel;
                    
                    const levelUpEmbed = new PremiumEmbed()
                        .setSuccess()
                        .setTitle('🎉 Level Up!')
                        .setDescription(`Congratulations ${message.author}!`)
                        .addField('New Level', `${newLevel}`, true)
                        .addField('Total XP', `${userData.totalXp}`, true)
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));
                    
                    await message.channel.send({ 
                        content: `${message.author}`,
                        embeds: [levelUpEmbed] 
                    });
                }
                
                await userData.save();
                
                // Update guild stats
                guildData.stats.totalXpGiven += XP_PER_MESSAGE;
                await guildData.save();
                
            } catch (error) {
                logger.error('XP System Error:', error);
            }
        }
    }
};
