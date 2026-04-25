const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const User = require('../../models/User');
const Guild = require('../../models/Guild');
const Giveaway = require('../../models/Giveaway');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server')
        .setDescription('View detailed information about all servers the bot is in')
        .addStringOption(option =>
            option.setName('server_id')
                .setDescription('View specific server details (optional)')
                .setRequired(false)),
    
    adminOnly: true,
    
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        
        const specificServerId = interaction.options.getString('server_id');
        
        // Agar specific server ID di gayi hai
        if (specificServerId) {
            const guild = client.guilds.cache.get(specificServerId);
            
            if (!guild) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Server Not Found')
                    .setDescription(`Bot is not in any server with ID: \`${specificServerId}\``)
                    .addField('💡 Tip', 'Use `/server` without any ID to see all servers');
                
                return interaction.editReply({ embeds: [errorEmbed] });
            }
            
            await showServerDetails(interaction, guild, client);
            return;
        }
        
        // Saare servers ki list
        const guilds = client.guilds.cache;
        const totalGuilds = guilds.size;
        
        // Stats calculate karo
        let totalMembers = 0;
        let totalChannels = 0;
        let totalRoles = 0;
        let totalBoosts = 0;
        let onlineMembers = 0;
        let idleMembers = 0;
        let dndMembers = 0;
        
        guilds.forEach(guild => {
            totalMembers += guild.memberCount;
            totalChannels += guild.channels.cache.size;
            totalRoles += guild.roles.cache.size;
            totalBoosts += guild.premiumSubscriptionCount || 0;
            
            guild.members.cache.forEach(member => {
                if (member.presence?.status === 'online') onlineMembers++;
                if (member.presence?.status === 'idle') idleMembers++;
                if (member.presence?.status === 'dnd') dndMembers++;
            });
        });
        
        // Database stats
        const totalDBUsers = await User.countDocuments();
        const totalDBGuilds = await Guild.countDocuments();
        const totalGiveaways = await Giveaway.countDocuments();
        const activeGiveaways = await Giveaway.countDocuments({ status: 'active' });
        
        // Create main embed
        const embed = new PremiumEmbed()
            .setTitle('🌐 Bot Server Overview')
            .setDescription(`**${client.user.username}** is currently in **${totalGuilds}** servers!`)
            .addField('📊 Global Statistics',
                `**Total Servers:** ${totalGuilds}\n` +
                `**Total Members:** ${totalMembers.toLocaleString()}\n` +
                `**Total Channels:** ${totalChannels.toLocaleString()}\n` +
                `**Total Roles:** ${totalRoles.toLocaleString()}\n` +
                `**Total Boosts:** ${totalBoosts}`
            )
            .addField('👥 Member Status',
                `**Online:** ${onlineMembers.toLocaleString()}\n` +
                `**Idle:** ${idleMembers.toLocaleString()}\n` +
                `**Do Not Disturb:** ${dndMembers.toLocaleString()}`
            )
            .addField('🗄️ Database Stats',
                `**Total Users in DB:** ${totalDBUsers.toLocaleString()}\n` +
                `**Guilds Configured:** ${totalDBGuilds.toLocaleString()}\n` +
                `**Total Giveaways:** ${totalGiveaways.toLocaleString()}\n` +
                `**Active Giveaways:** ${activeGiveaways.toLocaleString()}`
            )
            .addField('🤖 Bot Info',
                `**Bot Name:** ${client.user.tag}\n` +
                `**Bot ID:** ${client.user.id}\n` +
                `**Uptime:** ${formatUptime(process.uptime())}\n` +
                `**Ping:** ${client.ws.ping}ms\n` +
                `**Memory Usage:** ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
            )
            .setFooter({ text: `Requested by ${interaction.user.tag} • Use /server server_id:ID for specific server` })
            .setTimestamp();
        
        // Top 10 servers by member count
        const topGuilds = guilds
            .sort((a, b) => b.memberCount - a.memberCount)
            .first(10);
        
        if (topGuilds.length > 0) {
            let topGuildsText = '';
            let rank = 1;
            
            for (const guild of topGuilds) {
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
                const owner = await guild.fetchOwner().catch(() => null);
                const ownerTag = owner?.user?.tag || 'Unknown';
                
                topGuildsText += `${medal} **${guild.name}**\n`;
                topGuildsText += `   └ ${guild.memberCount.toLocaleString()} members • Owner: ${ownerTag}\n`;
                topGuildsText += `   └ ID: \`${guild.id}\`\n\n`;
                rank++;
            }
            
            embed.addField('🏆 Top 10 Servers (by members)', topGuildsText);
        }
        
        await interaction.editReply({ embeds: [embed] });
    }
};

async function showServerDetails(interaction, guild, client) {
    // Fetch guild data from database
    const guildData = await Guild.findOne({ guildId: guild.id });
    const userCount = await User.countDocuments({ guildId: guild.id });
    const giveawayCount = await Giveaway.countDocuments({ guildId: guild.id });
    const activeGiveaways = await Giveaway.countDocuments({ guildId: guild.id, status: 'active' });
    const totalXpGiven = guildData?.stats?.totalXpGiven || 0;
    const totalInvites = guildData?.stats?.totalInvites || 0;
    
    // Fetch owner
    const owner = await guild.fetchOwner().catch(() => null);
    
    // Member status counts
    let onlineCount = 0;
    let idleCount = 0;
    let dndCount = 0;
    let offlineCount = 0;
    let botCount = 0;
    let humanCount = 0;
    
    guild.members.cache.forEach(member => {
        if (member.user.bot) {
            botCount++;
        } else {
            humanCount++;
        }
        
        if (member.presence?.status === 'online') onlineCount++;
        else if (member.presence?.status === 'idle') idleCount++;
        else if (member.presence?.status === 'dnd') dndCount++;
        else offlineCount++;
    });
    
    // Channel counts by type
    let textChannels = 0;
    let voiceChannels = 0;
    let categoryChannels = 0;
    let announcementChannels = 0;
    let forumChannels = 0;
    let stageChannels = 0;
    
    guild.channels.cache.forEach(channel => {
        switch(channel.type) {
            case 0: textChannels++; break; // GUILD_TEXT
            case 2: voiceChannels++; break; // GUILD_VOICE
            case 4: categoryChannels++; break; // GUILD_CATEGORY
            case 5: announcementChannels++; break; // GUILD_ANNOUNCEMENT
            case 15: forumChannels++; break; // GUILD_FORUM
            case 13: stageChannels++; break; // GUILD_STAGE_VOICE
        }
    });
    
    // Role info
    const roles = guild.roles.cache.sort((a, b) => b.position - a.position);
    const topRoles = roles.first(5);
    let topRolesText = '';
    topRoles.forEach(role => {
        topRolesText += `• ${role.name} (${role.members.size} members)\n`;
    });
    
    // Emoji stats
    const emojis = guild.emojis.cache;
    const staticEmojis = emojis.filter(e => !e.animated).size;
    const animatedEmojis = emojis.filter(e => e.animated).size;
    const stickers = guild.stickers?.cache?.size || 0;
    
    const embed = new PremiumEmbed()
        .setTitle(`📋 Server Details: ${guild.name}`)
        .setDescription(`Detailed information about **${guild.name}**`)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
        .addField('📌 Basic Information',
            `**Server Name:** ${guild.name}\n` +
            `**Server ID:** \`${guild.id}\`\n` +
            `**Owner:** ${owner?.user?.tag || 'Unknown'} (${guild.ownerId})\n` +
            `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:F>\n` +
            `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n` +
            `**Verification Level:** ${guild.verificationLevel}\n` +
            `**Boost Level:** ${guild.premiumTier} (${guild.premiumSubscriptionCount || 0} boosts)`
        )
        .addField('👥 Member Statistics',
            `**Total Members:** ${guild.memberCount.toLocaleString()}\n` +
            `**Humans:** ${humanCount.toLocaleString()}\n` +
            `**Bots:** ${botCount.toLocaleString()}\n` +
            `**Online:** ${onlineCount.toLocaleString()}\n` +
            `**Idle:** ${idleCount.toLocaleString()}\n` +
            `**DND:** ${dndCount.toLocaleString()}\n` +
            `**Offline:** ${offlineCount.toLocaleString()}`
        )
        .addField('📺 Channel Statistics',
            `**Total Channels:** ${guild.channels.cache.size}\n` +
            `**Text:** ${textChannels}\n` +
            `**Voice:** ${voiceChannels}\n` +
            `**Categories:** ${categoryChannels}\n` +
            `**Announcements:** ${announcementChannels}\n` +
            `**Forums:** ${forumChannels}\n` +
            `**Stages:** ${stageChannels}`
        )
        .addField('🎨 Server Features',
            `**Roles:** ${guild.roles.cache.size}\n` +
            `**Emojis:** ${staticEmojis} static, ${animatedEmojis} animated\n` +
            `**Stickers:** ${stickers}\n` +
            `**AFK Channel:** ${guild.afkChannel ? `✅ (${guild.afkTimeout}s)` : '❌ None'}\n` +
            `**System Channel:** ${guild.systemChannel ? '✅' : '❌ None'}\n` +
            `**Rules Channel:** ${guild.rulesChannel ? '✅' : '❌ None'}`
        )
        .addField('🔝 Top 5 Roles', topRolesText || 'No roles')
        .addField('🤖 Bot Configuration in This Server',
            `**Prefix:** \`${guildData?.settings?.prefix || '!'}\`\n` +
            `**XP Channel:** ${guildData?.settings?.xpChannel ? `<#${guildData.settings.xpChannel}>` : 'Not Set'}\n` +
            `**Log Channel:** ${guildData?.settings?.logChannel ? `<#${guildData.settings.logChannel}>` : 'Not Set'}\n` +
            `**Invite Log:** ${guildData?.settings?.inviteLogChannel ? `<#${guildData.settings.inviteLogChannel}>` : 'Not Set'}\n` +
            `**XP System:** ${guildData?.settings?.xpEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
            `**Anti-Spam:** ${guildData?.settings?.antiSpamEnabled ? '✅ Enabled' : '❌ Disabled'}`
        )
        .addField('📊 Bot Data in This Server',
            `**Registered Users:** ${userCount.toLocaleString()}\n` +
            `**Total Giveaways:** ${giveawayCount.toLocaleString()}\n` +
            `**Active Giveaways:** ${activeGiveaways.toLocaleString()}\n` +
            `**Total XP Given:** ${totalXpGiven.toLocaleString()}\n` +
            `**Total Invites Tracked:** ${totalInvites.toLocaleString()}`
        )
        .setFooter({ text: `Requested by ${interaction.user.tag} • Server joined: ${guild.joinedAt ? `<t:${Math.floor(guild.joinedAt.getTime() / 1000)}:R>` : 'Unknown'}` })
        .setTimestamp();
    
    // Agar server banner hai to add karo
    if (guild.bannerURL()) {
        embed.setImage(guild.bannerURL({ size: 1024 }));
    }
    
    await interaction.editReply({ embeds: [embed] });
}

function formatUptime(uptime) {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    
    return parts.join(' ');
}
