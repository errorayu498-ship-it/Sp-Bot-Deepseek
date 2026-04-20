const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('panel')
        .setDescription('Open the admin control panel'),
    
    adminOnly: true,
    
    async execute(interaction) {
        const embed = new PremiumEmbed()
            .setTitle('🛠️ Admin Control Panel')
            .setDescription('Welcome to the advanced bot control panel!')
            .addField('📊 Statistics', 
                `**Guild:** ${interaction.guild.name}\n` +
                `**Members:** ${interaction.guild.memberCount}\n` +
                `**Channels:** ${interaction.guild.channels.cache.size}\n` +
                `**Roles:** ${interaction.guild.roles.cache.size}`
            )
            .addField('🎉 Giveaway Controls',
                '• Create and manage giveaways\n' +
                '• View giveaway statistics\n' +
                '• Reroll and delete giveaways'
            )
            .addField('📈 XP System Controls',
                '• Add/Remove XP from users\n' +
                '• Configure XP settings\n' +
                '• View XP statistics'
            )
            .addField('📨 Invite System Controls',
                '• Add/Edit user invites\n' +
                '• Track invite statistics\n' +
                '• Manage invite rewards'
            )
            .addField('⚙️ System Status',
                '**Database:** ✅ Connected\n' +
                '**Giveaways Active:** Active\n' +
                '**XP System:** Running\n' +
                '**Invite Tracking:** Enabled'
            );
        
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('panel_giveaway_create')
                .setLabel('Create Giveaway')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎉'),
            new ButtonBuilder()
                .setCustomId('panel_giveaway_list')
                .setLabel('View Giveaways')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📋'),
            new ButtonBuilder()
                .setCustomId('panel_giveaway_end')
                .setLabel('End Giveaway')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⏹️')
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('panel_xp_add')
                .setLabel('Add XP')
                .setStyle(ButtonStyle.Success)
                .setEmoji('⬆️'),
            new ButtonBuilder()
                .setCustomId('panel_xp_remove')
                .setLabel('Remove XP')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⬇️'),
            new ButtonBuilder()
                .setCustomId('panel_xp_leaderboard')
                .setLabel('XP Leaderboard')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🏆')
        );
        
        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('panel_invite_add')
                .setLabel('Add Invites')
                .setStyle(ButtonStyle.Success)
                .setEmoji('➕'),
            new ButtonBuilder()
                .setCustomId('panel_invite_edit')
                .setLabel('Edit Invites')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✏️'),
            new ButtonBuilder()
                .setCustomId('panel_invite_leaderboard')
                .setLabel('Invite Leaderboard')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👥')
        );
        
        const row4 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('panel_settings')
                .setLabel('Bot Settings')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚙️'),
            new ButtonBuilder()
                .setCustomId('panel_help')
                .setLabel('Help')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❓'),
            new ButtonBuilder()
                .setCustomId('panel_refresh')
                .setLabel('Refresh')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄')
        );
        
        await interaction.reply({ 
            embeds: [embed], 
            components: [row1, row2, row3, row4],
            ephemeral: true 
        });
    }
};
