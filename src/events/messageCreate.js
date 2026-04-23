const { PremiumEmbed } = require('../utils/embedBuilder');
const User = require('../models/User');
const Guild = require('../models/Guild');
const { logger } = require('../utils/logger');
const { EmbedBuilder } = require('discord.js');

const cooldowns = new Map();
const messageCache = new Map();
const XP_COOLDOWN = 2000; // 2 seconds
const SPAM_WARN_THRESHOLD = 3;

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
                settings: { 
                    prefix: '!',
                    antiSpamEnabled: true,
                    xpEnabled: true,
                    xpPerMessage: 5
                }
            });
            await guildData.save();
        }
        
        const prefix = guildData.settings.prefix || '!';

        // Handle prefix commands
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
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
            
            return;
        }

        // XP System - SAB KO XP DENA HAI (Including Admin)
        if (guildData.settings.xpEnabled) {
            const xpChannelId = guildData.settings.xpChannel;
            
            // Agar XP channel set hai to sirf usi channel mein XP milega
            if (xpChannelId && message.channel.id !== xpChannelId) {
                return;
            }
            
            // Anti-spam check
            if (guildData.settings.antiSpamEnabled && xpChannelId && message.channel.id === xpChannelId) {
                const spamKey = `${message.guild.id}-${message.author.id}`;
                const userMessages = messageCache.get(spamKey) || [];
                
                userMessages.push({
                    content: message.content,
                    timestamp: Date.now()
                });
                
                if (userMessages.length > 10) {
                    userMessages.shift();
                }
                
                messageCache.set(spamKey, userMessages);
                
                const recentMessages = userMessages.filter(m => Date.now() - m.timestamp < 10000);
                const sameContent = recentMessages.filter(m => m.content === message.content);
                
                if (sameContent.length >= SPAM_WARN_THRESHOLD) {
                    await message.delete().catch(() => {});
                    
                    const warnEmbed = new PremiumEmbed()
                        .setError()
                        .setTitle('⚠️ Spam Warning')
                        .setDescription(`${message.author}, please do not spam the same message!`)
                        .addField('Warning', `You have sent the same message ${sameContent.length} times.`)
                        .setFooter({ text: 'Repeated spamming may result in XP loss or mute' });
                    
                    const warnMsg = await message.channel.send({ 
                        content: `${message.author}`,
                        embeds: [warnEmbed] 
                    });
                    
                    setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
                    
                    return; // No XP for spam
                }
            }
            
            // Check cooldown - SAB KE LIYE SAME COOLDOWN
            const cooldownKey = `${message.guild.id}-${message.author.id}`;
            const now = Date.now();
            
            if (cooldowns.has(cooldownKey)) {
                const cooldownTime = cooldowns.get(cooldownKey);
                if (now < cooldownTime) return;
            }
            
            cooldowns.set(cooldownKey, now + XP_COOLDOWN);
            
            try {
                const xpAmount = guildData.settings.xpPerMessage || 5;
                
                // SAB KO XP DO - KOI RESTRICTION NAHI
                const result = await User.findOneAndUpdate(
                    { userId: message.author.id, guildId: message.guild.id },
                    { 
                        $inc: { 
                            xp: xpAmount,
                            totalXp: xpAmount,
                            messages: 1
                        },
                        $set: { lastMessage: new Date() },
                        $setOnInsert: { 
                            userId: message.author.id, 
                            guildId: message.guild.id,
                            level: 1
                        }
                    },
                    { 
                        upsert: true, 
                        new: true,
                        setDefaultsOnInsert: true 
                    }
                );
                
                // Recalculate level
                const newLevel = Math.floor(0.1 * Math.sqrt(result.totalXp));
                const oldLevel = result.level;
                
                if (newLevel > oldLevel) {
                    result.level = newLevel;
                    await result.save();
                    
                    const levelUpEmbed = new PremiumEmbed()
                        .setSuccess()
                        .setTitle('🎉 Level Up!')
                        .setDescription(`${message.author} has reached level **${newLevel}**!`)
                        .addField('📊 New Level', `${newLevel}`, true)
                        .addField('✨ Total XP', `${result.totalXp.toLocaleString()}`, true)
                        .addField('📈 Messages', `${result.messages.toLocaleString()}`, true)
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                        .setFooter({ text: `Leveled up in #${message.channel.name}` });
                    
                    const levelUpChannel = guildData.settings.levelUpChannel || message.channel.id;
                    const targetChannel = message.guild.channels.cache.get(levelUpChannel) || message.channel;
                    
                    await targetChannel.send({ 
                        content: `${message.author}`,
                        embeds: [levelUpEmbed] 
                    }).catch(() => {});
                    
                    if (guildData.settings.logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('📈 Level Up Log')
                            .setDescription(`${message.author.tag} leveled up!`)
                            .addFields(
                                { name: 'User', value: `${message.author}`, inline: true },
                                { name: 'New Level', value: `${newLevel}`, inline: true },
                                { name: 'Total XP', value: `${result.totalXp}`, inline: true }
                            )
                            .setTimestamp();
                        
                        await sendLog(message.guild, guildData.settings.logChannel, logEmbed);
                    }
                }
                
                // Update guild stats
                await Guild.findOneAndUpdate(
                    { guildId: message.guild.id },
                    { $inc: { 'stats.totalXpGiven': xpAmount } }
                );
                
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
        const progress = Math.min(100, Math.max(0, ((userData.totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));
        
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
            .setDescription('An error occurred while fetching XP data. Please try again.');
        await message.reply({ embeds: [errorEmbed] });
    }
}

async function handleCheckXpCommand(message, args, client, guildData) {
    try {
        const target = message.mentions.users.first();
        
        if (!target) {
            const embed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Invalid Usage')
                .setDescription(`Please mention a user!\nExample: \`${guildData.settings.prefix}checkxp @user\``);
            
            return message.reply({ embeds: [embed] });
        }
        
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
        const progress = Math.min(100, Math.max(0, ((userData.totalXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));
        
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
        logger.error('CheckXP Error:', error);
        const errorEmbed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Error')
            .setDescription('An error occurred while fetching XP data.');
        await message.reply({ embeds: [errorEmbed] });
    }
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
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            
            const member = await message.guild.members.fetch(user.userId).catch(() => null);
            const username = member?.user?.username || 'Unknown User';
            
            leaderboardText += `${medal} <@${user.userId}> (${username})\n`;
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
        logger.error('Leaderboard Error:', error);
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
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            
            const member = await message.guild.members.fetch(user.userId).catch(() => null);
            const username = member?.user?.username || 'Unknown User';
            
            leaderboardText += `${medal} <@${user.userId}> (${username})\n`;
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
    }
}

async function handleHelpCommand(message, prefix, guildData) {
    const embed = new PremiumEmbed()
        .setTitle('Saraiki Bot Commands')
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
        .setFooter({ text: `Made By Subhan • Current Prefix: ${prefix}` });
    
    await message.reply({ embeds: [embed] });
}
