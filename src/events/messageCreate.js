const { PremiumEmbed } = require('../utils/embedBuilder');
const User = require('../models/User');
const Guild = require('../models/Guild');
const { logger } = require('../utils/logger');

const cooldowns = new Map();
const XP_PER_MESSAGE = 5;
const XP_COOLDOWN = 60000; // 1 minute

// Cache for guild prefixes to reduce database calls
const prefixCache = new Map();

async function getGuildPrefix(guildId) {
    // Check cache first
    if (prefixCache.has(guildId)) {
        return prefixCache.get(guildId);
    }
    
    // Get from database
    const guildData = await Guild.findOne({ guildId });
    const prefix = guildData?.settings?.prefix || '!';
    
    // Store in cache for 5 minutes
    prefixCache.set(guildId, prefix);
    setTimeout(() => prefixCache.delete(guildId), 300000);
    
    return prefix;
}

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // Get guild settings with prefix
        let guildData = await Guild.findOne({ guildId: message.guild.id });
        if (!guildData) {
            guildData = new Guild({ 
                guildId: message.guild.id, 
                name: message.guild.name,
                settings: { prefix: '!' }
            });
            await guildData.save();
        }
        
        const prefix = await getGuildPrefix(message.guild.id);

        // Handle prefix commands
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            // XP Commands
            if (commandName === 'xp') {
                await handleXpCommand(message, args, client);
                return;
            }
            
            if (commandName === 'checkxp') {
                await handleCheckXpCommand(message, args, client);
                return;
            }
            
            if (commandName === 'leaderboard' || commandName === 'lb') {
                await handleLeaderboardCommand(message, args, client);
                return;
            }
            
            // Invite Commands
            if (commandName === 'invite' || commandName === 'invites') {
                await handleInviteCommand(message, args, client);
                return;
            }
            
            if (commandName === 'checkinvite') {
                await handleCheckInviteCommand(message, args, client);
                return;
            }
            
            if (commandName === 'inviteleaderboard' || commandName === 'ilb') {
                await handleInviteLeaderboardCommand(message, args, client);
                return;
            }
            
            // Help Command
            if (commandName === 'help') {
                await handleHelpCommand(message, prefix);
                return;
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
                
                const newLevel = Math.floor(0.1 * Math.sqrt(userData.totalXp));
                
                if (newLevel > oldLevel) {
                    userData.level = newLevel;
                    
                    const levelUpEmbed = new PremiumEmbed()
                        .setSuccess()
                        .setTitle('🎉 Level Up!')
                        .setDescription(`Congratulations ${message.author}! You've reached a new level!`)
                        .addField('📊 New Level', `${newLevel}`, true)
                        .addField('✨ Total XP', `${userData.totalXp}`, true)
                        .addField('📈 Messages', `${userData.messages}`, true)
                        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                        .setFooter({ text: 'Keep chatting to earn more XP!' });
                    
                    await message.channel.send({ 
                        content: `${message.author}`,
                        embeds: [levelUpEmbed] 
                    }).catch(() => {});
                }
                
                await userData.save();
                
                guildData.stats.totalXpGiven += XP_PER_MESSAGE;
                await guildData.save();
                
            } catch (error) {
                logger.error('XP System Error:', error);
            }
        }
    }
};

async function handleXpCommand(message, args, client) {
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
        const progress = ((userData.totalXp - Math.pow(userData.level / 0.1, 2)) / 
                         (Math.pow((userData.level + 1) / 0.1, 2) - Math.pow(userData.level / 0.1, 2))) * 100;
        
        // Create progress bar
        const barLength = 20;
        const filledLength = Math.floor((progress / 100) * barLength);
        const progressBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        
        const embed = new PremiumEmbed()
            .setTitle(`📊 XP Card - ${target.username}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addField('📈 Level', `${userData.level}`, true)
            .addField('✨ Current XP', `${userData.xp}`, true)
            .addField('💫 Total XP', `${userData.totalXp}`, true)
            .addField('💬 Messages', `${userData.messages}`, true)
            .addField('📊 Progress', `${progressBar} ${progress.toFixed(1)}%`, false)
            .addField('⬆️ XP to Next Level', `${Math.floor(xpNeeded)}`, true)
            .setFooter({ text: `Requested by ${message.author.username}` });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        logger.error('XP Command Error:', error);
    }
}

async function handleCheckXpCommand(message, args, client) {
    const target = message.mentions.users.first();
    
    if (!target) {
        const prefix = await getGuildPrefix(message.guild.id);
        const embed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Invalid Usage')
            .setDescription(`Please mention a user!\nExample: \`${prefix}checkxp @user\``);
        
        return message.reply({ embeds: [embed] });
    }
    
    await handleXpCommand(message, [target.id], client);
}

async function handleLeaderboardCommand(message, args, client) {
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
        let userPosition = 1;
        
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
            userPosition++;
        }
        
        embed.setDescription(leaderboardText);
        
        if (userRank) {
            embed.addField('📍 Your Rank', `#${userRank} out of ${users.length} members`, true);
        } else {
            embed.addField('📍 Your Rank', 'Not in top 20', true);
        }
        
        embed.setFooter({ text: `Requested by ${message.author.username} • Total: ${users.length} members` });
        
        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        logger.error('Leaderboard Command Error:', error);
    }
}

async function handleInviteCommand(message, args, client) {
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

async function handleCheckInviteCommand(message, args, client) {
    const target = message.mentions.users.first();
    
    if (!target) {
        const prefix = await getGuildPrefix(message.guild.id);
        const embed = new PremiumEmbed()
            .setError()
            .setTitle('❌ Invalid Usage')
            .setDescription(`Please mention a user!\nExample: \`${prefix}checkinvite @user\``);
        
        return message.reply({ embeds: [embed] });
    }
    
    await handleInviteCommand(message, [target.id], client);
}

async function handleInviteLeaderboardCommand(message, args, client) {
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
    }
}

async function handleHelpCommand(message, prefix) {
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
            '• Invite friends to climb the invite leaderboard\n' +
            '• Use slash commands for admin features'
        )
        .setFooter({ text: `Made with ❤️ • Current Prefix: ${prefix}` });
    
    await message.reply({ embeds: [embed] });
}
