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

function isUserStaff(guildData, member, adminRole) {
    // Check admin first
    if (adminRole && member.roles.cache.has(adminRole)) return true;
    
    // Check staff list
    if (guildData.staff?.some(s => s.userId === member.id)) return true;
    
    return false;
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
                },
                blacklist: [],
                staff: []
            });
            await guildData.save();
        }
        
        const prefix = guildData.settings.prefix || '!';
        const adminRole = process.env.ADMIN_ROLE_ID;

        // Handle prefix commands
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            // ✅ BLACKLIST CHECK FOR PUBLIC COMMANDS
            const isBlacklisted = guildData.blacklist?.some(b => b.userId === message.author.id);
            if (isBlacklisted) {
                const blacklistEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('🚫 Access Denied')
                    .setDescription('You are blacklisted and cannot use bot commands!')
                    .addField('Reason', 'You have been restricted from using bot features.')
                    .setFooter({ text: 'Contact an admin for more information.' });
                
                return message.reply({ embeds: [blacklistEmbed] });
            }
            
            logger.info(`Prefix command used: ${commandName} by ${message.author.tag}`);
            
            // ==================== STAFF COMMANDS ====================
            
            if (commandName === 'delmsg') {
                await handleStaffDelMsg(message, args, client, guildData, adminRole);
                return;
            }
            
            if (commandName === 'timeout') {
                await handleStaffTimeout(message, args, client, guildData, adminRole);
                return;
            }
            
            // ==================== PUBLIC XP COMMANDS ====================
            
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
            
            // ==================== PUBLIC INVITE COMMANDS ====================
            
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
            
            // ==================== HELP COMMAND ====================
            
            if (commandName === 'help') {
                await handleHelpCommand(message, prefix, guildData);
                return;
            }
            
            return;
        }

        // ==================== XP SYSTEM ====================
        
        if (guildData.settings.xpEnabled) {
            // ✅ BLACKLIST CHECK - Agar user blacklisted hai to XP nahi milega
            const isBlacklisted = guildData.blacklist?.some(b => b.userId === message.author.id);
            
            if (isBlacklisted) {
                return; // Blacklisted user - no XP, silently return
            }
            
            const xpChannelId = guildData.settings.xpChannel;
            
            // Agar XP channel set hai to sirf usi channel mein XP milega
            if (xpChannelId && message.channel.id !== xpChannelId) {
                return; // Not the XP channel, no XP given
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
            
            // Check cooldown
            const cooldownKey = `${message.guild.id}-${message.author.id}`;
            const now = Date.now();
            
            if (cooldowns.has(cooldownKey)) {
                const cooldownTime = cooldowns.get(cooldownKey);
                if (now < cooldownTime) return;
            }
            
            cooldowns.set(cooldownKey, now + XP_COOLDOWN);
            
            try {
                const xpAmount = guildData.settings.xpPerMessage || 5;
                
                // SAB KO XP DO - KOI RESTRICTION NAHI (except blacklisted)
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

// ==================== PUBLIC COMMAND HANDLERS ====================

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
    // Check if user is staff
    const isStaff = guildData.staff?.some(s => s.userId === message.author.id);
    const isAdmin = message.member.roles.cache.has(process.env.ADMIN_ROLE_ID);
    
    const embed = new PremiumEmbed()
        .setTitle('📚 Bot Commands Help')
        .setDescription(`Here are all available commands! Prefix: \`${prefix}\``)
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
        );
    
    // Staff commands section
    if (isStaff || isAdmin) {
        embed.addField('🔧 Staff Commands',
            `\`${prefix}delmsg @user [amount]\` - Delete user messages\n` +
            `\`${prefix}delmsg userID [amount]\` - Delete by ID\n` +
            `\`${prefix}timeout @user duration\` - Timeout a member\n` +
            `\`${prefix}timeout userID duration\` - Timeout by ID\n\n` +
            `**Timeout Examples:**\n` +
            `\`${prefix}timeout @user 10m\` - 10 minutes\n` +
            `\`${prefix}timeout @user 1h\` - 1 hour\n` +
            `\`${prefix}timeout @user 30s\` - 30 seconds\n` +
            `Max timeout: 6 hours`
        );
    }
    
    embed.addField('ℹ️ Other Commands',
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

// ==================== STAFF COMMAND HANDLERS ====================

async function handleStaffDelMsg(message, args, client, guildData, adminRole) {
    try {
        // Check if user is staff or admin
        const isAllowed = isUserStaff(guildData, message.member, adminRole);
        
        if (!isAllowed) {
            const embed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Permission Denied')
                .setDescription('You need staff permissions to use this command!');
            
            return message.reply({ embeds: [embed] });
        }
        
        // Check bot permissions
        if (!message.guild.members.me.permissions.has('ManageMessages')) {
            const embed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Missing Permissions')
                .setDescription('Bot needs **Manage Messages** permission!');
            
            return message.reply({ embeds: [embed] });
        }
        
        let targetUser = null;
        let messageAmount = null;
        
        // Parse arguments - support both mention and ID
        if (message.mentions.users.first()) {
            targetUser = message.mentions.users.first();
            // Check if there's an amount after mention
            if (args.length > 1) {
                messageAmount = parseInt(args[1]);
            }
        } else if (args[0]) {
            // Try ID
            targetUser = await client.users.fetch(args[0]).catch(() => null);
            if (targetUser && args.length > 1) {
                messageAmount = parseInt(args[1]);
            }
        }
        
        // Validate message amount
        if (messageAmount !== null && (isNaN(messageAmount) || messageAmount < 1 || messageAmount > 100)) {
            const guideEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Invalid Amount')
                .setDescription('Message amount must be between 1-100')
                .addField('📝 Correct Usage',
                    `\`${guildData.settings.prefix}delmsg @user [amount]\` - Delete specific amount\n` +
                    `\`${guildData.settings.prefix}delmsg userID [amount]\` - Delete by ID\n` +
                    `\`${guildData.settings.prefix}delmsg @user\` - Delete last 30 min messages`
                );
            
            return message.reply({ embeds: [guideEmbed] });
        }
        
        if (!targetUser) {
            const guideEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ User Required')
                .setDescription('Please mention a user or provide their ID!')
                .addField('📝 Usage',
                    `\`${guildData.settings.prefix}delmsg @user [amount]\` - Delete messages\n` +
                    `\`${guildData.settings.prefix}delmsg userID [amount]\` - Delete by ID`
                );
            
            return message.reply({ embeds: [guideEmbed] });
        }
        
        // Get messages
        const fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
        
        let messagesToDelete;
        
        if (messageAmount) {
            // Delete specific amount
            messagesToDelete = Array.from(fetchedMessages
                .filter(msg => msg.author.id === targetUser.id)
                .values())
                .slice(0, messageAmount);
        } else {
            // Delete messages from last 30 minutes
            const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
            messagesToDelete = Array.from(fetchedMessages
                .filter(msg => msg.author.id === targetUser.id && msg.createdTimestamp > thirtyMinutesAgo)
                .values());
        }
        
        if (messagesToDelete.length === 0) {
            const embed = new PremiumEmbed()
                .setWarning()
                .setTitle('⚠️ No Messages Found')
                .setDescription(`No messages found from ${targetUser.tag} to delete.\n${messageAmount ? 'Try a lower amount.' : 'No messages in the last 30 minutes.'}`);
            
            return message.reply({ embeds: [embed] });
        }
        
        // Delete messages
        const deleted = await message.channel.bulkDelete(messagesToDelete, true);
        
        // Send confirmation embed
        const confirmEmbed = new PremiumEmbed()
            .setSuccess()
            .setTitle('🗑️ Messages Deleted')
            .setDescription(`Successfully deleted messages!`)
            .addField('👤 Target User', `${targetUser.tag}`, true)
            .addField('🆔 User ID', targetUser.id, true)
            .addField('📊 Deleted', `${deleted.size} messages`, true)
            .addField('📺 Channel', `${message.channel}`, true)
            .addField('👮 Staff', `${message.author.tag}`, true)
            .addField('⏰ Filter', messageAmount ? `Last ${messageAmount} messages` : 'Last 30 minutes', true)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Action by ${message.author.tag}` })
            .setTimestamp();
        
        const replyMsg = await message.channel.send({ embeds: [confirmEmbed] });
        
        // Auto delete confirmation after 10 seconds
        setTimeout(() => replyMsg.delete().catch(() => {}), 10000);
        
        // Log
        if (guildData.settings?.logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🗑️ Messages Bulk Deleted')
                .addFields(
                    { name: 'Target User', value: `${targetUser.tag}`, inline: true },
                    { name: 'User ID', value: targetUser.id, inline: true },
                    { name: 'Deleted', value: `${deleted.size} messages`, inline: true },
                    { name: 'Channel', value: `${message.channel.name}`, inline: true },
                    { name: 'Staff', value: `${message.author.tag}`, inline: true },
                    { name: 'Filter', value: messageAmount ? `Last ${messageAmount}` : 'Last 30 min', inline: true }
                )
                .setTimestamp();
            
            await sendLog(message.guild, guildData.settings.logChannel, logEmbed);
        }
        
    } catch (error) {
        console.error('Staff DelMsg Error:', error);
        
        if (error.code === 50034) {
            const embed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Error')
                .setDescription('Can only bulk delete messages under 14 days old.');
            return message.reply({ embeds: [embed] });
        }
        
        const embed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Error')
            .setDescription('Failed to delete messages. Check bot permissions.');
        await message.reply({ embeds: [embed] });
    }
}

async function handleStaffTimeout(message, args, client, guildData, adminRole) {
    try {
        // Check if user is staff or admin
        const isAllowed = isUserStaff(guildData, message.member, adminRole);
        
        if (!isAllowed) {
            const embed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Permission Denied')
                .setDescription('You need staff permissions to use this command!');
            
            return message.reply({ embeds: [embed] });
        }
        
        // Check bot permissions
        if (!message.guild.members.me.permissions.has('ModerateMembers')) {
            const embed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Missing Permissions')
                .setDescription('Bot needs **Moderate Members** permission to timeout users!');
            
            return message.reply({ embeds: [embed] });
        }
        
        let targetMember = null;
        let duration = null;
        
        // Parse arguments
        if (message.mentions.members.first()) {
            targetMember = message.mentions.members.first();
            if (args.length > 1) {
                duration = args[1];
            }
        } else if (args[0]) {
            // Try ID
            targetMember = await message.guild.members.fetch(args[0]).catch(() => null);
            if (targetMember && args.length > 1) {
                duration = args[1];
            }
        }
        
        // Show guide if wrong usage
        if (!targetMember || !duration) {
            const guideEmbed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Invalid Usage')
                .setDescription('Please provide user and duration!')
                .addField('📝 Correct Usage',
                    `\`${guildData.settings.prefix}timeout @user duration\`\n` +
                    `\`${guildData.settings.prefix}timeout userID duration\`\n\n` +
                    `**Examples:**\n` +
                    `\`${guildData.settings.prefix}timeout @user 1h\` - 1 hour\n` +
                    `\`${guildData.settings.prefix}timeout @user 30m\` - 30 minutes\n` +
                    `\`${guildData.settings.prefix}timeout @user 60s\` - 60 seconds\n` +
                    `\`${guildData.settings.prefix}timeout @user 5m30s\` - 5 min 30 sec`
                )
                .addField('⏰ Duration Format',
                    '• `s` = seconds (max 21600s = 6h)\n' +
                    '• `m` = minutes (max 360m = 6h)\n' +
                    '• `h` = hours (max 6h)\n' +
                    '• Max timeout: 6 hours'
                )
                .setFooter({ text: guildData.settings.prefix + 'timeout @user 10m' });
            
            return message.reply({ embeds: [guideEmbed] });
        }
        
        // Parse duration
        let totalMs = 0;
        const durationStr = duration.toLowerCase();
        
        // Parse hours
        const hoursMatch = durationStr.match(/(\d+)h/);
        if (hoursMatch) totalMs += parseInt(hoursMatch[1]) * 3600000;
        
        // Parse minutes
        const minutesMatch = durationStr.match(/(\d+)m/);
        if (minutesMatch) totalMs += parseInt(minutesMatch[1]) * 60000;
        
        // Parse seconds
        const secondsMatch = durationStr.match(/(\d+)s/);
        if (secondsMatch) totalMs += parseInt(secondsMatch[1]) * 1000;
        
        // Validate duration
        if (totalMs <= 0) {
            const embed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Invalid Duration')
                .setDescription('Duration must be greater than 0!')
                .addField('📝 Examples', 
                    '`1h` = 1 hour\n`30m` = 30 minutes\n`60s` = 60 seconds');
            
            return message.reply({ embeds: [embed] });
        }
        
        // Max 6 hours check
        const maxMs = 6 * 3600000; // 6 hours
        if (totalMs > maxMs) {
            const embed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Duration Too Long')
                .setDescription('Maximum timeout duration is 6 hours!');
            
            return message.reply({ embeds: [embed] });
        }
        
        // Check if can timeout this user
        if (!targetMember.moderatable) {
            const embed = new PremiumEmbed()
                .setError()
                .setTitle('❌ Cannot Timeout')
                .setDescription(`Cannot timeout ${targetMember.user.tag}! They may have higher permissions.`);
            
            return message.reply({ embeds: [embed] });
        }
        
        // Format display duration
        const hours = Math.floor(totalMs / 3600000);
        const minutes = Math.floor((totalMs % 3600000) / 60000);
        const seconds = Math.floor((totalMs % 60000) / 1000);
        let displayDuration = '';
        if (hours > 0) displayDuration += `${hours}h `;
        if (minutes > 0) displayDuration += `${minutes}m `;
        if (seconds > 0) displayDuration += `${seconds}s`;
        displayDuration = displayDuration.trim() || '0s';
        
        // Apply timeout
        await targetMember.timeout(totalMs, `Timed out by ${message.author.tag} for ${displayDuration}`);
        
        // Success embed
        const embed = new PremiumEmbed()
            .setSuccess()
            .setTitle('🔇 Member Timed Out')
            .setDescription(`${targetMember.user.tag} has been timed out!`)
            .addField('👤 User', `${targetMember.user}`, true)
            .addField('🆔 User ID', targetMember.id, true)
            .addField('⏰ Duration', displayDuration, true)
            .addField('⏱️ Total Time', `${Math.floor(totalMs / 1000)} seconds`, true)
            .addField('👮 Staff', `${message.author.tag}`, true)
            .addField('⏳ Expires', `<t:${Math.floor((Date.now() + totalMs) / 1000)}:R>`, true)
            .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `Timeout by ${message.author.tag}` })
            .setTimestamp();
        
        await message.reply({ embeds: [embed] });
        
        // Log
        if (guildData.settings?.logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('🔇 Member Timed Out')
                .setDescription(`${targetMember.user.tag} has been timed out!`)
                .addFields(
                    { name: 'User', value: `${targetMember.user.tag}`, inline: true },
                    { name: 'Duration', value: displayDuration, inline: true },
                    { name: 'Staff', value: `${message.author.tag}`, inline: true }
                )
                .setTimestamp();
            
            await sendLog(message.guild, guildData.settings.logChannel, logEmbed);
        }
        
    } catch (error) {
        console.error('Staff Timeout Error:', error);
        
        const embed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Error')
            .setDescription('Failed to timeout user. Check bot permissions.\n' + error.message);
        await message.reply({ embeds: [embed] });
    }
}
