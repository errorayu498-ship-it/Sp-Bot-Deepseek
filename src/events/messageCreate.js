const { PremiumEmbed } = require('../utils/embedBuilder');
const User = require('../models/User');
const Guild = require('../models/Guild');
const { logger } = require('../utils/logger');
const { EmbedBuilder } = require('discord.js');

const cooldowns = new Map();
const XP_PER_MESSAGE = 5;
const XP_COOLDOWN = 60000; // 1 minute
const prefixCache = new Map();

async function getGuildPrefix(guildId) {
    if (prefixCache.has(guildId)) {
        return prefixCache.get(guildId);
    }
    
    const guildData = await Guild.findOne({ guildId });
    const prefix = guildData?.settings?.prefix || '!';
    
    prefixCache.set(guildId, prefix);
    setTimeout(() => prefixCache.delete(guildId), 300000);
    
    return prefix;
}

async function sendLog(guild, channelId, embed) {
    if (!channelId) return;
    
    try {
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (channel) {
            await channel.send({ embeds: [embed] }).catch(() => {});
        }
    } catch (error) {
        logger.error('Failed to send log:', error);
    }
}

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // Get or create guild data
        let guildData = await Guild.findOne({ guildId: message.guild.id });
        if (!guildData) {
            guildData = new Guild({ 
                guildId: message.guild.id, 
                name: message.guild.name,
                settings: { prefix: '!' }
            });
            await guildData.save();
        }
        
        const prefix = guildData.settings.prefix || '!';

        // Handle prefix commands - Fixed!
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            logger.info(`Prefix command used: ${commandName} by ${message.author.tag}`);
            
            // XP Commands
            if (commandName === 'xp') {
                await handleXpCommand(message, args, client, guildData);
                return;
            }
            
            if (commandName === 'checkxp') {
                await handleCheckXpCommand(message, args, client, guildData);
                return;
            }
            
            if (commandName === 'leaderboard' || commandName === 'lb') {
                await handleLeaderboardCommand(message, args, client, guildData);
                return;
            }
            
            // Invite Commands
            if (commandName === 'invite' || commandName === 'invites') {
                await handleInviteCommand(message, args, client, guildData);
                return;
            }
            
            if (commandName === 'checkinvite') {
                await handleCheckInviteCommand(message, args, client, guildData);
                return;
            }
            
            if (commandName === 'inviteleaderboard' || commandName === 'ilb') {
                await handleInviteLeaderboardCommand(message, args, client, guildData);
                return;
            }
            
            // Help Command
            if (commandName === 'help') {
                await handleHelpCommand(message, prefix, guildData);
                return;
            }
        }

        // XP System - Only in specific channel if set
        if (guildData.settings.xpEnabled) {
            const xpChannelId = guildData.settings.xpChannel;
            
            // If XP channel is set, only give XP in that specific channel
            if (xpChannelId) {
                if (message.channel.id !== xpChannelId) {
                    return; // Not the XP channel, no XP given
                }
            }
            
            // Check cooldown
            const cooldownKey = `${message.guild.id}-${message.author.id}`;
            const now = Date.now();
            
            if (cooldowns.has(cooldownKey)) {
                const cooldownTime = cooldowns.get(cooldownKey);
                if (now < cooldownTime) return;
            }
            
            cooldowns.set(cooldownKey, now + (guildData.settings.xpCooldown * 1000 || XP_COOLDOWN));
            
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
                const xpAmount = guildData.settings.xpPerMessage || XP_PER_MESSAGE;
                
                userData.xp += xpAmount;
                userData.totalXp += xpAmount;
                userData.messages += 1;
                userData.lastMessage = new Date();
                
                const newLevel = Math.floor(0.1 * Math.sqrt(userData.totalXp));
                
                if (newLevel > oldLevel) {
                    userData.level = newLevel;
                    
                    const levelUpEmbed = new PremiumEmbed()
                        .setSuccess()
                        .setTitle('🎉 Level Up!')
                        .setDescription(`Congratulations ${message.author}! You've reached level **${newLevel}**!`)
                        .addField('📊 New Level', `${newLevel}`, true)
                        .addField('✨ Total XP', `${userData.totalXp.toLocaleString()}`, true)
                        .addField('📈 Messages', `${userData.messages.toLocaleString()}`, true)
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                        .setFooter({ text: `Leveled up in #${message.channel.name}` });
                    
                    // Send level up message
                    const levelUpChannel = guildData.settings.levelUpChannel || message.channel.id;
                    const targetChannel = message.guild.channels.cache.get(levelUpChannel) || message.channel;
                    
                    await targetChannel.send({ 
                        content: `${message.author}`,
                        embeds: [levelUpEmbed] 
                    }).catch(() => {});
                    
                    // Log level up
                    if (guildData.settings.logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('📈 Level Up Log')
                            .setDescription(`${message.author.tag} leveled up!`)
                            .addFields(
                                { name: 'User', value: `${message.author}`, inline: true },
                                { name: 'New Level', value: `${newLevel}`, inline: true },
                                { name: 'Total XP', value: `${userData.totalXp}`, inline: true },
                                { name: 'Channel', value: `${message.channel}`, inline: true }
                            )
                            .setTimestamp();
                        
                        await sendLog(message.guild, guildData.settings.logChannel, logEmbed);
                    }
                }
                
                await userData.save();
                
                guildData.stats.totalXpGiven += xpAmount;
                await guildData.save();
                
            } catch (error) {
                logger.error('XP System Error:', error);
            }
        }
    }
};

// Command Handlers
async function handleXpCommand(message, args, client, guildData) {
    try {
        const target = message.mentions.users.first() || message.author;
        
        const userData = await User.findOne({ 
            userId: target.id, 
            guildId: message.guild.id 
        });
        
        if (!userData) {
            const embed = new PremiumEmbed()
                .setInfo()
                .setTitle('📊 XP Status')
                .setDescription(`${target} hasn't earned any XP yet!`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }));
            
            return message.reply({ embeds: [embed] });
        }
        
        const xpNeeded = Math.pow((userData.level + 1) / 0.1, 2) - userData.totalXp;
        const currentLevelXp = Math.pow(userData.level / 0.1, 2);
        const nextLevelXp = Math.pow((userData.level + 1) / 0.1, 2);
        const progress = ((userData.totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
        
        const barLength = 20;
        const filledLength = Math.floor((progress / 100) * barLength);
        const progressBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        
        const embed = new PremiumEmbed()
            .setTitle(`📊 XP Card - ${target.username}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addField('📈 Level', `${userData.level}`, true)
            .addField('✨ Current XP', `${userData.xp.toLocaleString()}`, true)
            .addField('💫 Total XP', `${userData.totalXp.toLocaleString()}`, true)
            .addField('💬 Messages', `${userData.messages.toLocaleString()}`, true)
            .addField('📊 Progress', `${progressBar} ${progress.toFixed(1)}%`, false)
            .addField('⬆️ XP to Next Level', `${Math.floor(xpNeeded).toLocaleString()}`, true)
            .setFooter({ text: `Requested by ${message.author.username}` });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        logger.error('XP Command Error:', error);
        const errorEmbed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Error')
            .setDescription('An error occurred while fetching XP data.');
        await message.reply({ embeds: [errorEmbed] });
    }
}

async function handleCheckXpCommand(message, args, client, guildData) {
    const target = message.mentions.users.first();
    
    if (!target) {
        const embed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Invalid Usage')
            .setDescription(`Please mention a user!\nExample: \`${guildData.settings.prefix}checkxp @user\``);
        
        return message.reply({ embeds: [embed] });
    }
    
    await handleXpCommand(message, [target.id], client, guildData);
}

async function handleLeaderboardCommand(message, args, client, guildData) {
    try {
        const users = await User.find({ guildId: message.guild.id })
            .sort({ totalXp: -1 })
            .limit(20);
        
        if (users.length === 0) {
            const embed = new PremiumEmbed()
                .setInfo()
                .setTitle('📊 XP Leaderboard')
                .setDescription('No XP data available yet! Start chatting to earn XP!');
            
            return message.reply({ embeds: [embed] });
        }
        
        const embed = new PremiumEmbed()
            .setTitle('🏆 XP Leaderboard - Top 20')
            .setDescription('The most active members of the server!')
            .setThumbnail(message.guild.iconURL({ dynamic: true }));
        
        let leaderboardText = '';
        let userRank = null;
        
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const member = await message.guild.members.fetch(user.userId).catch(() => null);
            const username = member?.user.username || 'Unknown User';
            
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            
            leaderboardText += `${medal} **${username}**\n`;
            leaderboardText += `   └ Level ${user.level} • ${user.totalXp.toLocaleString()} XP\n\n`;
            
            if (user.userId === message.author.id) {
                userRank = i + 1;
            }
        }
        
        embed.setDescription(leaderboardText);
        
        if (userRank) {
            embed.addField('📍 Your Rank', `#${userRank} out of ${users.length} members`, true);
        } else {
            const allUsers = await User.find({ guildId: message.guild.id }).sort({ totalXp: -1 });
            const rank = allUsers.findIndex(u => u.userId === message.author.id) + 1;
            if (rank > 0) {
                embed.addField('📍 Your Rank', `#${rank} out of ${allUsers.length} members`, true);
            } else {
                embed.addField('📍 Your Rank', 'Not ranked yet', true);
            }
        }
        
        embed.setFooter({ text: `Requested by ${message.author.username}` });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        logger.error('Leaderboard Command Error:', error);
        const errorEmbed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Error')
            .setDescription('An error occurred while fetching leaderboard.');
        await message.reply({ embeds: [errorEmbed] });
    }
}

async function handleInviteCommand(message, args, client, guildData) {
    try {
        const target = message.mentions.users.first() || message.author;
        
        const userData = await User.findOne({ 
            userId: target.id, 
            guildId: message.guild.id 
        });
        
        const invites = userData?.invites || { total: 0, regular: 0, leaves: 0, fake: 0, bonus: 0 };
        
        const embed = new PremiumEmbed()
            .setTitle(`📨 Invite Info - ${target.username}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addField('📊 Total Invites', `${invites.total}`, true)
            .addField('✅ Regular', `${invites.regular}`, true)
            .addField('🎁 Bonus', `${invites.bonus}`, true)
            .addField('❌ Leaves', `${invites.leaves}`, true)
            .addField('🚫 Fake', `${invites.fake}`, true)
            .setFooter({ text: `Requested by ${message.author.username}` });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        logger.error('Invite Command Error:', error);
        const errorEmbed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Error')
            .setDescription('An error occurred while fetching invite data.');
        await message.reply({ embeds: [errorEmbed] });
    }
}

async function handleCheckInviteCommand(message, args, client, guildData) {
    const target = message.mentions.users.first();
    
    if (!target) {
        const embed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Invalid Usage')
            .setDescription(`Please mention a user!\nExample: \`${guildData.settings.prefix}checkinvite @user\``);
        
        return message.reply({ embeds: [embed] });
    }
    
    await handleInviteCommand(message, [target.id], client, guildData);
}

async function handleInviteLeaderboardCommand(message, args, client, guildData) {
    try {
        const users = await User.find({ guildId: message.guild.id })
            .sort({ 'invites.total': -1 })
            .limit(20);
        
        if (users.length === 0) {
            const embed = new PremiumEmbed()
                .setInfo()
                .setTitle('📨 Invite Leaderboard')
                .setDescription('No invite data available yet!');
            
            return message.reply({ embeds: [embed] });
        }
        
        const embed = new PremiumEmbed()
            .setTitle('👥 Invite Leaderboard - Top 20')
            .setDescription('Members with the most invites!')
            .setThumbnail(message.guild.iconURL({ dynamic: true }));
        
        let leaderboardText = '';
        let hasInvites = false;
        let userRank = null;
        
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            if (user.invites.total === 0) continue;
            
            hasInvites = true;
            const member = await message.guild.members.fetch(user.userId).catch(() => null);
            const username = member?.user.username || 'Unknown User';
            
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            
            leaderboardText += `${medal} **${username}**\n`;
            leaderboardText += `   └ ${user.invites.total} invites (${user.invites.regular} regular, ${user.invites.bonus} bonus)\n\n`;
            
            if (user.userId === message.author.id) {
                userRank = i + 1;
            }
        }
        
        if (!hasInvites) {
            leaderboardText = 'No invites yet! Start inviting people to appear here!';
        }
        
        embed.setDescription(leaderboardText);
        
        if (userRank) {
            embed.addField('📍 Your Rank', `#${userRank}`, true);
        }
        
        embed.setFooter({ text: `Requested by ${message.author.username}` });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        logger.error('Invite Leaderboard Error:', error);
        const errorEmbed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Error')
            .setDescription('An error occurred while fetching invite leaderboard.');
        await message.reply({ embeds: [errorEmbed] });
    }
}

async function handleHelpCommand(message, prefix, guildData) {
    const embed = new PremiumEmbed()
        .setTitle('📚 Bot Commands Help')
        .setDescription(`Here are all available public commands! Prefix: \`${prefix}\``)
        .addField('📊 XP Commands',
            `\`${prefix}xp\` - Check your XP and level\n` +
            `\`${prefix}checkxp @user\` - Check someone's XP\n` +
            `\`${prefix}leaderboard\` - View XP leaderboard\n` +
            `\`${prefix}lb\` - Alias for leaderboard`
        )
        .addField('📨 Invite Commands',
            `\`${prefix}invite\` - Check your invites\n` +
            `\`${prefix}invites\` - Alias for invite\n` +
            `\`${prefix}checkinvite @user\` - Check someone's invites\n` +
            `\`${prefix}inviteleaderboard\` - View invite leaderboard\n` +
            `\`${prefix}ilb\` - Alias for inviteleaderboard`
        )
        .addField('ℹ️ Other Commands',
            `\`${prefix}help\` - Show this help menu`
        )
        .addField('💡 Tips',
            '• Earn XP by chatting in the designated XP channel\n' +
            '• Level up to unlock special features\n' +
            '• Invite friends to climb the invite leaderboard'
        )
        .setFooter({ text: `Made with ❤️ • Current Prefix: ${prefix}` });
    
    await message.reply({ embeds: [embed] });
}
