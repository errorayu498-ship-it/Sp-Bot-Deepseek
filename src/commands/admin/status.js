const { SlashCommandBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const Guild = require('../../models/Guild');
const User = require('../../models/User');
const Giveaway = require('../../models/Giveaway');
const os = require('os');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('View detailed bot status and statistics'),
    
    adminOnly: true,
    
    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });
        
        const guildData = await Guild.findOne({ guildId: interaction.guild.id });
        const totalUsers = await User.countDocuments({ guildId: interaction.guild.id });
        const activeGiveaways = await Giveaway.countDocuments({ guildId: interaction.guild.id, status: 'active' });
        const totalGiveaways = await Giveaway.countDocuments({ guildId: interaction.guild.id });
        
        // System stats
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const memoryUsage = process.memoryUsage();
        const cpuUsage = os.loadavg()[0];
        
        const embed = new PremiumEmbed()
            .setTitle('📊 Bot Status Dashboard')
            .setDescription('Detailed system and bot statistics')
            .addField('🤖 Bot Information',
                `**Bot Name:** ${client.user.tag}\n` +
                `**Bot ID:** ${client.user.id}\n` +
                `**Uptime:** ${days}d ${hours}h ${minutes}m ${seconds}s\n` +
                `**Ping:** ${client.ws.ping}ms\n` +
                `**Status:** 🟢 Online`
            )
            .addField('📈 Server Statistics',
                `**Guild Name:** ${interaction.guild.name}\n` +
                `**Total Members:** ${interaction.guild.memberCount}\n` +
                `**Total Channels:** ${interaction.guild.channels.cache.size}\n` +
                `**Total Roles:** ${interaction.guild.roles.cache.size}\n` +
                `**Server Created:** <t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:R>`
            )
            .addField('📊 Bot Data',
                `**Registered Users:** ${totalUsers}\n` +
                `**Active Giveaways:** ${activeGiveaways}\n` +
                `**Total Giveaways:** ${totalGiveaways}\n` +
                `**Total XP Given:** ${guildData?.stats?.totalXpGiven?.toLocaleString() || 0}\n` +
                `**Total Invites:** ${guildData?.stats?.totalInvites?.toLocaleString() || 0}`
            )
            .addField('⚙️ Current Settings',
                `**Prefix:** \`${guildData?.settings?.prefix || '!'}\`\n` +
                `**XP Channel:** ${guildData?.settings?.xpChannel ? `<#${guildData.settings.xpChannel}>` : 'Not Set'}\n` +
                `**XP System:** ${guildData?.settings?.xpEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                `**Anti-Spam:** ${guildData?.settings?.antiSpamEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                `**Invite Tracking:** ${guildData?.settings?.inviteTracking ? '✅ Enabled' : '❌ Disabled'}`
            )
            .addField('💻 System Resources',
                `**CPU Usage:** ${cpuUsage.toFixed(2)}%\n` +
                `**RAM Usage:** ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB\n` +
                `**Total RAM:** ${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB\n` +
                `**Node.js:** ${process.version}\n` +
                `**Platform:** ${os.platform()} ${os.arch()}`
            )
            .addField('🗄️ Database',
                `**MongoDB:** ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}\n` +
                `**Database Name:** ${mongoose.connection.name}\n` +
                `**Host:** ${mongoose.connection.host}\n` +
                `**Collections:** ${Object.keys(mongoose.connection.collections).length}`
            )
            .addField('🌐 Discord Connection',
                `**Gateway:** ${client.ws.ping}ms\n` +
                `**Shards:** ${client.options.shardCount || 1}\n` +
                `**Cached Users:** ${client.users.cache.size}\n` +
                `**Cached Guilds:** ${client.guilds.cache.size}\n` +
                `**Cached Channels:** ${client.channels.cache.size}`
            )
            .setFooter({ text: `Requested by ${interaction.user.tag} • Bot Version 2.0.0` })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    }
};
