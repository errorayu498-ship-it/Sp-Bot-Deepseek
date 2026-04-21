const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { PremiumEmbed } = require('../../utils/embedBuilder');
const User = require('../../models/User');
const Guild = require('../../models/Guild');
const Giveaway = require('../../models/Giveaway');
const mongoose = require('mongoose');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('database')
        .setDescription('Database control panel'),
    
    adminOnly: true,
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const userCount = await User.countDocuments({ guildId: interaction.guild.id });
        const giveawayCount = await Giveaway.countDocuments({ guildId: interaction.guild.id });
        const guildData = await Guild.findOne({ guildId: interaction.guild.id });
        
        const embed = new PremiumEmbed()
            .setTitle('🗄️ Database Control Panel')
            .setDescription('Manage and monitor database operations')
            .addField('📊 Database Statistics',
                `**Total Users:** ${userCount.toLocaleString()}\n` +
                `**Total Giveaways:** ${giveawayCount.toLocaleString()}\n` +
                `**Total XP Given:** ${guildData?.stats?.totalXpGiven?.toLocaleString() || 0}\n` +
                `**Database Status:** ${mongoose.connection.readyState === 1 ? '🟢 Connected' : '🔴 Disconnected'}\n` +
                `**Connection:** ${mongoose.connection.host}`
            )
            .addField('📅 Server Data',
                `**Guild ID:** ${interaction.guild.id}\n` +
                `**Prefix:** \`${guildData?.settings?.prefix || '!'}\`\n` +
                `**XP Channel:** ${guildData?.settings?.xpChannel ? `<#${guildData.settings.xpChannel}>` : 'Not Set'}\n` +
                `**Created:** <t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:R>`
            )
            .addField('⚠️ Warning',
                '**Reset Database** will delete ALL user data for this server!\n' +
                'This action cannot be undone!\n\n' +
                '**Restart Connection** will refresh the database connection.'
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();
        
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('db_restart')
                .setLabel('Restart Connection')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄'),
            new ButtonBuilder()
                .setCustomId('db_stats')
                .setLabel('Refresh Stats')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📊')
        );
        
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('db_reset_users')
                .setLabel('Reset User Data')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('⚠️'),
            new ButtonBuilder()
                .setCustomId('db_reset_giveaways')
                .setLabel('Reset Giveaways')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🎉'),
            new ButtonBuilder()
                .setCustomId('db_reset_all')
                .setLabel('Reset Everything')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('💀')
        );
        
        const message = await interaction.editReply({ 
            embeds: [embed], 
            components: [row1, row2]
        });
        
        // Button collector
        const collector = message.createMessageComponentCollector({ time: 300000 });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Only the command user can use these buttons!', ephemeral: true });
            }
            
            if (i.customId === 'db_stats') {
                const newUserCount = await User.countDocuments({ guildId: interaction.guild.id });
                const newGiveawayCount = await Giveaway.countDocuments({ guildId: interaction.guild.id });
                
                const updatedEmbed = new PremiumEmbed()
                    .setTitle('🗄️ Database Control Panel (Updated)')
                    .setDescription('Statistics refreshed!')
                    .addField('📊 Database Statistics',
                        `**Total Users:** ${newUserCount.toLocaleString()}\n` +
                        `**Total Giveaways:** ${newGiveawayCount.toLocaleString()}\n` +
                        `**Database Status:** ${mongoose.connection.readyState === 1 ? '🟢 Connected' : '🔴 Disconnected'}`
                    )
                    .setTimestamp();
                
                await i.update({ embeds: [updatedEmbed], components: [row1, row2] });
            }
            
            if (i.customId === 'db_restart') {
                await i.deferUpdate();
                
                try {
                    await mongoose.connection.close();
                    await mongoose.connect(process.env.MONGODB_URI);
                    
                    const successEmbed = new PremiumEmbed()
                        .setSuccess()
                        .setTitle('✅ Database Restarted')
                        .setDescription('Database connection has been refreshed successfully!')
                        .addField('Status', '🟢 Connected', true)
                        .addField('Host', mongoose.connection.host, true);
                    
                    await i.editReply({ embeds: [successEmbed], components: [] });
                } catch (error) {
                    const errorEmbed = new PremiumEmbed()
                        .setError()
                        .setTitle('❌ Restart Failed')
                        .setDescription('Failed to restart database connection.');
                    
                    await i.editReply({ embeds: [errorEmbed], components: [] });
                }
            }
            
            if (i.customId === 'db_reset_users') {
                await showConfirmation(i, 'users', interaction.guild.id);
            }
            
            if (i.customId === 'db_reset_giveaways') {
                await showConfirmation(i, 'giveaways', interaction.guild.id);
            }
            
            if (i.customId === 'db_reset_all') {
                await showConfirmation(i, 'all', interaction.guild.id);
            }
        });
    }
};

async function showConfirmation(interaction, type, guildId) {
    const confirmEmbed = new PremiumEmbed()
        .setWarning()
        .setTitle('⚠️ Confirm Reset')
        .setDescription(`Are you sure you want to reset **${type}** data?\nThis action cannot be undone!`)
        .setFooter({ text: 'Click Confirm within 30 seconds' });
    
    const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`confirm_reset_${type}`)
            .setLabel('Confirm Reset')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId('cancel_reset')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌')
    );
    
    await interaction.update({ embeds: [confirmEmbed], components: [confirmRow] });
    
    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });
    
    collector.on('collect', async (i) => {
        if (i.customId === 'cancel_reset') {
            const cancelEmbed = new PremiumEmbed()
                .setInfo()
                .setTitle('❌ Reset Cancelled')
                .setDescription('Database reset has been cancelled.');
            
            return i.update({ embeds: [cancelEmbed], components: [] });
        }
        
        if (i.customId === `confirm_reset_${type}`) {
            await i.deferUpdate();
            
            try {
                if (type === 'users') {
                    await User.deleteMany({ guildId: guildId });
                } else if (type === 'giveaways') {
                    await Giveaway.deleteMany({ guildId: guildId });
                } else if (type === 'all') {
                    await User.deleteMany({ guildId: guildId });
                    await Giveaway.deleteMany({ guildId: guildId });
                }
                
                const successEmbed = new PremiumEmbed()
                    .setSuccess()
                    .setTitle('✅ Database Reset Complete')
                    .setDescription(`Successfully reset **${type}** data!`);
                
                await i.editReply({ embeds: [successEmbed], components: [] });
            } catch (error) {
                const errorEmbed = new PremiumEmbed()
                    .setError()
                    .setTitle('❌ Reset Failed')
                    .setDescription(`Failed to reset ${type} data.`);
                
                await i.editReply({ embeds: [errorEmbed], components: [] });
            }
        }
    });
    
    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            const timeoutEmbed = new PremiumEmbed()
                .setWarning()
                .setTitle('⏰ Timeout')
                .setDescription('Reset confirmation timed out.');
            
            await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
        }
    });
}
